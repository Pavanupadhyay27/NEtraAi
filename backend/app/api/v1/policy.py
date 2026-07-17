from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.core.database import get_db
from app.core import security
from app.crud import crud
from app.models import models

router = APIRouter()
checker_admin = security.RoleChecker(["Super Admin", "Admin"])

@router.get("/rules")
def get_attendance_rules(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_admin)
):
    company_id = current_user.company_id
    threshold = crud.get_setting_by_key(db, "face_match_threshold", company_id)
    lat = crud.get_setting_by_key(db, "office_latitude", company_id)
    lng = crud.get_setting_by_key(db, "office_longitude", company_id)
    radius = crud.get_setting_by_key(db, "geofence_radius_meters", company_id)
    
    return {
        "face_match_threshold": float(threshold.value) if threshold else 0.6,
        "office_latitude": float(lat.value) if lat else 0.0,
        "office_longitude": float(lng.value) if lng else 0.0,
        "geofence_radius_meters": float(radius.value) if radius else 500.0,
        "policy_version": "v2.0-Enterprise"
    }

@router.post("/rules")
def update_attendance_rules(
    request: Request,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_admin)
):
    company_id = current_user.company_id
    
    for key, value in payload.items():
        if key in ["face_match_threshold", "office_latitude", "office_longitude", "geofence_radius_meters"]:
            crud.set_setting(db, key=key, value=str(value), company_id=company_id)
            
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Configure Attendance Rules",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Configured policy rules: {list(payload.keys())}",
        company_id=company_id
    )
    return {"message": "Attendance rules updated successfully"}
