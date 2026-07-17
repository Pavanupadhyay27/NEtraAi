from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core import security
from app.crud import crud
from app.schemas import schemas
from app.models import models

router = APIRouter()

@router.get("/", response_model=List[schemas.NotificationOut])
def read_notifications(
    is_read: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    return crud.get_notifications(
        db, 
        company_id=current_user.company_id, 
        recipient_id=current_user.id, 
        is_read=is_read
    )

@router.post("/", response_model=schemas.NotificationOut, status_code=status.HTTP_201_CREATED)
def post_notification(
    request: Request,
    notification: schemas.NotificationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["Super Admin", "Admin", "HR"]))
):
    company_id = current_user.company_id
    db_ntf = crud.create_notification(db, ntf=notification, company_id=company_id, sender_id=current_user.id)
    
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Broadcast Notification",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Posted notification: '{notification.title}' under category '{notification.category}'",
        company_id=company_id
    )
    return db_ntf

@router.put("/{id}/read", response_model=schemas.NotificationOut)
def mark_read(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    db_ntf = crud.get_notification_by_id(db, notification_id=id)
    if not db_ntf:
        raise HTTPException(status_code=404, detail="Notification not found")
    if db_ntf.company_id != current_user.company_id or (db_ntf.recipient_id is not None and db_ntf.recipient_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to access this notification")
        
    return crud.mark_notification_read(db, notification_id=id)

@router.put("/{id}/archive", response_model=schemas.NotificationOut)
def archive_notification(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    db_ntf = crud.get_notification_by_id(db, notification_id=id)
    if not db_ntf:
        raise HTTPException(status_code=404, detail="Notification not found")
    if db_ntf.company_id != current_user.company_id or (db_ntf.recipient_id is not None and db_ntf.recipient_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to modify this notification")
        
    return crud.archive_notification(db, notification_id=id)
