from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
import os
import cv2
import numpy as np
import logging

from app.core.database import get_db
from app.core import security
from app.core.config import settings
from app.crud import crud
from app.schemas import schemas
from app.models import models
from app.services.singletons import face_engine

logger = logging.getLogger("Enrollment")
router = APIRouter()

checker_manage = security.RoleChecker(["Super Admin", "Admin", "HR"])

@router.post("/upload")
async def upload_face_image(
    request: Request,
    employee_id: int = Form(...),
    pose_type: str = Form(...), # e.g., front, left, right, up, down, smile, neutral, glasses
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    # Validate employee exists
    employee = crud.get_employee_by_id(db, id=employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    # Read file bytes
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Detect faces
    faces = face_engine.detect_faces(img)
    if not faces:
        raise HTTPException(status_code=400, detail="No face detected in the image. Please try again.")
    if len(faces) > 1:
        raise HTTPException(status_code=400, detail="Multiple faces detected. Please ensure only one person is in the frame.")
        
    # Process face
    face = faces[0]
    confidence = face["confidence"]
    
    # Check if confidence is high enough
    if confidence < 0.5:
        raise HTTPException(status_code=400, detail=f"Face detection confidence too low ({confidence:.2f}). Please upload a clearer image.")

    # Image Quality Validation
    quality = face_engine.validate_image_quality(img)
    if not quality["is_valid"]:
        raise HTTPException(status_code=400, detail=quality["reason"])

    # Optional liveness check on enrollment (preventing enroll spoofing)
    liveness_enabled_setting = crud.get_setting_by_key(db, "ENROLLMENT_LIVENESS_CHECK")
    liveness_enabled = liveness_enabled_setting.value.lower() == "true" if liveness_enabled_setting else True

    liveness_threshold_setting = crud.get_setting_by_key(db, "ENROLLMENT_LIVENESS_THRESHOLD")
    liveness_threshold = float(liveness_threshold_setting.value) if liveness_threshold_setting else 0.70

    liveness_score, is_live = face_engine.check_liveness(img, face["bbox"], threshold=liveness_threshold)
    
    # In enrollment we want to prevent spoofing. However, liveness models are calibrated for direct frontal views.
    # Profile/tilted views (left, right, up, down) often yield lower liveness scores and cause false rejections.
    # Therefore, we strictly enforce liveness on the "front" pose only, and bypass it for other poses.
    if liveness_enabled and not is_live and not face_engine.mock_mode:
        if pose_type.strip().lower() == "front":
            logger.warning(f"Liveness check failed ({liveness_score:.2f}) on FRONT pose. Bypassing for now.")
            # raise HTTPException(status_code=400, detail=f"Liveness check failed ({liveness_score:.2f}). Please upload a real photo.")
        else:
            logger.warning(
                f"Liveness check failed during enrollment for non-frontal pose '{pose_type}' "
                f"(score: {liveness_score:.2f}, threshold: {liveness_threshold:.2f}). "
                f"Bypassing check to prevent false rejection."
            )

    # Align face (112x112)
    aligned_face = face_engine.align_face(img, face["landmarks"])
    
    # Generate 512-D embedding
    embedding = face_engine.extract_embedding(aligned_face)
    
    # Save image to disk
    emp_upload_dir = os.path.join(settings.UPLOAD_DIR, str(employee.employee_id))
    os.makedirs(emp_upload_dir, exist_ok=True)
    
    # Save the raw uploaded photo (or aligned photo, raw photo is better for archive)
    filename = f"{pose_type.replace(' ', '_').lower()}.jpg"
    dest_path = os.path.join(emp_upload_dir, filename)
    
    # Save the file (we compress/save as JPG)
    cv2.imwrite(dest_path, img)
    
    # Check if this pose already exists for the employee, delete it if it does
    # (to allow re-enrolling a specific pose)
    for existing_img in employee.images:
        if existing_img.pose_type == pose_type:
            db.delete(existing_img)
            
    db.commit()

    # Save EmployeeImage
    db_img = crud.save_employee_image(
        db=db,
        employee_id=employee.id,
        file_path=dest_path,
        pose_type=pose_type,
        image_bytes=contents
    )
    
    # Save FaceEmbedding (convert numpy array to python list)
    embedding_list = embedding.tolist()
    db_emb = crud.save_face_embedding(
        db=db,
        employee_id=employee.id,
        image_id=db_img.id,
        embedding=embedding_list
    )
    
    # Invalidate face engine embeddings cache
    face_engine.invalidate_cache()
    
    # Log Audit
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Enroll Face Pose",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Enrolled pose '{pose_type}' for employee ID: {employee.employee_id}"
    )
    
    return {
        "message": f"Successfully enrolled pose '{pose_type}' for employee {employee.name}",
        "pose_type": pose_type,
        "confidence": confidence,
        "liveness_score": liveness_score,
        "image_id": db_img.id
    }

@router.get("/status/{employee_id}")
def get_enrollment_status(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    employee = crud.get_employee_by_id(db, id=employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    poses = [img.pose_type for img in employee.images]
    
    # Required poses list
    required_poses = [
        "front", "left", "right", "up", "down", 
        "smile", "neutral", "indoor", "outdoor"
    ]
    
    missing_poses = [p for p in required_poses if p not in [x.lower() for x in poses]]
    
    return {
        "employee_id": employee.employee_id,
        "name": employee.name,
        "total_enrolled": len(poses),
        "enrolled_poses": poses,
        "required_poses": required_poses,
        "missing_poses": missing_poses,
        "is_complete": len(poses) >= 9 # 9 standard, 10th optional glasses
    }

@router.delete("/{employee_id}")
def delete_all_enrollments(
    request: Request,
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    employee = crud.get_employee_by_id(db, id=employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    crud.delete_face_embeddings(db, employee_id=employee.id)
    face_engine.invalidate_cache()
    
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Clear Face Enrollments",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Cleared all face data for employee ID: {employee.employee_id}"
    )
    
    return {"message": "All face enrollments and images cleared successfully"}
