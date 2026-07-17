from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core import security
from app.crud import crud
from app.schemas import schemas
from app.models import models

router = APIRouter()
checker_staff = security.RoleChecker(["Super Admin", "Admin", "HR"])

@router.get("/", response_model=List[schemas.DeviceOut])
def read_devices(
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_staff)
):
    role_name = current_user.role.name if current_user.role else "Employee"
    target_company_id = current_user.company_id if current_user.company_id is not None else company_id
    if role_name == "Super Admin" and target_company_id is None:
        return crud.get_devices(db)
    return crud.get_devices(db, company_id=target_company_id)

@router.post("/", response_model=schemas.DeviceOut, status_code=status.HTTP_201_CREATED)
def register_device(
    request: Request,
    device: schemas.DeviceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["Super Admin", "Admin"]))
):
    company_id = current_user.company_id
    db_device = crud.create_device(db, device=device, company_id=company_id)
    
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Register Kiosk Device",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Registered kiosk device '{device.name}' in branch '{device.branch}'",
        company_id=company_id
    )
    return db_device

@router.put("/{id}", response_model=schemas.DeviceOut)
def update_device_metrics(
    id: int,
    payload: schemas.DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    db_device = crud.get_device_by_id(db, device_id=id)
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    # Check permissions
    if current_user.role.name != "Super Admin" and db_device.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized to configure this device")
        
    updated = crud.update_device(db, device_id=id, device_update=payload)
    return updated
