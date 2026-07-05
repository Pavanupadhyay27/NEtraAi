from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core import security
from app.crud import crud
from app.schemas import schemas
from app.models import models

router = APIRouter()

# Restrict setting adjustments to Super Admins & Admins
checker_manage = security.RoleChecker(["Super Admin", "Admin"])

@router.get("/", response_model=List[schemas.SettingOut])
def read_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    return crud.get_settings(db, company_id=current_user.company_id)

@router.put("/{key}", response_model=schemas.SettingOut)
def update_setting(
    request: Request,
    key: str,
    payload: schemas.SettingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    setting = crud.get_setting_by_key(db, key=key, company_id=current_user.company_id)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
        
    old_value = setting.value
    updated = crud.set_setting(db, key=key, value=payload.value, company_id=current_user.company_id)
    
    # Dynamically restart RTSP processor if RTSP settings were updated
    if key in ["RTSP_STREAM_ENABLED", "RTSP_STREAM_URL"]:
        try:
            from app.services.singletons import rtsp_processor
            rtsp_processor.stop()
            rtsp_processor.start()
        except Exception as rtsp_err:
            import logging
            logging.getLogger("SettingsAPI").error(f"Failed to dynamically restart RTSP processor: {rtsp_err}")

    # Audit log setting change
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Update Setting",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Updated setting '{key}' from '{old_value}' to '{payload.value}'",
        company_id=current_user.company_id
    )
    return updated
