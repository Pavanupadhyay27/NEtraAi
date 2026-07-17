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
from app.services import geocoding

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
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    target_company_id = current_user.company_id if current_user.company_id is not None else company_id
    return crud.get_employees(
        db, company_id=target_company_id, skip=skip, limit=limit, search=search, department_id=department_id, status=status
    )

@router.get("/count")
def get_employee_count(
    search: Optional[str] = None,
    department_id: Optional[int] = None,
    status: Optional[str] = None,
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    target_company_id = current_user.company_id if current_user.company_id is not None else company_id
    count = crud.count_employees(db, company_id=target_company_id, search=search, department_id=department_id, status=status)
    return {"count": count}


# --- Leave Requests Endpoints ---

@router.get("/leaves", response_model=List[schemas.LeaveRequestOut])
def list_leaves(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["Super Admin", "Admin", "HR", "Employee"]))
):
    if current_user.role.name == "Employee":
        if not current_user.employee:
            raise HTTPException(status_code=400, detail="User is not linked to an employee profile")
        target_employee_id = current_user.employee.id
    else:
        target_employee_id = employee_id

    if target_employee_id:
        emp = crud.get_employee_by_id(db, target_employee_id)
        if not emp or (current_user.company_id is not None and emp.company_id != current_user.company_id):
            raise HTTPException(status_code=404, detail="Employee not found")
        return crud.get_leave_requests(db, employee_id=target_employee_id)
    
    leaves = crud.get_leave_requests(db)
    if current_user.company_id is not None:
        leaves = [l for l in leaves if l.employee and l.employee.company_id == current_user.company_id]
    return leaves


@router.post("/leaves", response_model=schemas.LeaveRequestOut, status_code=status.HTTP_201_CREATED)
def apply_leave(
    req: schemas.LeaveRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["Super Admin", "Admin", "HR", "Employee"]))
):
    if current_user.role.name == "Employee":
        if not current_user.employee:
            raise HTTPException(status_code=400, detail="User is not linked to an employee profile")
        if req.employee_id != current_user.employee.id:
            raise HTTPException(status_code=403, detail="You can only apply leave for yourself")
    else:
        emp = crud.get_employee_by_id(db, req.employee_id)
        if not emp or (current_user.company_id is not None and emp.company_id != current_user.company_id):
            raise HTTPException(status_code=404, detail="Employee not found")

    return crud.create_leave_request(db, req, employee_id=req.employee_id)


@router.put("/leaves/{id}", response_model=schemas.LeaveRequestOut)
def update_leave(
    id: int,
    data: schemas.LeaveRequestUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["Super Admin", "Admin", "HR"]))
):
    db_req = db.get(models.LeaveRequest, id)
    if not db_req:
        raise HTTPException(status_code=404, detail="Leave request not found")
        
    emp = crud.get_employee_by_id(db, db_req.employee_id)
    if not emp or (current_user.company_id is not None and emp.company_id != current_user.company_id):
        raise HTTPException(status_code=403, detail="Access denied")

    updated = crud.update_leave_status(db, id=id, status=data.status, admin_user_id=current_user.id)
    if not updated:
      raise HTTPException(status_code=404, detail="Leave request not found")
    return updated


@router.delete("/leaves/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_leave(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["Super Admin", "Admin", "HR", "Employee"]))
):
    db_req = db.get(models.LeaveRequest, id)
    if not db_req:
        raise HTTPException(status_code=404, detail="Leave request not found")
        
    if current_user.role.name == "Employee":
        if not current_user.employee or db_req.employee_id != current_user.employee.id:
            raise HTTPException(status_code=403, detail="You can only withdraw your own leave requests")
        if db_req.status != "Pending":
            raise HTTPException(status_code=400, detail="You can only withdraw pending leave requests")
    else:
        emp = crud.get_employee_by_id(db, db_req.employee_id)
        if not emp or (current_user.company_id is not None and emp.company_id != current_user.company_id):
            raise HTTPException(status_code=403, detail="Access denied")
            
    db.delete(db_req)
    db.commit()
    return None


@router.get("/{id}", response_model=schemas.EmployeeOut)
def read_employee(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    db_emp = crud.get_employee_by_id(db, id=id)
    if not db_emp or (current_user.company_id is not None and db_emp.company_id != current_user.company_id):
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

    # Check duplicate name (case-insensitive, scoped to company)
    existing_name = crud.get_employee_by_name(db, name=emp.name, company_id=current_user.company_id)
    if existing_name:
        raise HTTPException(status_code=400, detail="An employee with this name is already registered")

    # Check duplicate phone (scoped to company)
    if emp.phone:
        existing_phone = crud.get_employee_by_phone(db, phone=emp.phone, company_id=current_user.company_id)
        if existing_phone:
            raise HTTPException(status_code=400, detail="This phone number is already registered to another employee")
        
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
        db_user = crud.create_user(db, user_in, company_id=current_user.company_id)
        user_id = db_user.id
        
    if emp.allow_wfh and emp.wfh_address:
        lat, lng = geocoding.geocode_address(emp.wfh_address)
        emp.wfh_lat = lat
        emp.wfh_lng = lng
    else:
        emp.wfh_lat = None
        emp.wfh_lng = None
        
    db_emp = crud.create_employee(db, emp=emp, user_id=user_id, company_id=current_user.company_id)
    
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Create Employee",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Created employee: {emp.name} ({emp.employee_id})",
        company_id=current_user.company_id
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
    db_emp = crud.get_employee_by_id(db, id)
    if not db_emp or (current_user.company_id is not None and db_emp.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Employee not found")
        
    if emp.allow_wfh is not None:
        if emp.allow_wfh and emp.wfh_address:
            if emp.wfh_lat is None or emp.wfh_lng is None:
                lat, lng = geocoding.geocode_address(emp.wfh_address)
                emp.wfh_lat = lat
                emp.wfh_lng = lng
        elif not emp.allow_wfh:
            # Clear location if wfh disabled
            emp.wfh_address = None
            emp.wfh_lat = None
            emp.wfh_lng = None
            
    updated = crud.update_employee(db, id=id, emp=emp)
    if not updated:
        raise HTTPException(status_code=404, detail="Employee not found")

    if emp.status is not None and db_emp.user_id:
        db_user = db.get(models.User, db_emp.user_id)
        if db_user:
            db_user.is_active = (emp.status == "Active")
            db.add(db_user)
            db.commit()
        
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Update Employee",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Updated employee ID: {id}",
        company_id=current_user.company_id
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
    if not db_emp or (current_user.company_id is not None and db_emp.company_id != current_user.company_id):
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
        details=f"Deleted employee ID: {id}",
        company_id=current_user.company_id
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
            
            # Resolve department (scoped by company)
            dept_id = None
            if "department_code" in df.columns and pd.notna(row["department_code"]):
                dept_code = str(row["department_code"]).strip()
                dept = crud.get_department_by_code(db, code=dept_code, company_id=current_user.company_id)
                if dept:
                    dept_id = dept.id
            
            # Check duplicates (scoped to company name check)
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
                crud.create_employee(db, emp=emp_in, company_id=current_user.company_id)
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
            details=f"Imported {imported_count} employees, skipped {skipped_count}",
            company_id=current_user.company_id
        )
        
        return {
            "message": f"Import completed. Successfully imported {imported_count} employees.",
            "skipped": skipped_count,
            "errors": errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV file: {str(e)}")

@router.post("/{id}/avatar")
async def upload_avatar(
    id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    """
    Manually upload a profile avatar for an employee without facial enrollment.
    """
    db_emp = crud.get_employee_by_id(db, id)
    if not db_emp or (current_user.company_id is not None and db_emp.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Employee not found")
        
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
        
    image_bytes = await file.read()
    
    # Check if a Front image already exists
    front_img = db.query(models.EmployeeImage).filter(
        models.EmployeeImage.employee_id == db_emp.id,
        models.EmployeeImage.pose_type == "Front"
    ).first()
    
    if front_img:
        front_img.image_bytes = image_bytes
    else:
        new_img = models.EmployeeImage(
            employee_id=db_emp.id,
            file_path=f"uploads/{db_emp.employee_id}/front.jpg", # virtual path
            pose_type="Front",
            image_bytes=image_bytes
        )
        db.add(new_img)
        
    db.commit()
    
    # Invalidate face cache in case this changes face embeddings
    face_engine.invalidate_cache()
    
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Manual Avatar Upload",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Manually uploaded avatar for employee ID: {id}",
        company_id=current_user.company_id
    )
    
    return {"message": "Avatar uploaded successfully"}

