from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func
from app.models import models
from app.schemas import schemas
from datetime import datetime, date, time, timedelta
import logging
import bcrypt
import os
import shutil

logger = logging.getLogger("CRUD")

# --- Security & Password Hashing ---
def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password or not plain_password:
        return False
    try:
        pwd_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception:
        return False

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

def create_user(db: Session, user: schemas.UserCreate):
    hashed_pwd = get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_pwd,
        role_id=user.role_id,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Department CRUD ---
def get_departments(db: Session, skip: int = 0, limit: int = 100):
    return db.execute(select(models.Department).offset(skip).limit(limit)).scalars().all()

def get_department_by_code(db: Session, code: str):
    return db.execute(select(models.Department).where(models.Department.code == code)).scalar_one_or_none()

def get_department_by_id(db: Session, department_id: int):
    return db.get(models.Department, department_id)

def create_department(db: Session, dept: schemas.DepartmentCreate):
    db_dept = models.Department(**dept.model_dump())
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

def get_employee_by_name(db: Session, name: str):
    return db.execute(select(models.Employee).where(func.lower(models.Employee.name) == func.lower(name))).scalars().first()

def get_employee_by_phone(db: Session, phone: str):
    import re
    cleaned = re.sub(r'[\s\-()]', '', phone)
    all_emps = db.execute(select(models.Employee).where(models.Employee.phone.isnot(None))).scalars().all()
    for emp in all_emps:
        if re.sub(r'[\s\-()]', '', emp.phone) == cleaned:
            return emp
    return None

def get_employees(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    department_id: int = None,
    status: str = None
):
    query = select(models.Employee)
    filters = []
    
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
        
    query = query.offset(skip).limit(limit)
    return db.execute(query).scalars().all()

def count_employees(db: Session, search: str = None, department_id: int = None, status: str = None) -> int:
    query = select(func.count(models.Employee.id))
    filters = []
    
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

def create_employee(db: Session, emp: schemas.EmployeeCreate, user_id: int = None):
    db_emp = models.Employee(
        employee_id=emp.employee_id,
        name=emp.name,
        email=emp.email,
        phone=emp.phone,
        designation=emp.designation,
        joining_date=emp.joining_date,
        status=emp.status,
        department_id=emp.department_id,
        user_id=user_id
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
    # If the employee has an associated user, delete that user as well
    if db_emp.user_id:
        db_user = db.get(models.User, db_emp.user_id)
        if db_user:
            db.delete(db_user)
    db.delete(db_emp)
    db.commit()
    return True

# --- Face Enrollment & Embeddings CRUD ---
def save_employee_image(db: Session, employee_id: int, file_path: str, pose_type: str):
    db_img = models.EmployeeImage(
        employee_id=employee_id,
        file_path=file_path,
        pose_type=pose_type
    )
    db.add(db_img)
    db.commit()
    db.refresh(db_img)
    return db_img

def save_face_embedding(db: Session, employee_id: int, image_id: int, embedding: list):
    db_emb = models.FaceEmbedding(
        employee_id=employee_id,
        image_id=image_id,
        embedding=embedding
    )
    db.add(db_emb)
    db.commit()
    db.refresh(db_emb)
    return db_emb

def delete_face_embeddings(db: Session, employee_id: int):
    # Deletes all embeddings and reference images for a user
    from app.core.config import settings
    
    emp = db.get(models.Employee, employee_id)
    if emp and emp.employee_id:
        emp_upload_dir = os.path.join(settings.UPLOAD_DIR, str(emp.employee_id))
        if os.path.exists(emp_upload_dir):
            try:
                shutil.rmtree(emp_upload_dir)
            except Exception as e:
                logger.error(f"Failed to delete directory {emp_upload_dir}: {e}")

    embeddings = db.execute(select(models.FaceEmbedding).where(models.FaceEmbedding.employee_id == employee_id)).scalars().all()
    for emb in embeddings:
        db.delete(emb)
        
    images = db.execute(select(models.EmployeeImage).where(models.EmployeeImage.employee_id == employee_id)).scalars().all()
    for img in images:
        if os.path.exists(img.file_path):
            try:
                os.remove(img.file_path)
            except Exception:
                pass
        db.delete(img)
    db.commit()

# --- System Settings CRUD ---
def get_setting_by_key(db: Session, key: str):
    return db.execute(select(models.Setting).where(models.Setting.key == key)).scalar_one_or_none()

def get_settings(db: Session):
    return db.execute(select(models.Setting)).scalars().all()

def set_setting(db: Session, key: str, value: str, description: str = None):
    db_setting = get_setting_by_key(db, key)
    if db_setting:
        db_setting.value = value
        if description:
            db_setting.description = description
    else:
        db_setting = models.Setting(key=key, value=value, description=description)
        db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting

# --- Attendance Logs CRUD ---
def create_attendance_log(db: Session, employee_id: int, camera: str, confidence: float, liveness_score: float, is_spoof: bool, status: str, timestamp: datetime = None, image_path: str = None):
    if not timestamp:
        timestamp = datetime.now()
    log = models.AttendanceLog(
        employee_id=employee_id,
        camera=camera,
        confidence=confidence,
        liveness_score=liveness_score,
        is_spoof=is_spoof,
        status=status,
        timestamp=timestamp,
        image_path=image_path
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

def get_attendance_logs(db: Session, skip: int = 0, limit: int = 100, employee_id: int = None, date_str: str = None):
    query = select(models.AttendanceLog)
    filters = []
    
    if employee_id:
        filters.append(models.AttendanceLog.employee_id == employee_id)
        
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            filters.append(func.date(models.AttendanceLog.timestamp) == target_date)
        except ValueError:
            pass
            
    if filters:
        query = query.where(and_(*filters))
        
    query = query.order_by(models.AttendanceLog.timestamp.desc()).offset(skip).limit(limit)
    return db.execute(query).scalars().all()

# --- Attendance Logic & Processing ---
def get_daily_attendance(db: Session, date_val: date, employee_id: int = None, department_id: int = None):
    query = select(models.Attendance)
    filters = [models.Attendance.date == date_val]
    
    if employee_id:
        filters.append(models.Attendance.employee_id == employee_id)
        
    if department_id:
        query = query.join(models.Employee).where(models.Employee.department_id == department_id)
        
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
        
    # Recalculate working hours if both check_in and check_out exist
    if db_att.check_in and db_att.check_out:
        diff = db_att.check_out - db_att.check_in
        db_att.working_hours = round(diff.total_seconds() / 3600.0, 2)
        # Standard work hours = 8. Overtime is above 8
        db_att.overtime = max(0.0, round(db_att.working_hours - 8.0, 2))
        
    db.commit()
    db.refresh(db_att)
    return db_att

def mark_kiosk_attendance(db: Session, employee_id: int, timestamp: datetime, camera: str, confidence: float) -> models.Attendance:
    """
    Core attendance state machine:
    - Check if there's already an attendance record for this employee and date.
    - If none exists, create a check-in record.
    - If one exists and check_out is empty, mark check-out and calculate hours.
    - If both exist, do nothing or update checkout to a later timestamp.
    """
    local_now = datetime.now()
    today = local_now.date()
    
    # Check if a record exists
    stmt = select(models.Attendance).where(
        and_(
            models.Attendance.employee_id == employee_id,
            models.Attendance.date == today
        )
    )
    db_attendance = db.execute(stmt).scalar_one_or_none()
    
    # Check system configurations for status mapping
    start_time_setting = get_setting_by_key(db, "CHECK_IN_START")
    grace_period_setting = get_setting_by_key(db, "GRACE_PERIOD_MINUTES")
    
    start_str = start_time_setting.value if start_time_setting else "09:00"
    grace_mins = int(grace_period_setting.value) if grace_period_setting else 15
    
    try:
        hr, mn = map(int, start_str.split(":"))
        check_in_deadline = datetime.combine(today, time(hr, mn)) + timedelta(minutes=grace_mins)
    except Exception:
        check_in_deadline = datetime.combine(today, time(9, 15))
 
    if not db_attendance:
        # First scan of the day -> CHECK-IN
        is_late = local_now > check_in_deadline
        status = "Late" if is_late else "Present"
        
        db_attendance = models.Attendance(
            employee_id=employee_id,
            date=today,
            check_in=timestamp,
            late_arrival=is_late,
            status=status
        )
        db.add(db_attendance)
        logger.info(f"Marked Check-In for employee {employee_id} at {timestamp}. Status: {status}")
    else:
        # Second scan of the day -> CHECK-OUT
        # If it's a scan that happens at least 1 minute after check_in, update checkout
        if db_attendance.check_in and (timestamp - db_attendance.check_in).total_seconds() > 60:
            db_attendance.check_out = timestamp
            
            # Calculate working hours
            diff = timestamp - db_attendance.check_in
            hours = round(diff.total_seconds() / 3600.0, 2)
            db_attendance.working_hours = hours
            
            # Early departure: Check if checkout is before e.g., 5:00 PM
            end_time_setting = get_setting_by_key(db, "CHECK_OUT_END")
            end_str = end_time_setting.value if end_time_setting else "17:00"
            try:
                ehr, emn = map(int, end_str.split(":"))
                departure_deadline = datetime.combine(today, time(ehr, emn))
            except Exception:
                departure_deadline = datetime.combine(today, time(17, 0))
                
            db_attendance.early_departure = local_now < departure_deadline
            
            # Overtime: Hours worked beyond 8 hours
            db_attendance.overtime = max(0.0, round(hours - 8.0, 2))
            
            # Half Day check: If total working hours is less than 8 hours
            if hours < 8.0:
                db_attendance.status = "Half Day"
            else:
                if db_attendance.status == "Half Day" or db_attendance.status == "Absent":
                    db_attendance.status = "Present"
                
            logger.info(f"Marked Check-Out for employee {employee_id} at {timestamp}. Worked: {hours}h. Status: {db_attendance.status}")
            
    db.commit()
    db.refresh(db_attendance)
    return db_attendance

# --- Leave Requests CRUD ---
def create_leave_request(db: Session, req: schemas.LeaveRequestCreate):
    db_req = models.LeaveRequest(
        employee_id=req.employee_id,
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

def get_leave_requests(db: Session, skip: int = 0, limit: int = 100, employee_id: int = None, status: str = None):
    query = select(models.LeaveRequest)
    filters = []
    if employee_id:
        filters.append(models.LeaveRequest.employee_id == employee_id)
    if status:
        filters.append(models.LeaveRequest.status == status)
        
    if filters:
        query = query.where(and_(*filters))
        
    query = query.order_by(models.LeaveRequest.created_at.desc()).offset(skip).limit(limit)
    return db.execute(query).scalars().all()

def update_leave_request(db: Session, id: int, status: str, admin_user_id: int):
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
def create_audit_log(db: Session, user_id: int, action: str, ip_address: str = None, user_agent: str = None, details: str = None):
    log = models.AuditLog(
        user_id=user_id,
        action=action,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

def get_audit_logs(db: Session, skip: int = 0, limit: int = 100):
    query = select(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).offset(skip).limit(limit)
    return db.execute(query).scalars().all()
