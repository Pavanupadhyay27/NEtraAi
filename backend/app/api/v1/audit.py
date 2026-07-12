from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core import security
from app.crud import crud
from app.schemas import schemas
from app.models import models

router = APIRouter()

# Restrict viewing audit logs to Super Admins & Admins
checker_view = security.RoleChecker(["Super Admin", "Admin"])

@router.get("/", response_model=List[schemas.AuditLogOut])
def read_audit_logs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    return crud.get_audit_logs(db, skip=skip, limit=limit)

@router.delete("/")
def delete_all_audit_logs(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    deleted_count = crud.clear_all_audit_logs(db)
    
    # Audit log the deletion itself
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Clear Audit Logs",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Cleared {deleted_count} system audit logs."
    )
    
    return {"message": "Audit logs cleared successfully", "deleted_count": deleted_count}

