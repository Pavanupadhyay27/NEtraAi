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
                "images": [
                    {
                        "id": img.id,
                        "file_path": img.file_path,
                        "pose_type": img.pose_type,
                        "created_at": img.created_at.isoformat() if img.created_at else None
                    } for img in employee.images
                ]
            }
        payload = {
            "id": log_obj.id,
            "timestamp": log_obj.timestamp.isoformat() if log_obj.timestamp else None,
            "camera": log_obj.camera,
            "confidence": log_obj.confidence,
            "liveness_score": log_obj.liveness_score,
            "is_spoof": log_obj.is_spoof,
            "status": log_obj.status,
            "image_path": log_obj.image_path,
            "employee": emp_data,
        }
        event_bus.publish_scan_event(payload)
    except Exception as exc:
        logger.warning(f"Failed to publish scan event: {exc}")

class KioskScanRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded image frame (JPEG/PNG data URL)")
    camera: str = Field("Main Kiosk", description="Identifier of the kiosk scanner device")
    confirm_checkout: bool = Field(False, description="Whether the check-out is confirmed by the employee")

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
    liveness_score, is_live = face_engine.check_liveness(img, bbox, threshold=liveness_threshold)
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
            "message": "Liveness check failed! Verification denied.",
            "confidence": float(confidence),
            "liveness_score": float(liveness_score),
            "should_retry": False
        }

    # 4. Extract Embedding
    aligned = face_engine.align_face(img, landmarks)
    embedding = face_engine.extract_embedding(aligned)
    
    # 5. DB Matching: fetch all vectors and compute similarity in memory (completely database-agnostic)
    if face_engine.embeddings_cache is None:
        face_engine.load_embeddings_cache(db)
        
    all_embeddings = face_engine.embeddings_cache
    if not all_embeddings:
        match_result = None
    else:
        try:
            # High-performance vectorized search using NumPy matrix multiplication.
            # ArcFace embeddings are L2-normalized, so cosine similarity is just the dot product.
            embeddings_matrix = np.stack([emb["embedding"] for emb in all_embeddings])  # shape (N, 512)
            similarities = np.dot(embeddings_matrix, embedding)  # shape (N,)
            best_idx = int(np.argmax(similarities))
            best_similarity = float(similarities[best_idx])
            
            best_emb_record = all_embeddings[best_idx]
            class MockEmb:
                id = best_emb_record["id"]
                employee_id = best_emb_record["employee_id"]
            
            # distance = 1 - similarity
            best_dist = 1.0 - best_similarity
            match_result = (MockEmb(), best_dist)
        except Exception as e:
            logger.error(f"Error in vectorized face matching: {e}")
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

    from sqlalchemy import select, and_
    from datetime import time, timedelta

    # 6. Check state of attendance
    stmt = select(models.Attendance).where(
        and_(
            models.Attendance.employee_id == employee.id,
            models.Attendance.date == now.date()
        )
    )
    attendance_record = db.execute(stmt).scalar_one_or_none()

    if not attendance_record:
        # --- First scan of the day: Check-In ---
        start_time_setting = crud.get_setting_by_key(db, "CHECK_IN_START")
        grace_period_setting = crud.get_setting_by_key(db, "GRACE_PERIOD_MINUTES")
        start_str = start_time_setting.value if start_time_setting else "09:00"
        grace_mins = int(grace_period_setting.value) if grace_period_setting else 15
        try:
            hr, mn = map(int, start_str.split(":"))
            check_in_deadline = datetime.combine(now.date(), time(hr, mn)) + timedelta(minutes=grace_mins)
        except Exception:
            check_in_deadline = datetime.combine(now.date(), time(9, 15))

        is_late = now > check_in_deadline
        status = "Late" if is_late else "Present"

        attendance_record = models.Attendance(
            employee_id=employee.id,
            date=now.date(),
            check_in=now,
            late_arrival=is_late,
            status=status
        )
        db.add(attendance_record)
        db.commit()
        db.refresh(attendance_record)

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

        # Generate check-in greeting based on timing
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

        greeting_text = f"Welcome {employee.name}. {salutation}. Attendance Recorded Successfully. Have a Great Day."
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
                "check_out": None,
                "status": attendance_record.status,
                "working_hours": 0.0
            },
            "confidence": similarity,
            "liveness_score": liveness_score,
            "greeting": {
                "title": f"Welcome, {employee.name}",
                "subtitle": f"{salutation} {icon}",
                "detail": "Attendance Recorded Successfully",
                "closing": "Have a Great Day"
            },
            "tts_url": tts_url
        }

    else:
        # --- Attendance record exists for today ---
        if attendance_record.check_out is not None:
            # Already checked out -> Locked!
            # Check if emergency bypass is enabled
            if getattr(attendance_record, "emergency_allowed", False):
                # Emergency check-in!
                attendance_record.check_out = None
                attendance_record.emergency_allowed = False
                db.commit()

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

                greeting_text = f"Welcome {employee.name}. {salutation}. Emergency Attendance Recorded. Have a Great Day."
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
                        "check_out": None,
                        "status": attendance_record.status,
                        "working_hours": 0.0
                    },
                    "confidence": similarity,
                    "liveness_score": liveness_score,
                    "greeting": {
                        "title": f"Welcome back, {employee.name}",
                        "subtitle": f"{salutation} {icon}",
                        "detail": "Emergency Check-In Recorded",
                        "closing": "Have a Great Day"
                    },
                    "tts_url": tts_url
                }
            else:
                # Locked for the day!
                log_entry = crud.create_attendance_log(
                    db=db,
                    employee_id=employee.id,
                    camera=payload.camera,
                    confidence=similarity,
                    liveness_score=liveness_score,
                    is_spoof=False,
                    status="Attendance Locked",
                    timestamp=now
                )
                _publish_log(log_entry, employee)

                return {
                    "status": "locked",
                    "message": "Attendance locked until tomorrow. Emergency entry must be approved by Admin.",
                    "should_retry": False
                }

        else:
            # Checked in, but not checked out yet -> Prompt for check-out
            if not payload.confirm_checkout:
                # Ask user if they want to check out
                # Calculate working hours so far
                diff = now - attendance_record.check_in
                hours = round(diff.total_seconds() / 3600.0, 2)
                
                # Format: only say "Thank you" before checkout confirmation
                greeting_text = "Thank you"
                tts_url = f"{settings.API_V1_STR}/kiosk/tts?text={urllib.parse.quote(greeting_text)}" if (voice_enabled and should_greet) else None

                return {
                    "status": "ask_checkout",
                    "employee": {
                        "id": employee.id,
                        "employee_id": employee.employee_id,
                        "name": employee.name,
                        "designation": employee.designation,
                        "department": employee.department.name if employee.department else "General"
                    },
                    "attendance": {
                        "date": str(attendance_record.date),
                        "check_in": str(attendance_record.check_in.time().strftime("%H:%M:%S")),
                        "status": attendance_record.status
                    },
                    "working_hours_so_far": hours,
                    "confidence": similarity,
                    "liveness_score": liveness_score,
                    "greeting": {
                        "title": "Identity Verified",
                        "subtitle": "Thank You",
                        "detail": "Tap Yes to confirm Check Out",
                        "closing": f"Duration: {hours} hours"
                    },
                    "tts_url": tts_url
                }
            else:
                # User confirmed checkout!
                attendance_record.check_out = now
                diff = now - attendance_record.check_in
                hours = round(diff.total_seconds() / 3600.0, 2)
                attendance_record.working_hours = hours

                # Early departure and overtime
                end_time_setting = crud.get_setting_by_key(db, "CHECK_OUT_END")
                end_str = end_time_setting.value if end_time_setting else "17:00"
                try:
                    ehr, emn = map(int, end_str.split(":"))
                    departure_deadline = datetime.combine(now.date(), time(ehr, emn))
                except Exception:
                    departure_deadline = datetime.combine(now.date(), time(17, 0))
                attendance_record.early_departure = now < departure_deadline
                attendance_record.overtime = max(0.0, round(hours - 8.0, 2))

                # Update status based on hours
                if hours < 8.0:
                    attendance_record.status = "Half Day"
                else:
                    if attendance_record.status in ["Half Day", "Absent"]:
                        attendance_record.status = "Present"

                db.commit()
                db.refresh(attendance_record)

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

                # Play timing greeting after confirmation
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

                greeting_text = f"Welcome {employee.name}. {salutation}. Checkout Recorded Successfully. Have a Relaxing Evening."
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
                        "check_in": str(attendance_record.check_in.time().strftime("%H:%M:%S")),
                        "check_out": str(attendance_record.check_out.time().strftime("%H:%M:%S")),
                        "status": attendance_record.status,
                        "working_hours": hours
                    },
                    "confidence": similarity,
                    "liveness_score": liveness_score,
                    "greeting": {
                        "title": f"Goodbye, {employee.name}",
                        "subtitle": f"{salutation} {icon}",
                        "detail": "Checkout Recorded Successfully",
                        "closing": f"Worked: {hours} hours"
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
