from sqlalchemy import select, or_, and_, func, delete
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from app.models import models
from app.schemas import schemas
import logging

logger = logging.getLogger("CRUD")

# --- Password Helpers ---
def verify_password(plain_password, hashed_password):
    from app.core.security import verify_password as sec_verify
    return sec_verify(plain_password, hashed_password)

def get_password_hash(password):
    from app.core.security import get_password_hash as sec_hash
    return sec_hash(password)

# --- Company CRUD (Super Admin Control) ---
def get_company_by_id(db: Session, company_id: int):
    return db.get(models.Company, company_id)

def get_company_by_name(db: Session, name: str):
    return db.execute(select(models.Company).where(models.Company.name == name)).scalar_one_or_none()

def get_companies(db: Session, skip: int = 0, limit: int = 100):
    return db.execute(select(models.Company).offset(skip).limit(limit)).scalars().all()

def create_company(db: Session, company: schemas.CompanyCreate):
    db_company = models.Company(**company.model_dump())
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company

def update_company(db: Session, company_id: int, company: schemas.CompanyUpdate):
    db_company = get_company_by_id(db, company_id)
    if not db_company:
        return None
    for key, value in company.model_dump(exclude_unset=True).items():
        setattr(db_company, key, value)
    db.commit()
    db.refresh(db_company)
    return db_company

# --- Role CRUD ---
def get_role_by_name(db: Session, name: str):
    return db.execute(select(models.Role).where(models.Role.name == name)).scalar_one_or_none()

def create_role(db: Session, name: str, description: str = None):
    db_role = models.Role(name=name, description=description)
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

# --- User CRUD ---
def get_user_by_email(db: Session, email: str):
    return db.execute(select(models.User).where(models.User.email == email)).scalar_one_or_none()

def create_user(db: Session, user: schemas.UserCreate, company_id: int = None):
    hashed_pwd = get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_pwd,
        role_id=user.role_id,
        company_id=company_id,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Department CRUD ---
def get_departments(db: Session, company_id: int = None, skip: int = 0, limit: int = 100):
    query = select(models.Department)
    if company_id is not None:
        query = query.where(models.Department.company_id == company_id)
    return db.execute(query.offset(skip).limit(limit)).scalars().all()

def get_department_by_code(db: Session, code: str, company_id: int = None):
    query = select(models.Department).where(models.Department.code == code)
    if company_id is not None:
        query = query.where(models.Department.company_id == company_id)
    return db.execute(query).scalar_one_or_none()

def get_department_by_id(db: Session, department_id: int):
    return db.get(models.Department, department_id)

def create_department(db: Session, dept: schemas.DepartmentCreate, company_id: int = None):
    db_dept = models.Department(**dept.model_dump(), company_id=company_id)
    db.add(db_dept)
    db.commit()
    db.refresh(db_dept)
    return db_dept

def update_department(db: Session, department_id: int, dept: schemas.DepartmentUpdate):
    db_dept = get_department_by_id(db, department_id)
    if not db_dept:
        return None
    for key, value in dept.model_dump(exclude_unset=True).items():
        setattr(db_dept, key, value)
    db.commit()
    db.refresh(db_dept)
    return db_dept

def delete_department(db: Session, department_id: int) -> bool:
    db_dept = get_department_by_id(db, department_id)
    if not db_dept:
        return False
    db.delete(db_dept)
    db.commit()
    return True

# --- Employee CRUD ---
def get_employee_by_id(db: Session, id: int):
    return db.get(models.Employee, id)

def get_employee_by_uuid(db: Session, employee_id: str):
    return db.execute(select(models.Employee).where(models.Employee.employee_id == employee_id)).scalar_one_or_none()

def get_employee_by_email(db: Session, email: str):
    return db.execute(select(models.Employee).where(models.Employee.email == email)).scalar_one_or_none()

def get_employee_by_name(db: Session, name: str, company_id: int = None):
    query = select(models.Employee).where(func.lower(models.Employee.name) == func.lower(name))
    if company_id is not None:
        query = query.where(models.Employee.company_id == company_id)
    return db.execute(query).scalars().first()

def get_employee_by_phone(db: Session, phone: str, company_id: int = None):
    import re
    cleaned = re.sub(r'[\s\-()]', '', phone)
    query = select(models.Employee).where(models.Employee.phone.isnot(None))
    if company_id is not None:
        query = query.where(models.Employee.company_id == company_id)
    all_emps = db.execute(query).scalars().all()
    for emp in all_emps:
        if re.sub(r'[\s\-()]', '', emp.phone) == cleaned:
            return emp
    return None

def get_employees(
    db: Session,
    company_id: int = None,
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    department_id: int = None,
    status: str = None
):
    query = select(models.Employee)
    filters = []
    
    if company_id is not None:
        filters.append(models.Employee.company_id == company_id)
    if search:
        filters.append(or_(
            models.Employee.name.ilike(f"%{search}%"),
            models.Employee.employee_id.ilike(f"%{search}%"),
            models.Employee.email.ilike(f"%{search}%")
        ))
    if department_id:
        filters.append(models.Employee.department_id == department_id)
    if status:
        filters.append(models.Employee.status == status)
        
    if filters:
        query = query.where(and_(*filters))
        
    return db.execute(query.offset(skip).limit(limit)).scalars().all()

def count_employees(db: Session, company_id: int = None, search: str = None, department_id: int = None, status: str = None) -> int:
    query = select(func.count(models.Employee.id))
    filters = []
    
    if company_id is not None:
        filters.append(models.Employee.company_id == company_id)
    if search:
        filters.append(or_(
            models.Employee.name.ilike(f"%{search}%"),
            models.Employee.employee_id.ilike(f"%{search}%"),
            models.Employee.email.ilike(f"%{search}%")
        ))
    if department_id:
        filters.append(models.Employee.department_id == department_id)
    if status:
        filters.append(models.Employee.status == status)
        
    if filters:
        query = query.where(and_(*filters))
        
    return db.execute(query).scalar() or 0

def create_employee(db: Session, emp: schemas.EmployeeCreate, user_id: int = None, company_id: int = None):
    db_emp = models.Employee(
        employee_id=emp.employee_id,
        name=emp.name,
        email=emp.email,
        phone=emp.phone,
        designation=emp.designation,
        joining_date=emp.joining_date,
        status=emp.status,
        department_id=emp.department_id,
        shift_id=emp.shift_id,
        allow_wfh=emp.allow_wfh,
        wfh_address=emp.wfh_address,
        wfh_lat=emp.wfh_lat,
        wfh_lng=emp.wfh_lng,
        user_id=user_id,
        company_id=company_id
    )
    db.add(db_emp)
    db.commit()
    db.refresh(db_emp)
    return db_emp

def update_employee(db: Session, id: int, emp: schemas.EmployeeUpdate):
    db_emp = get_employee_by_id(db, id)
    if not db_emp:
        return None
    for key, value in emp.model_dump(exclude_unset=True).items():
        setattr(db_emp, key, value)
    db.commit()
    db.refresh(db_emp)
    return db_emp

def delete_employee(db: Session, id: int) -> bool:
    db_emp = get_employee_by_id(db, id)
    if not db_emp:
        return False
    # If employee has an associated user login, delete that too
    if db_emp.user_id:
        db_user = db.get(models.User, db_emp.user_id)
        if db_user:
            db.delete(db_user)
    db.delete(db_emp)
    db.commit()
    return True

# --- Setting CRUD ---
def get_setting_by_key(db: Session, key: str, company_id: int = None):
    query = select(models.Setting).where(models.Setting.key == key)
    if company_id is not None:
        query = query.where(models.Setting.company_id == company_id)
    return db.execute(query).scalar_one_or_none()

def get_settings(db: Session, company_id: int = None):
    query = select(models.Setting)
    if company_id is not None:
        query = query.where(models.Setting.company_id == company_id)
    return db.execute(query).scalars().all()

def set_setting(db: Session, key: str, value: str, description: str = None, company_id: int = None):
    db_setting = get_setting_by_key(db, key, company_id=company_id)
    if db_setting:
        db_setting.value = value
    else:
        db_setting = models.Setting(key=key, value=value, description=description, company_id=company_id)
        db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting

# --- Attendance Logs & Face Embeddings CRUD ---
def get_attendance_logs(db: Session, company_id: int = None, skip: int = 0, limit: int = 100, employee_id: int = None, date_str: str = None):
    query = select(models.AttendanceLog).join(models.Employee)
    filters = []
    
    if company_id is not None:
        filters.append(models.Employee.company_id == company_id)
    if employee_id:
        filters.append(models.AttendanceLog.employee_id == employee_id)
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            filters.append(func.date(models.AttendanceLog.timestamp) == target_date)
        except Exception:
            pass
            
    if filters:
        query = query.where(and_(*filters))
        
    query = query.order_by(models.AttendanceLog.timestamp.desc()).offset(skip).limit(limit)
    return db.execute(query).scalars().all()

def get_daily_attendance(db: Session, date_val: date, employee_id: int = None, department_id: int = None, company_id: int = None):
    query = select(models.Attendance).join(models.Employee)
    filters = [models.Attendance.date == date_val]
    
    if company_id is not None:
        filters.append(models.Employee.company_id == company_id)
    if employee_id:
        filters.append(models.Attendance.employee_id == employee_id)
    if department_id:
        filters.append(models.Employee.department_id == department_id)
        
    query = query.where(and_(*filters))
    return db.execute(query).scalars().all()

def get_attendance_by_id(db: Session, id: int):
    return db.get(models.Attendance, id)

def update_attendance(db: Session, id: int, data: schemas.AttendanceUpdate):
    db_att = get_attendance_by_id(db, id)
    if not db_att:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(db_att, key, value)
    db.commit()
    db.refresh(db_att)
    return db_att

def delete_face_embeddings(db: Session, employee_id: int):
    stmt = delete(models.FaceEmbedding).where(models.FaceEmbedding.employee_id == employee_id)
    db.execute(stmt)
    db.commit()

def mark_kiosk_attendance(db: Session, employee_id: int, timestamp: datetime, camera: str, confidence: float) -> models.Attendance:
    today = timestamp.date()

    employee = db.get(models.Employee, employee_id)
    if not employee:
        raise ValueError(f"Employee {employee_id} not found")

    # Resolve shift details for employee
    if employee.shift:
        shift_start = employee.shift.start_time
        shift_end = employee.shift.end_time
        grace_mins = employee.shift.grace_period_minutes
    else:
        start_time_setting = get_setting_by_key(db, "CHECK_IN_START", company_id=employee.company_id)
        end_time_setting = get_setting_by_key(db, "CHECK_OUT_END", company_id=employee.company_id)
        grace_period_setting = get_setting_by_key(db, "GRACE_PERIOD_MINUTES", company_id=employee.company_id)

        start_str = start_time_setting.value if start_time_setting else "09:00"
        end_str = end_time_setting.value if end_time_setting else "17:00"
        grace_mins = int(grace_period_setting.value) if grace_period_setting else 15

        try:
            hr, mn = map(int, start_str.split(":"))
            shift_start = time(hr, mn)
        except Exception:
            shift_start = time(9, 0)

        try:
            hr, mn = map(int, end_str.split(":"))
            shift_end = time(hr, mn)
        except Exception:
            shift_end = time(17, 0)

    # Check if a record exists
    stmt = select(models.Attendance).where(
        and_(
            models.Attendance.employee_id == employee_id,
            models.Attendance.date == today
        )
    )
    db_attendance = db.execute(stmt).scalar_one_or_none()

    check_in_deadline = datetime.combine(today, shift_start) + timedelta(minutes=grace_mins)

    if not db_attendance:
        # First scan of the day -> CHECK-IN
        is_late = timestamp > check_in_deadline
        status = "Late" if is_late else "Present"

        db_attendance = models.Attendance(
            employee_id=employee_id,
            date=today,
            check_in=timestamp,
            late_arrival=is_late,
            status=status
        )
        db.add(db_attendance)

        # Deduct a token for this check-in
        if employee.company and employee.company.available_tokens > 0:
            employee.company.available_tokens -= 1
            employee.company.tokens_used += 1

        logger.info(f"Marked Check-In for employee {employee_id} at {timestamp}. Status: {status}")
    else:
        # Second scan of the day -> CHECK-OUT
        # If it's a scan that happens at least 1 minute after check_in, update checkout
        if db_attendance.check_in and (timestamp - db_attendance.check_in).total_seconds() > 60:
            db_attendance.check_out = timestamp
            diff = timestamp - db_attendance.check_in
            db_attendance.working_hours = round(diff.total_seconds() / 3600.0, 2)
            db_attendance.overtime = max(0.0, round(db_attendance.working_hours - 8.0, 2))
            
            # Auto-calculate early departure
            if employee.shift:
                shift_end_dt = datetime.combine(today, employee.shift.end_time)
                db_attendance.early_departure = timestamp < shift_end_dt
            
            logger.info(f"Marked Check-Out for employee {employee_id} at {timestamp}. Hours: {db_attendance.working_hours}")

    db.commit()
    db.refresh(db_attendance)
    return db_attendance

# --- Leave Requests CRUD ---
def get_leave_requests(db: Session, employee_id: int = None):
    query = select(models.LeaveRequest)
    if employee_id:
        query = query.where(models.LeaveRequest.employee_id == employee_id)
    return db.execute(query.order_by(models.LeaveRequest.created_at.desc())).scalars().all()

def create_leave_request(db: Session, req: schemas.LeaveRequestCreate, employee_id: int):
    db_req = models.LeaveRequest(
        employee_id=employee_id,
        start_date=req.start_date,
        end_date=req.end_date,
        leave_type=req.leave_type,
        reason=req.reason,
        status="Pending"
    )
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req

def update_leave_status(db: Session, id: int, status: str, admin_user_id: int):
    db_req = db.get(models.LeaveRequest, id)
    if not db_req:
        return None
    db_req.status = status
    db_req.approved_by = admin_user_id
    
    # If approved, update attendance status for those dates
    if status.lower() == "approved":
        current_date = db_req.start_date
        while current_date <= db_req.end_date:
            # Check if an attendance record exists
            stmt = select(models.Attendance).where(
                and_(
                    models.Attendance.employee_id == db_req.employee_id,
                    models.Attendance.date == current_date
                )
            )
            att = db.execute(stmt).scalar_one_or_none()
            if att:
                att.status = "On Leave"
            else:
                att = models.Attendance(
                    employee_id=db_req.employee_id,
                    date=current_date,
                    status="On Leave"
                )
                db.add(att)
            current_date += timedelta(days=1)
            
    db.commit()
    db.refresh(db_req)
    return db_req

# --- Holiday CRUD ---
def get_holidays(db: Session):
    return db.execute(select(models.Holiday).order_by(models.Holiday.date)).scalars().all()

def get_holiday_by_date(db: Session, date_val: date):
    return db.execute(select(models.Holiday).where(models.Holiday.date == date_val)).scalar_one_or_none()

def create_holiday(db: Session, hol: schemas.HolidayCreate):
    db_hol = models.Holiday(**hol.model_dump())
    db.add(db_hol)
    db.commit()
    db.refresh(db_hol)
    return db_hol

def delete_holiday(db: Session, id: int) -> bool:
    db_hol = db.get(models.Holiday, id)
    if not db_hol:
        return False
    db.delete(db_hol)
    db.commit()
    return True

# --- Audit Logs CRUD ---
def create_audit_log(db: Session, user_id: int, action: str, ip_address: str = None, user_agent: str = None, details: str = None, company_id: int = None):
    log = models.AuditLog(
        user_id=user_id,
        action=action,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details,
        company_id=company_id
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

def get_audit_logs(db: Session, company_id: int = None, skip: int = 0, limit: int = 100):
    query = select(models.AuditLog)
    if company_id is not None:
        query = query.where(models.AuditLog.company_id == company_id)
    query = query.order_by(models.AuditLog.timestamp.desc()).offset(skip).limit(limit)
    return db.execute(query).scalars().all()

def clear_all_audit_logs(db: Session, company_id: int = None) -> int:
    if company_id is not None:
        stmt = delete(models.AuditLog).where(models.AuditLog.company_id == company_id)
    else:
        stmt = delete(models.AuditLog)
    result = db.execute(stmt)
    db.commit()
    return result.rowcount
