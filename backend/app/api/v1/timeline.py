from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core import security
from app.crud import crud
from app.schemas import schemas
from app.models import models

router = APIRouter()
checker_staff = security.RoleChecker(["Super Admin", "Admin", "HR"])

@router.get("/", response_model=List[schemas.ActivityTimelineOut])
def read_activity_timeline(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_staff)
):
    company_id = current_user.company_id
    if current_user.role.name == "Super Admin":
        # Super Admins can see global platform timeline across all companies
        return crud.get_activity_timeline(db, entity_type=entity_type, entity_id=entity_id, limit=limit)
        
    return crud.get_activity_timeline(
        db, 
        company_id=company_id, 
        entity_type=entity_type, 
        entity_id=entity_id, 
        limit=limit
    )
