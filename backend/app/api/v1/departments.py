from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional

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
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    target_company_id = current_user.company_id if current_user.company_id is not None else company_id
    return crud.get_departments(db, company_id=target_company_id, skip=skip, limit=limit)

@router.get("/{id}", response_model=schemas.DepartmentOut)
def read_department(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    db_dept = crud.get_department_by_id(db, department_id=id)
    if not db_dept or (current_user.company_id is not None and db_dept.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Department not found")
    return db_dept

@router.post("/", response_model=schemas.DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    request: Request,
    dept: schemas.DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    existing = crud.get_department_by_code(db, code=dept.code, company_id=current_user.company_id)
    if existing:
        raise HTTPException(status_code=400, detail="Department code already exists")
    
    db_dept = crud.create_department(db, dept=dept, company_id=current_user.company_id)
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Create Department",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Created department: {dept.name} ({dept.code})",
        company_id=current_user.company_id
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
    db_dept = crud.get_department_by_id(db, id)
    if not db_dept or (current_user.company_id is not None and db_dept.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Department not found")
        
    updated = crud.update_department(db, department_id=id, dept=dept)
    if not updated:
        raise HTTPException(status_code=404, detail="Department not found")
        
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Update Department",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Updated department ID: {id}",
        company_id=current_user.company_id
    )
    return updated

@router.delete("/{id}")
def delete_department(
    request: Request,
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    db_dept = crud.get_department_by_id(db, id)
    if not db_dept or (current_user.company_id is not None and db_dept.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Department not found")
        
    success = crud.delete_department(db, department_id=id)
    if not success:
        raise HTTPException(status_code=404, detail="Department not found")
        
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Delete Department",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Deleted department ID: {id}",
        company_id=current_user.company_id
    )
    return {"message": "Department deleted successfully"}
