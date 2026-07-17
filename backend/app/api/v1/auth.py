from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from datetime import timedelta
from jose import jwt, JWTError

from app.core.database import get_db
from app.core import security
from app.core.config import settings
from app.crud import crud
from app.schemas import schemas
from app.models import models

from app.core.rate_limiter import check_login_rate_limit

router = APIRouter()

@router.post("/login", response_model=schemas.Token, dependencies=[Depends(check_login_rate_limit)])
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not crud.verify_password(form_data.password, user.hashed_password):
        # Log failed login attempt
        crud.create_audit_log(
            db=db,
            user_id=None,
            action="Failed Login Attempt",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            details=f"Attempted email: {form_data.username}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        role_name = user.role.name if user.role else "Employee"
        if role_name in ["Admin", "HR"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your admin account is pending approval by the Super Admin."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )
        
    role_name = user.role.name if user.role else "Employee"
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.email, role=role_name, expires_delta=access_token_expires
    )
    refresh_token = security.create_refresh_token(
        user.email, role=role_name
    )
    
    # Audit log login
    crud.create_audit_log(
        db=db,
        user_id=user.id,
        action="User Login",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Successful login for user email {user.email}"
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/refresh", response_model=schemas.Token)
def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate refresh token",
    )
    try:
        payload = jwt.decode(
            refresh_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "refresh":
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = crud.get_user_by_email(db, email=email)
    if user is None or not user.is_active:
        raise credentials_exception
        
    role_name = user.role.name if user.role else "Employee"
    access_token = security.create_access_token(
        user.email, role=role_name
    )
    new_refresh_token = security.create_refresh_token(
        user.email, role=role_name
    )
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@router.get("/me", response_model=schemas.UserOut)
def read_users_me(
    current_user: models.User = Depends(security.get_current_user)
):
    return current_user

@router.post("/register-admin", status_code=status.HTTP_201_CREATED)
def register_admin(
    payload: schemas.AdminRegister,
    db: Session = Depends(get_db)
):
    # 1. Check if company name already exists
    existing_company = crud.get_company_by_name(db, name=payload.company_name)
    if existing_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company name already registered"
        )
        
    # 2. Check if email already exists
    existing_user = crud.get_user_by_email(db, email=payload.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address already registered"
        )
        
    # 3. Create company with "Pending Approval" status
    company_create = schemas.CompanyCreate(
        name=payload.company_name,
        status="Pending Approval",
        admin_email=payload.email,
        phone=payload.phone,
        address=payload.address,
        max_employees=100,
        available_tokens=1000
    )
    db_company = crud.create_company(db, company=company_create)
    
    # 4. Get Admin role
    admin_role = crud.get_role_by_name(db, name="Admin")
    if not admin_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default Admin role not configured in the system"
        )
        
    # 5. Create user linked to the company
    user_create = schemas.UserCreate(
        email=payload.email,
        password=payload.password,
        role_id=admin_role.id
    )
    crud.create_user(db, user=user_create, company_id=db_company.id)
    
    # 6. Ensure user account starts as Inactive / Pending Approval
    db_user = crud.get_user_by_email(db, email=payload.email)
    if db_user:
        db_user.is_active = False
        db.commit()
        
    return {"message": "Registration successful. Your account is pending approval by the Super Admin."}


@router.get("/users", response_model=list[schemas.UserOut])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["Super Admin"]))
):
    from sqlalchemy import select
    return db.execute(select(models.User)).scalars().all()


@router.put("/users/{user_id}", response_model=schemas.UserOut)
def update_user_status(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.RoleChecker(["Super Admin"]))
):
    db_user = db.get(models.User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.is_active is not None:
        db_user.is_active = payload.is_active
    if payload.role_id is not None:
        db_user.role_id = payload.role_id
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/companies/check")
def check_company_name(name: str, db: Session = Depends(get_db)):
    from sqlalchemy import func
    company = db.execute(
        select(models.Company).where(func.lower(models.Company.name) == name.strip().lower())
    ).scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.status != "Active":
        raise HTTPException(status_code=400, detail=f"Company status is '{company.status}'. Please contact support.")
    return {"id": company.id, "name": company.name, "status": company.status}

@router.post("/register-pending", status_code=status.HTTP_201_CREATED)
def register_pending_employee(
    payload: schemas.EmployeeRegister,
    db: Session = Depends(get_db)
):
    company = crud.get_company_by_id(db, company_id=payload.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    existing_emp_email = db.execute(
        select(models.Employee).where(models.Employee.email == payload.email)
    ).scalar_one_or_none()
    if existing_emp_email:
        raise HTTPException(status_code=400, detail="Employee email already exists")

    existing_emp_id = db.execute(
        select(models.Employee).where(
            and_(
                models.Employee.employee_id == payload.employee_id,
                models.Employee.company_id == payload.company_id
            )
        )
    ).scalar_one_or_none()
    if existing_emp_id:
        raise HTTPException(status_code=400, detail="Employee ID already registered under this company")

    existing_user = crud.get_user_by_email(db, email=payload.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="User account with this email already exists")

    role = db.execute(select(models.Role).where(models.Role.name == "Employee")).scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=500, detail="Employee role not found in system database")
        
    user_create = schemas.UserCreate(
        email=payload.email,
        password=payload.password,
        role_id=role.id
    )
    db_user = crud.create_user(db, user=user_create, company_id=payload.company_id)
    db_user.is_active = False
    db.commit()

    db_emp = models.Employee(
        employee_id=payload.employee_id,
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        designation=payload.designation,
        status="Pending Approval",
        user_id=db_user.id,
        company_id=payload.company_id
    )
    db.add(db_emp)
    db.commit()
    db.refresh(db_emp)
    
    return {
        "message": "Registration successful. Please complete your facial scans next.",
        "employee_id": db_emp.id,
        "employee_uuid": db_emp.employee_id
    }

@router.post("/self-onboard/upload")
async def self_onboard_upload(
    request: Request,
    employee_id: int = Form(...),
    pose_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    employee = crud.get_employee_by_id(db, id=employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    if employee.status != "Pending Approval":
        raise HTTPException(status_code=403, detail="Biometric enrollment is locked for active accounts. Please log in.")
        
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Received empty file. No image data was sent.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    from app.api.v1.enrollment import enroll_employee_face_pose
    return enroll_employee_face_pose(
        db=db,
        employee=employee,
        pose_type=pose_type,
        contents=contents,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        creator_user_id=None
    )
