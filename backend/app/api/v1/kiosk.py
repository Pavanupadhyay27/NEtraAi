from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
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
from app.services.singletons import face_engine
from app.services import geocoding, voice_assistant

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
            "company_id": employee.company_id if employee else None
        }
        event_bus.publish_scan_event(payload)
    except Exception as exc:
        logger.warning(f"Failed to publish scan event: {exc}")

import math

def calculate_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Haversine formula
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

class KioskScanRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded image frame (JPEG/PNG data URL)")
    camera: str = Field("Main Kiosk", description="Identifier of the kiosk scanner device")
    confirm_checkout: bool = Field(False, description="Whether the check-out is confirmed by the employee")
    qr_code: str = Field(None, description="Pre-detected QR code string from frontend")
    qr_only: bool = Field(False, description="If True, only allow QR-based logging and disable face recognition")
    latitude: Optional[float] = Field(None, description="Latitude of the kiosk/device marking attendance")
    longitude: Optional[float] = Field(None, description="Longitude of the kiosk/device marking attendance")


@router.get("/config")
def get_kiosk_config(db: Session = Depends(get_db)):
    loc_setting = crud.get_setting_by_key(db, "LOCATION_ADDRESS")
    return {
        "location_address": loc_setting.value if loc_setting else None
    }


@router.get("/reverse-geocode")
def get_reverse_geocode(lat: float, lng: float):
    address = geocoding.reverse_geocode(lat, lng)
    return {"address": address}

@router.get("/geocode")
def get_geocode(address: str):
    lat, lng = geocoding.geocode_address(address)
    return {"lat": lat, "lng": lng}

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
            
        # Fast downscale for performance
        scale_factor = 1.0
        max_dim = 640
        h, w = img.shape[:2]
        if max(h, w) > max_dim:
            scale_factor = max_dim / max(h, w)
            img = cv2.resize(img, (int(w * scale_factor), int(h * scale_factor)), interpolation=cv2.INTER_AREA)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Base64 image data")

    qr_employee = None
    is_qr_scan = False
    bbox_list = None

    # Check if qr_code was pre-detected by the frontend
    if getattr(payload, "qr_code", None):
        qr_val = payload.qr_code.strip()
        qr_employee = db.query(models.Employee).filter(
            models.Employee.employee_id == qr_val
        ).first()
        if qr_employee:
            is_qr_scan = True
            logger.info(f"QR code pre-detected by frontend: {qr_employee.employee_id}")

    if not is_qr_scan:
        try:
            qr_detector = cv2.QRCodeDetector()
            qr_val, _, _ = qr_detector.detectAndDecode(img)
            if qr_val:
                qr_val = qr_val.strip()
                qr_employee = db.query(models.Employee).filter(
                    models.Employee.employee_id == qr_val
                ).first()
                if qr_employee:
                    is_qr_scan = True
                    logger.info(f"QR code scanned successfully for employee: {qr_employee.employee_id}")
        except Exception as qr_err:
            logger.warning(f"QR code parsing error: {qr_err}")

    if is_qr_scan:
        employee = qr_employee
        similarity = 1.0
        liveness_score = 1.0
        confidence = 1.0
        log_status_success = "Match Success (QR Scanned)"
    else:
        if getattr(payload, "qr_only", False):
            return {
                "status": "unknown",
                "message": "Invalid QR code. Employee badge not found.",
                "should_retry": True
            }
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
        
        # Scale bbox back to original image size for frontend drawing
        if scale_factor != 1.0:
            bbox_list = [float(x) / scale_factor for x in bbox]
        else:
            bbox_list = [float(x) for x in bbox]
            
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
                timestamp=now,
            location_text=location_text if 'location_text' in locals() else None,
            latitude=payload.latitude if hasattr(payload, 'latitude') else None,
            longitude=payload.longitude if hasattr(payload, 'longitude') else None
            )
            _publish_log(log_entry)
            
            # Dispatch Webhook alert
            try:
                from app.services.notifications import trigger_security_alert
                trigger_security_alert(
                    db=db,
                    alert_type="Spoofing Attempt Rejected",
                    details={
                        "camera": payload.camera,
                        "confidence": float(confidence),
                        "liveness_score": float(liveness_score),
                        "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")
                    }
                )
            except Exception as alert_err:
                logger.error(f"Failed to dispatch security alert: {alert_err}")

            return {
                "status": "spoof_detected",
                "message": "Liveness check failed! Verification denied.",
                "confidence": float(confidence),
                "liveness_score": float(liveness_score),
                "should_retry": False,
                "bbox": bbox_list
            }

        # 4. Extract Embedding
        aligned = face_engine.align_face(img, landmarks)
        embedding = face_engine.extract_embedding(aligned)
        
        # 5. DB Matching: query pgvector if postgresql, else fallback to numpy cache-matching
        match_result = None
        is_pg = False
        try:
            is_pg = (db.bind.dialect.name == "postgresql")
        except Exception as dialect_err:
            logger.warning(f"Could not determine DB dialect: {dialect_err}")

        if is_pg:
            try:
                # Run database-level query using pgvector's cosine distance (<=>) operator
                emb_list = embedding.tolist() if isinstance(embedding, np.ndarray) else list(embedding)
                from sqlalchemy import type_coerce, Float
                distance_expr = type_coerce(models.FaceEmbedding.embedding.op('<=>')(emb_list), Float).label('distance')
                query_res = db.query(models.FaceEmbedding, distance_expr).order_by(distance_expr).limit(1).first()
                if query_res:
                    db_emb, distance = query_res
                    match_result = (db_emb, float(distance))
            except Exception as pg_err:
                logger.error(f"Failed to query pgvector: {pg_err}. Falling back to SQLite/NumPy matching.")
                match_result = None

        if match_result is None:
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
                timestamp=now,
            location_text=location_text if 'location_text' in locals() else None,
            latitude=payload.latitude if hasattr(payload, 'latitude') else None,
            longitude=payload.longitude if hasattr(payload, 'longitude') else None
            )
            _publish_log(log_entry)
            return {
                "status": "unknown",
                "message": "No employees registered in the system. Please register first.",
                "should_retry": False,
                "bbox": bbox_list
            }
            
        db_emb, distance = match_result
        # Similarity = 1 - Distance
        similarity = 1.0 - float(distance)
        
        employee = crud.get_employee_by_id(db, db_emb.employee_id) if db_emb else None
        
        if similarity < face_threshold:
            qr_fallback_setting = crud.get_setting_by_key(db, "QR_FALLBACK_ENABLED")
            qr_fallback_enabled = qr_fallback_setting.value.lower() == "true" if qr_fallback_setting else True
            
            if False:  # Disable automatic QR fallback on borderline match
                return {
                    "status": "needs_qr",
                    "message": "Face matched but requires identity verification. Please scan your employee QR code.",
                    "employee": {
                        "id": employee.id,
                        "employee_id": employee.employee_id,
                        "name": employee.name,
                        "designation": employee.designation,
                        "department": employee.department.name if employee.department else "General"
                    },
                    "confidence": similarity,
                    "liveness_score": liveness_score,
                    "should_retry": False,
                    "bbox": bbox_list
                }
                
            # Low confidence match -> Unknown
            log_entry = crud.create_attendance_log(
                db=db,
                employee_id=None,
                camera=payload.camera,
                confidence=similarity,
                liveness_score=liveness_score,
                is_spoof=False,
                status="Unknown Person",
                timestamp=now,
            location_text=location_text if 'location_text' in locals() else None,
            latitude=payload.latitude if hasattr(payload, 'latitude') else None,
            longitude=payload.longitude if hasattr(payload, 'longitude') else None
            )
            _publish_log(log_entry)
            return {
                "status": "unknown",
                "message": "Face not recognized. Please try again or contact HR.",
                "confidence": similarity,
                "liveness_score": liveness_score,
                "should_retry": True,
                "bbox": bbox_list
            }
        log_status_success = "Match Success"

    if not employee or employee.status != "Active":
        # Inactive employee
        emp_id_to_log = employee.id if employee else (db_emb.employee_id if ('db_emb' in locals() and db_emb) else None)
        log_entry = crud.create_attendance_log(
            db=db,
            employee_id=emp_id_to_log,
            camera=payload.camera,
            confidence=similarity,
            liveness_score=liveness_score,
            is_spoof=False,
            status="Inactive Employee Swiped",
            timestamp=now,
            location_text=location_text if 'location_text' in locals() else None,
            latitude=payload.latitude if hasattr(payload, 'latitude') else None,
            longitude=payload.longitude if hasattr(payload, 'longitude') else None
        )
        _publish_log(log_entry, employee)
        
        # Dispatch Webhook alert
        try:
            from app.services.notifications import trigger_security_alert
            trigger_security_alert(
                db=db,
                alert_type="Deactivated Employee Access Attempt",
                details={
                    "camera": payload.camera,
                    "confidence": float(similarity),
                    "liveness_score": float(liveness_score),
                    "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
                    "employee_name": employee.name if employee else "Unknown",
                    "employee_id": employee.employee_id if employee else "Unknown"
                }
            )
        except Exception as alert_err:
            logger.error(f"Failed to dispatch security alert: {alert_err}")

        return {
            "status": "inactive",
            "message": "Employee account is deactivated. Access denied.",
            "should_retry": False,
            "bbox": bbox_list
        }
        
    # Geofencing validation check & Reverse Geocoding
    loc_enabled_setting = crud.get_setting_by_key(db, "LOCATION_RESTRICTION_ENABLED")
    loc_enabled = loc_enabled_setting.value.lower() == "true" if loc_enabled_setting else False
    
    location_text = None
    if payload.latitude is not None and payload.longitude is not None:
        location_text = geocoding.reverse_geocode(payload.latitude, payload.longitude)

    # 1. WFH Check
    if getattr(employee, "allow_wfh", False):
        if payload.latitude is None or payload.longitude is None:
            log_entry = crud.create_attendance_log(
                db=db, employee_id=employee.id, camera=payload.camera,
                confidence=similarity if 'similarity' in locals() else 1.0,
                liveness_score=liveness_score if 'liveness_score' in locals() else 1.0,
                is_spoof=False, status="WFH Location Missing", timestamp=now,
                location_text=location_text, latitude=payload.latitude, longitude=payload.longitude
            )
            _publish_log(log_entry, employee)
            return {
                "status": "location_error",
                "message": "GPS coordinates are required to mark WFH attendance.",
                "should_retry": False, "bbox": bbox_list
            }
            
        if employee.wfh_lat and employee.wfh_lng:
            dist = calculate_distance_meters(payload.latitude, payload.longitude, employee.wfh_lat, employee.wfh_lng)
            if dist > 500.0:  # 500m threshold
                log_entry = crud.create_attendance_log(
                    db=db, employee_id=employee.id, camera=payload.camera,
                    confidence=similarity if 'similarity' in locals() else 1.0,
                    liveness_score=liveness_score if 'liveness_score' in locals() else 1.0,
                    is_spoof=False, status="Outside WFH Bounds", timestamp=now,
                    location_text=location_text, latitude=payload.latitude, longitude=payload.longitude
                )
                _publish_log(log_entry, employee)
                return {
                    "status": "location_error",
                    "message": f"Outside allowed WFH area. Distance: {dist:.1f}m. Max radius: 500m.",
                    "should_retry": False, "bbox": bbox_list
                }
    
    # 2. Office Check (if not WFH)
    elif loc_enabled:
        if payload.latitude is None or payload.longitude is None:
            log_entry = crud.create_attendance_log(
                db=db,
                employee_id=employee.id,
                camera=payload.camera,
                confidence=similarity if 'similarity' in locals() else 1.0,
                liveness_score=liveness_score if 'liveness_score' in locals() else 1.0,
                is_spoof=False,
                status="Location Missing",
                timestamp=now,
                location_text=location_text, latitude=payload.latitude, longitude=payload.longitude
            )
            _publish_log(log_entry, employee)
            return {
                "status": "location_error",
                "message": "GPS coordinates are required to mark attendance.",
                "should_retry": False,
                "bbox": bbox_list
            }

        loc_lat_setting = crud.get_setting_by_key(db, "LOCATION_LATITUDE")
        loc_lon_setting = crud.get_setting_by_key(db, "LOCATION_LONGITUDE")
        loc_rad_setting = crud.get_setting_by_key(db, "LOCATION_RADIUS_METERS")

        try:
            office_lat = float(loc_lat_setting.value) if loc_lat_setting else 0.0
            office_lon = float(loc_lon_setting.value) if loc_lon_setting else 0.0
            allowed_radius = float(loc_rad_setting.value) if loc_rad_setting else 50.0
        except ValueError:
            office_lat = 0.0
            office_lon = 0.0
            allowed_radius = 50.0

        dist = calculate_distance_meters(payload.latitude, payload.longitude, office_lat, office_lon)
        if dist > allowed_radius:
            log_entry = crud.create_attendance_log(
                db=db,
                employee_id=employee.id,
                camera=payload.camera,
                confidence=similarity if 'similarity' in locals() else 1.0,
                liveness_score=liveness_score if 'liveness_score' in locals() else 1.0,
                is_spoof=False,
                status="Outside Office Bounds",
                timestamp=now,
                location_text=location_text, latitude=payload.latitude, longitude=payload.longitude
            )
            _publish_log(log_entry, employee)
            return {
                "status": "location_error",
                "message": f"Outside allowed area. Distance: {dist:.1f}m. Max radius: {allowed_radius}m.",
                "should_retry": False,
                "bbox": bbox_list
            }
        
    global _last_greeted_employee_id
    should_greet = True
    if _last_greeted_employee_id == employee.id:
        should_greet = False
    else:
        _last_greeted_employee_id = employee.id

    from sqlalchemy import select, and_
    from datetime import time, timedelta

    # Resolve shift details for employee
    if employee.shift:
        shift_start = employee.shift.start_time
        shift_end = employee.shift.end_time
        grace_mins = employee.shift.grace_period_minutes
    else:
        start_time_setting = crud.get_setting_by_key(db, "CHECK_IN_START")
        end_time_setting = crud.get_setting_by_key(db, "CHECK_OUT_END")
        grace_period_setting = crud.get_setting_by_key(db, "GRACE_PERIOD_MINUTES")
        
        start_str = start_time_setting.value if start_time_setting else "09:00"
        end_str = end_time_setting.value if end_time_setting else "17:00"
        grace_mins = int(grace_period_setting.value) if grace_period_setting else 15
        
        try:
            hr, mn = map(int, start_str.split(":"))
            shift_start = time(hr, mn)
        except Exception:
            shift_start = time(9, 0)
            
        try:
            hr, mn = map(int, end_str.split(":"))
            shift_end = time(hr, mn)
        except Exception:
            shift_end = time(17, 0)

    # 6. Check state of attendance
    stmt = select(models.Attendance).where(
        and_(
            models.Attendance.employee_id == employee.id,
            models.Attendance.date == now.date()
        )
    )
    attendance_record = db.execute(stmt).scalars().first()

    if not attendance_record:
        # --- First scan of the day: Check-In ---
        check_in_deadline = datetime.combine(now.date(), shift_start) + timedelta(minutes=grace_mins)
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
            status=log_status_success,
            timestamp=now,
            location_text=location_text,
            latitude=payload.latitude,
            longitude=payload.longitude
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
            "tts_url": tts_url,
            "bbox": bbox_list
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
                    status=log_status_success,
                    timestamp=now,
            location_text=location_text if 'location_text' in locals() else None,
            latitude=payload.latitude if hasattr(payload, 'latitude') else None,
            longitude=payload.longitude if hasattr(payload, 'longitude') else None
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
                    "tts_url": tts_url,
                    "bbox": bbox_list
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
                    timestamp=now,
            location_text=location_text if 'location_text' in locals() else None,
            latitude=payload.latitude if hasattr(payload, 'latitude') else None,
            longitude=payload.longitude if hasattr(payload, 'longitude') else None
                )
                _publish_log(log_entry, employee)

                return {
                    "status": "locked",
                    "message": "Attendance locked until tomorrow. Emergency entry must be approved by Admin.",
                    "should_retry": False,
                    "bbox": bbox_list
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
                    "tts_url": tts_url,
                    "bbox": bbox_list
                }
            else:
                # User confirmed checkout!
                attendance_record.check_out = now
                diff = now - attendance_record.check_in
                hours = round(diff.total_seconds() / 3600.0, 2)
                attendance_record.working_hours = hours

                # Early departure and overtime
                departure_deadline = datetime.combine(now.date(), shift_end)
                attendance_record.early_departure = now < departure_deadline
                
                dt_start = datetime.combine(now.date(), shift_start)
                dt_end = datetime.combine(now.date(), shift_end)
                if dt_end < dt_start:
                    dt_end += timedelta(days=1)
                shift_duration_hours = (dt_end - dt_start).total_seconds() / 3600.0
                
                attendance_record.overtime = max(0.0, round(hours - shift_duration_hours, 2))

                # Update status based on hours: Half Day if hours < 50% of shift duration
                half_day_threshold = shift_duration_hours * 0.5 if shift_duration_hours > 0 else 4.0
                if hours < half_day_threshold:
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
                    status=log_status_success,
                    timestamp=now,
            location_text=location_text if 'location_text' in locals() else None,
            latitude=payload.latitude if hasattr(payload, 'latitude') else None,
            longitude=payload.longitude if hasattr(payload, 'longitude') else None
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
                    "tts_url": tts_url,
                    "bbox": bbox_list
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

class KioskQRConfirmRequest(BaseModel):
    employee_id: int
    qr_code: str
    camera: str = Field("Main Kiosk", description="Identifier of the kiosk scanner device")
    latitude: Optional[float] = Field(None, description="Latitude of the kiosk/device marking attendance")
    longitude: Optional[float] = Field(None, description="Longitude of the kiosk/device marking attendance")

@router.post("/confirm-qr")
def confirm_qr(
    payload: KioskQRConfirmRequest,
    db: Session = Depends(get_db)
):
    employee = crud.get_employee_by_id(db, payload.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    # Geofencing check for QR Confirmation
    loc_enabled_setting = crud.get_setting_by_key(db, "LOCATION_RESTRICTION_ENABLED")
    loc_enabled = loc_enabled_setting.value.lower() == "true" if loc_enabled_setting else False

    if loc_enabled and not getattr(employee, "allow_wfh", False):
        if payload.latitude is None or payload.longitude is None:
            crud.create_attendance_log(
                db=db,
                employee_id=employee.id,
                camera=payload.camera,
                confidence=1.0,
                liveness_score=1.0,
                is_spoof=False,
                status="Location Missing (QR)",
                timestamp=datetime.now()
            )
            raise HTTPException(status_code=400, detail="GPS coordinates are required to mark attendance.")

        loc_lat_setting = crud.get_setting_by_key(db, "LOCATION_LATITUDE")
        loc_lon_setting = crud.get_setting_by_key(db, "LOCATION_LONGITUDE")
        loc_rad_setting = crud.get_setting_by_key(db, "LOCATION_RADIUS_METERS")

        try:
            office_lat = float(loc_lat_setting.value) if loc_lat_setting else 0.0
            office_lon = float(loc_lon_setting.value) if loc_lon_setting else 0.0
            allowed_radius = float(loc_rad_setting.value) if loc_rad_setting else 50.0
        except ValueError:
            office_lat = 0.0
            office_lon = 0.0
            allowed_radius = 50.0

        dist = calculate_distance_meters(payload.latitude, payload.longitude, office_lat, office_lon)
        if dist > allowed_radius:
            crud.create_attendance_log(
                db=db,
                employee_id=employee.id,
                camera=payload.camera,
                confidence=1.0,
                liveness_score=1.0,
                is_spoof=False,
                status="Outside Office Bounds (QR)",
                timestamp=datetime.now()
            )
            raise HTTPException(status_code=400, detail=f"Outside allowed area. Distance: {dist:.1f}m. Max radius: {allowed_radius}m.")
        
    if payload.qr_code.strip() != employee.employee_id.strip():
        # Audit log for failed verification
        log_entry = crud.create_attendance_log(
            db=db,
            employee_id=employee.id,
            camera=payload.camera,
            confidence=0.55,
            liveness_score=1.0,
            is_spoof=False,
            status="QR Verification Failed",
            timestamp=datetime.now()
        )
        _publish_log(log_entry, employee)
        raise HTTPException(status_code=400, detail="QR Code verification failed. Badge does not match matched face.")
        
    now = datetime.now()
    attendance_record = crud.mark_kiosk_attendance(
        db=db,
        employee_id=employee.id,
        timestamp=now,
        camera=payload.camera,
        confidence=1.0
    )
    
    log_entry = crud.create_attendance_log(
        db=db,
        employee_id=employee.id,
        camera=payload.camera,
        confidence=1.0,
        liveness_score=1.0,
        is_spoof=False,
        status="Match Success (QR Verified)",
        timestamp=now,
            location_text=location_text if 'location_text' in locals() else None,
            latitude=payload.latitude if hasattr(payload, 'latitude') else None,
            longitude=payload.longitude if hasattr(payload, 'longitude') else None
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
        
    voice_greeting_setting = crud.get_setting_by_key(db, "VOICE_GREETING_ENABLED")
    voice_enabled = voice_greeting_setting.value.lower() == "true" if voice_greeting_setting else True
    is_checkout = attendance_record.check_out is not None
    
    if is_checkout:
        greeting_text = f"Welcome {employee.name}. {salutation}. Checkout Recorded Successfully. Have a Relaxing Evening."
        detail_msg = "Checkout Recorded Successfully"
        closing_msg = f"Worked: {attendance_record.working_hours} hours"
    else:
        greeting_text = f"Welcome {employee.name}. {salutation}. Attendance Recorded Successfully. Have a Great Day."
        detail_msg = "Attendance Recorded Successfully"
        closing_msg = "Have a Great Day"
        
    tts_url = f"{settings.API_V1_STR}/kiosk/tts?text={urllib.parse.quote(greeting_text)}" if voice_enabled else None
    
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
            "status": attendance_record.status,
            "working_hours": attendance_record.working_hours
        },
        "confidence": 1.0,
        "liveness_score": 1.0,
        "greeting": {
            "title": f"Verified, {employee.name}",
            "subtitle": f"{salutation} {icon}",
            "detail": detail_msg,
            "closing": closing_msg
        },
        "tts_url": tts_url
    }
