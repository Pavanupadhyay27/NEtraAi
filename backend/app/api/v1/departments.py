from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core import security
from app.crud import crud
from app.schemas import schemas
from app.models import models

router = APIRouter()

# HR, Admin, and Super Admin can manage or view departments
checker_view = security.RoleChecker(["Super Admin", "Admin", "HR"])
checker_manage = security.RoleChecker(["Super Admin", "Admin"])

@router.get("/", response_model=List[schemas.DepartmentOut])
def read_departments(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    return crud.get_departments(db, skip=skip, limit=limit)

@router.get("/{id}", response_model=schemas.DepartmentOut)
def read_department(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    db_dept = crud.get_department_by_id(db, department_id=id)
    if not db_dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return db_dept

@router.post("/", response_model=schemas.DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    request: Request,
    dept: schemas.DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    existing = crud.get_department_by_code(db, code=dept.code)
    if existing:
        raise HTTPException(status_code=400, detail="Department code already exists")
    
    db_dept = crud.create_department(db, dept=dept)
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Create Department",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Created department: {dept.name} ({dept.code})"
    )
    return db_dept

@router.put("/{id}", response_model=schemas.DepartmentOut)
def update_department(
    request: Request,
    id: int,
    dept: schemas.DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    updated = crud.update_department(db, department_id=id, dept=dept)
    if not updated:
        raise HTTPException(status_code=404, detail="Department not found")
        
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Update Department",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Updated department ID: {id}"
    )
    return updated

@router.delete("/{id}")
def delete_department(
    request: Request,
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    success = crud.delete_department(db, department_id=id)
    if not success:
        raise HTTPException(status_code=404, detail="Department not found")
        
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Delete Department",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Deleted department ID: {id}"
    )
    return {"message": "Department deleted successfully"}
