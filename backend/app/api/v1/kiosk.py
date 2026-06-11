from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import base64
import cv2
import numpy as np
import logging
from datetime import datetime, time
import urllib.parse

from app.core.database import get_db
from app.core.config import settings
from app.core import event_bus
from app.crud import crud
from app.schemas import schemas
from app.models import models
from app.services.singletons import face_engine, voice_assistant

logger = logging.getLogger("Kiosk")
router = APIRouter()

# Global variable to prevent consecutive voice greetings for the same employee
_last_greeted_employee_id = None


def _publish_log(log_obj, employee=None):
    """Serialize an AttendanceLog ORM object and publish it to the SSE bus."""
    try:
        emp_data = None
        if employee:
            emp_data = {
                "id": employee.id,
                "name": employee.name,
                "employee_id": employee.employee_id,
                "designation": employee.designation,
                "department": employee.department.name if employee.department else "General",
            }
        payload = {
            "id": log_obj.id,
            "timestamp": log_obj.timestamp.isoformat() if log_obj.timestamp else None,
            "camera": log_obj.camera,
            "confidence": log_obj.confidence,
            "liveness_score": log_obj.liveness_score,
            "is_spoof": log_obj.is_spoof,
            "status": log_obj.status,
            "employee": emp_data,
        }
        event_bus.publish_scan_event(payload)
    except Exception as exc:
        logger.warning(f"Failed to publish scan event: {exc}")

class KioskScanRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded image frame (JPEG/PNG data URL)")
    camera: str = Field("Main Kiosk", description="Identifier of the kiosk scanner device")

@router.post("/scan")
def scan_face(
    request: Request,
    payload: KioskScanRequest,
    db: Session = Depends(get_db)
):
    now = datetime.now()
    # Retrieve dynamic thresholds from database settings
    face_threshold_setting = crud.get_setting_by_key(db, "KIOSK_FACE_THRESHOLD")
    liveness_threshold_setting = crud.get_setting_by_key(db, "KIOSK_LIVENESS_THRESHOLD")
    voice_greeting_setting = crud.get_setting_by_key(db, "VOICE_GREETING_ENABLED")
    maintenance_setting = crud.get_setting_by_key(db, "SYSTEM_MAINTENANCE_MODE")
    
    if maintenance_setting and maintenance_setting.value.lower() == "true":
        return {
            "status": "maintenance",
            "message": "System is currently undergoing scheduled maintenance. Biometric logs are temporarily suspended.",
            "should_retry": False
        }

    # Check if there are any employees registered
    if db.query(models.Employee).count() == 0:
        return {
            "status": "no_employees",
            "message": "Please add the employee",
            "should_retry": False
        }
    
    face_threshold = float(face_threshold_setting.value) if face_threshold_setting else settings.KIOSK_FACE_THRESHOLD
    liveness_threshold = float(liveness_threshold_setting.value) if liveness_threshold_setting else settings.KIOSK_LIVENESS_THRESHOLD
    voice_enabled = voice_greeting_setting.value.lower() == "true" if voice_greeting_setting else True

    # 1. Parse base64 image
    try:
        header, encoded = payload.image.split(",", 1) if "," in payload.image else ("", payload.image)
        img_bytes = base64.b64decode(encoded)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Base64 image data")

    # 2. Detect face
    faces = face_engine.detect_faces(img)
    if not faces:
        return {
            "status": "no_face",
            "message": "No face detected. Frame your face within the scanner.",
            "should_retry": True
        }
    if len(faces) > 1:
        return {
            "status": "multiple_faces",
            "message": "Multiple faces detected. Please scan one person at a time.",
            "should_retry": True
        }
        
    face = faces[0]
    bbox = face["bbox"]
    confidence = face["confidence"]
    landmarks = face["landmarks"]
    
    # 3. Liveness Check
    liveness_score, is_live = face_engine.check_liveness(img, bbox)
    if not is_live and not face_engine.mock_mode:
        # Save spoof log
        log_entry = crud.create_attendance_log(
            db=db,
            employee_id=None,
            camera=payload.camera,
            confidence=confidence,
            liveness_score=liveness_score,
            is_spoof=True,
            status="Spoof Rejected",
            timestamp=now
        )
        _publish_log(log_entry)
        return {
            "status": "spoof_detected",
            "message": "Spoofing attack detected! Verification denied.",
            "confidence": float(confidence),
            "liveness_score": float(liveness_score),
            "should_retry": False
        }

    # 4. Extract Embedding
    aligned = face_engine.align_face(img, landmarks)
    embedding = face_engine.extract_embedding(aligned)
    
    # 5. DB Matching using pgvector / SQLite in-memory fallback
    embedding_list = embedding.tolist()
    
    dialect_name = db.bind.dialect.name
    if dialect_name == "postgresql":
        from pgvector.sqlalchemy import Vector
        from sqlalchemy import cast
        # We query face_embeddings sorting by distance (cosine_distance operator: <=> in SQL, using .op('<=>') in SQLAlchemy)
        # Note: pgvector cosine distance returns (1.0 - cosine_similarity). Closer matches have lower distance.
        match_query = (
            db.query(models.FaceEmbedding, models.FaceEmbedding.embedding.op('<=>')(cast(embedding_list, Vector)).label("distance"))
            .order_by("distance")
            .limit(1)
        )
        match_result = match_query.first()
    else:
        # SQLite / local development fallback: fetch all vectors and compute similarity in memory
        if face_engine.embeddings_cache is None:
            face_engine.load_embeddings_cache(db)
            
        all_embeddings = face_engine.embeddings_cache
        if not all_embeddings:
            match_result = None
        else:
            best_emb = None
            best_dist = 10.0
            
            for emb_record in all_embeddings:
                try:
                    # cached arrays are already numpy arrays
                    db_vec = emb_record["embedding"]
                    sim = face_engine.cosine_similarity(embedding, db_vec)
                    dist = 1.0 - sim
                    if dist < best_dist:
                        best_dist = dist
                        class MockEmb:
                            id = emb_record["id"]
                            employee_id = emb_record["employee_id"]
                        best_emb = MockEmb()
                except Exception as e:
                    logger.error(f"Error comparing local vector: {e}")
                    continue
                    
            if best_emb is not None:
                match_result = (best_emb, best_dist)
            else:
                match_result = None
    
    if not match_result:
        # Database has no enrolled embeddings
        log_entry = crud.create_attendance_log(
            db=db,
            employee_id=None,
            camera=payload.camera,
            confidence=confidence,
            liveness_score=liveness_score,
            is_spoof=False,
            status="Empty Vector Index",
            timestamp=now
        )
        _publish_log(log_entry)
        return {
            "status": "unknown",
            "message": "No employees registered in the system. Please register first.",
            "should_retry": False
        }
        
    db_emb, distance = match_result
    # Similarity = 1 - Distance
    similarity = 1.0 - float(distance)
    
    if similarity < face_threshold:
        # Low confidence match -> Unknown
        log_entry = crud.create_attendance_log(
            db=db,
            employee_id=None,
            camera=payload.camera,
            confidence=similarity,
            liveness_score=liveness_score,
            is_spoof=False,
            status="Unknown Person",
            timestamp=now
        )
        _publish_log(log_entry)
        return {
            "status": "unknown",
            "message": "Face not recognized. Please try again or contact HR.",
            "confidence": similarity,
            "liveness_score": liveness_score,
            "should_retry": True
        }
        
    # Face Matched!
    employee = crud.get_employee_by_id(db, db_emb.employee_id)
    if not employee or employee.status != "Active":
        # Inactive employee
        log_entry = crud.create_attendance_log(
            db=db,
            employee_id=db_emb.employee_id,
            camera=payload.camera,
            confidence=similarity,
            liveness_score=liveness_score,
            is_spoof=False,
            status="Inactive Employee Swiped",
            timestamp=now
        )
        _publish_log(log_entry, employee)
        return {
            "status": "inactive",
            "message": "Employee account is deactivated. Access denied.",
            "should_retry": False
        }
        
    global _last_greeted_employee_id
    should_greet = True
    if _last_greeted_employee_id == employee.id:
        should_greet = False
    else:
        _last_greeted_employee_id = employee.id

    # 6. Mark Attendance
    attendance_record = crud.mark_kiosk_attendance(
        db=db,
        employee_id=employee.id,
        timestamp=now,
        camera=payload.camera,
        confidence=similarity
    )
    
    # Save log
    log_entry = crud.create_attendance_log(
        db=db,
        employee_id=employee.id,
        camera=payload.camera,
        confidence=similarity,
        liveness_score=liveness_score,
        is_spoof=False,
        status="Match Success",
        timestamp=now
    )
    _publish_log(log_entry, employee)
    
    # 7. Generate Greeting Text
    current_hour = now.hour
    if 5 <= current_hour < 12:
        salutation = "Good Morning"
        icon = "☀️"
    elif 12 <= current_hour < 17:
        salutation = "Good Afternoon"
        icon = "🌤️"
    else:
        salutation = "Good Evening"
        icon = "🌙"
        
    is_checkout = attendance_record.check_out is not None
    action_text = "Checkout Recorded Successfully" if is_checkout else "Attendance Recorded Successfully"
    closing_text = "Have a Great Day" if not is_checkout else "Have a Relaxing Evening"
    
    greeting_text = f"Welcome {employee.name}. {salutation}. {action_text}. {closing_text}."
    
    # URL for speech audio download
    tts_url = f"{settings.API_V1_STR}/kiosk/tts?text={urllib.parse.quote(greeting_text)}" if (voice_enabled and should_greet) else None

    return {
        "status": "success",
        "employee": {
            "id": employee.id,
            "employee_id": employee.employee_id,
            "name": employee.name,
            "designation": employee.designation,
            "department": employee.department.name if employee.department else "General"
        },
        "attendance": {
            "date": str(attendance_record.date),
            "check_in": str(attendance_record.check_in.time().strftime("%H:%M:%S")) if attendance_record.check_in else None,
            "check_out": str(attendance_record.check_out.time().strftime("%H:%M:%S")) if attendance_record.check_out else None,
            "status": attendance_record.status
        },
        "confidence": similarity,
        "liveness_score": liveness_score,
        "greeting": {
            "title": f"Welcome, {employee.name}",
            "subtitle": f"{salutation} {icon}",
            "detail": action_text,
            "closing": closing_text
        },
        "tts_url": tts_url
    }

@router.get("/tts")
def play_tts(text: str):
    """
    Synthesizes greeting text and returns it as a playable WAV stream file.
    """
    try:
        wav_path = voice_assistant.generate_speech_file(text)
        return FileResponse(
            path=wav_path,
            media_type="audio/wav",
            filename="greeting.wav"
        )
    except Exception as e:
        logger.error(f"Error serving TTS endpoint: {e}")
        raise HTTPException(status_code=500, detail="Voice generation failed")
