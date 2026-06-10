from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
from datetime import datetime, date
import io

from app.core.database import get_db
from app.core import security
from app.crud import crud
from app.schemas import schemas
from app.models import models
from app.services.singletons import face_engine

router = APIRouter()

checker_view = security.RoleChecker(["Super Admin", "Admin", "HR"])
checker_manage = security.RoleChecker(["Super Admin", "Admin"])

@router.get("/", response_model=List[schemas.EmployeeOut])
def read_employees(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    department_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    return crud.get_employees(
        db, skip=skip, limit=limit, search=search, department_id=department_id, status=status
    )

@router.get("/count")
def get_employee_count(
    search: Optional[str] = None,
    department_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    count = crud.count_employees(db, search=search, department_id=department_id, status=status)
    return {"count": count}

@router.get("/{id}", response_model=schemas.EmployeeOut)
def read_employee(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    db_emp = crud.get_employee_by_id(db, id=id)
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return db_emp

@router.post("/", response_model=schemas.EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(
    request: Request,
    emp: schemas.EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    # Check duplicates
    existing_id = crud.get_employee_by_uuid(db, employee_id=emp.employee_id)
    if existing_id:
        raise HTTPException(status_code=400, detail="Employee ID already exists")
        
    existing_email = crud.get_employee_by_email(db, email=emp.email)
    if existing_email:
        raise HTTPException(status_code=400, detail="Employee email already exists")
        
    user_id = None
    if emp.create_user_login:
        if not emp.password:
            raise HTTPException(status_code=400, detail="Password is required for creating user login")
            
        # Check user duplicate
        existing_user = crud.get_user_by_email(db, email=emp.email)
        if existing_user:
            raise HTTPException(status_code=400, detail="User account with this email already exists")
            
        # Get employee role
        role_emp = crud.get_role_by_name(db, "Employee")
        if not role_emp:
            role_emp = crud.create_role(db, "Employee", "Standard employee role")
            
        user_in = schemas.UserCreate(
            email=emp.email,
            password=emp.password,
            role_id=role_emp.id
        )
        db_user = crud.create_user(db, user_in)
        user_id = db_user.id
        
    db_emp = crud.create_employee(db, emp=emp, user_id=user_id)
    
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Create Employee",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Created employee: {emp.name} ({emp.employee_id})"
    )
    return db_emp

@router.put("/{id}", response_model=schemas.EmployeeOut)
def update_employee(
    request: Request,
    id: int,
    emp: schemas.EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    updated = crud.update_employee(db, id=id, emp=emp)
    if not updated:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Update Employee",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Updated employee ID: {id}"
    )
    return updated

@router.delete("/{id}")
def delete_employee(
    request: Request,
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    db_emp = crud.get_employee_by_id(db, id)
    if not db_emp:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    # Clear face embeddings from disk and database first
    crud.delete_face_embeddings(db, employee_id=db_emp.id)
    face_engine.invalidate_cache()
    
    success = crud.delete_employee(db, id=id)
    if not success:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Delete Employee",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Deleted employee ID: {id}"
    )
    return {"message": "Employee deleted successfully"}

@router.post("/import-csv")
def import_csv(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    """
    Bulk import employees from a CSV file.
    Expected CSV columns: employee_id, name, email, phone, designation, joining_date (YYYY-MM-DD), department_code
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Uploaded file must be a CSV")
        
    try:
        contents = file.file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        required_cols = ["employee_id", "name", "email"]
        for col in required_cols:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Missing required column: {col}")
                
        imported_count = 0
        skipped_count = 0
        errors = []
        
        for idx, row in df.iterrows():
            emp_id = str(row["employee_id"]).strip()
            name = str(row["name"]).strip()
            email = str(row["email"]).strip()
            phone = str(row.get("phone", "")).strip() if pd.notna(row.get("phone")) else None
            designation = str(row.get("designation", "")).strip() if pd.notna(row.get("designation")) else None
            
            # Date handling
            j_date = date.today()
            if "joining_date" in df.columns and pd.notna(row["joining_date"]):
                try:
                    j_date = pd.to_datetime(row["joining_date"]).date()
                except Exception:
                    pass
            
            # Resolve department
            dept_id = None
            if "department_code" in df.columns and pd.notna(row["department_code"]):
                dept_code = str(row["department_code"]).strip()
                dept = crud.get_department_by_code(db, code=dept_code)
                if dept:
                    dept_id = dept.id
            
            # Check duplicates
            if crud.get_employee_by_uuid(db, employee_id=emp_id) or crud.get_employee_by_email(db, email=email):
                skipped_count += 1
                continue
                
            try:
                emp_in = schemas.EmployeeCreate(
                    employee_id=emp_id,
                    name=name,
                    email=email,
                    phone=phone,
                    designation=designation,
                    joining_date=j_date,
                    status="Active",
                    department_id=dept_id,
                    create_user_login=False
                )
                crud.create_employee(db, emp=emp_in)
                imported_count += 1
            except Exception as e:
                errors.append(f"Row {idx+2}: {str(e)}")
                skipped_count += 1
                
        crud.create_audit_log(
            db=db,
            user_id=current_user.id,
            action="Bulk Import CSV",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            details=f"Imported {imported_count} employees, skipped {skipped_count}"
        )
        
        return {
            "message": f"Import completed. Successfully imported {imported_count} employees.",
            "skipped": skipped_count,
            "errors": errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV file: {str(e)}")
