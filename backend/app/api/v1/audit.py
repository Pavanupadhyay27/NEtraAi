from fastapi import APIRouter, Depends, HTTPException, status
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
