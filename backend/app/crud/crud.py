from sqlalchemy import select, or_, and_, func, delete
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta, time
from typing import Optional, List
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
    dump = company.model_dump()
    logo = dump.pop("logo", None)
    latitude = dump.pop("latitude", None)
    longitude = dump.pop("longitude", None)
    db_company = models.Company(**dump)
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    if logo:
        set_setting(db, key="COMPANY_LOGO", value=logo, company_id=db_company.id)
    if latitude:
        set_setting(db, key="LOCATION_LATITUDE", value=str(latitude), company_id=db_company.id)
    if longitude:
        set_setting(db, key="LOCATION_LONGITUDE", value=str(longitude), company_id=db_company.id)
    if db_company.address:
        set_setting(db, key="LOCATION_ADDRESS", value=db_company.address, company_id=db_company.id)

    # Auto-seed standard departments for the new organization
    default_depts = [
        {"name": "Engineering", "code": "ENG", "description": "Software development, DevOps, QA, and IT systems"},
        {"name": "Human Resources", "code": "HR", "description": "Recruitment, payroll, and staff relations"},
        {"name": "Marketing & Sales", "code": "MKT", "description": "Product branding, marketing campaigns, and client sales"},
        {"name": "Finance & Accounts", "code": "FIN", "description": "Financial planning, accounting, and budgeting"},
        {"name": "Operations", "code": "OPS", "description": "Office administration and business facilities"}
    ]
    for d in default_depts:
        db_dept = models.Department(
            name=d["name"],
            code=d["code"],
            description=d["description"],
            company_id=db_company.id
        )
        db.add(db_dept)
    db.commit()
    db.refresh(db_company)
    return db_company

def update_company(db: Session, company_id: int, company: schemas.CompanyUpdate):
    db_company = get_company_by_id(db, company_id)
    if not db_company:
        return None
    dump = company.model_dump(exclude_unset=True)
    logo = dump.pop("logo", None)
    latitude = dump.pop("latitude", None)
    longitude = dump.pop("longitude", None)
    for key, value in dump.items():
        setattr(db_company, key, value)
    db.commit()
    if logo is not None:
        set_setting(db, key="COMPANY_LOGO", value=logo, company_id=company_id)
    if latitude is not None:
        set_setting(db, key="LOCATION_LATITUDE", value=str(latitude), company_id=company_id)
    if longitude is not None:
        set_setting(db, key="LOCATION_LONGITUDE", value=str(longitude), company_id=company_id)
    if db_company.address:
        set_setting(db, key="LOCATION_ADDRESS", value=db_company.address, company_id=company_id)
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

def create_attendance_log(
    db: Session,
    employee_id: Optional[int],
    camera: str,
    confidence: Optional[float],
    liveness_score: Optional[float],
    is_spoof: bool,
    status: str,
    timestamp: datetime = None,
    image_path: str = None,
    location_text: str = None,
    latitude: float = None,
    longitude: float = None,
    face_quality: float = None,
    blur_score: float = None,
    brightness_score: float = None,
    is_occluded: bool = False,
    has_mask: bool = False,
    recognition_time_ms: float = None,
    processing_time_ms: float = None,
    embedding_version: str = None,
    device_id: int = None
):
    if timestamp is None:
        timestamp = datetime.utcnow()
    db_log = models.AttendanceLog(
        employee_id=employee_id,
        timestamp=timestamp,
        camera=camera,
        confidence=confidence,
        liveness_score=liveness_score,
        is_spoof=is_spoof,
        status=status,
        image_path=image_path,
        location_text=location_text,
        latitude=latitude,
        longitude=longitude,
        face_quality=face_quality,
        blur_score=blur_score,
        brightness_score=brightness_score,
        is_occluded=is_occluded,
        has_mask=has_mask,
        recognition_time_ms=recognition_time_ms,
        processing_time_ms=processing_time_ms,
        embedding_version=embedding_version,
        device_id=device_id
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

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
    # Convert UTC timestamp to IST to get today's date and for shift/deadline comparisons
    ist_time = timestamp + timedelta(hours=5, minutes=30)
    today = ist_time.date()

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
        is_late = ist_time > check_in_deadline
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
                db_attendance.early_departure = ist_time < shift_end_dt
            
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

# --- Support Tickets CRUD ---
def get_ticket_by_id(db: Session, ticket_id: int):
    return db.get(models.Ticket, ticket_id)

def get_tickets(db: Session, company_id: int = None, employee_id: int = None):
    query = select(models.Ticket)
    filters = []
    if company_id is not None:
        filters.append(models.Ticket.company_id == company_id)
    if employee_id is not None:
        filters.append(models.Ticket.employee_id == employee_id)
    if filters:
        query = query.where(and_(*filters))
    return db.execute(query.order_by(models.Ticket.created_at.desc())).scalars().all()

def create_ticket(db: Session, ticket: schemas.TicketCreate, employee_id: int, company_id: int):
    db_ticket = models.Ticket(
        employee_id=employee_id,
        company_id=company_id,
        title=ticket.title,
        category=ticket.category,
        priority=ticket.priority,
        status="Open"
    )
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

def create_ticket_message(db: Session, ticket_id: int, msg: schemas.TicketMessageCreate, sender_id: int):
    db_message = models.TicketMessage(
        ticket_id=ticket_id,
        sender_id=sender_id,
        message=msg.message
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

def update_ticket_status(db: Session, ticket_id: int, status: str):
    db_ticket = get_ticket_by_id(db, ticket_id)
    if not db_ticket:
        return None
    db_ticket.status = status
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

# --- Device CRUD ---
def get_device_by_id(db: Session, device_id: int):
    return db.get(models.Device, device_id)

def get_devices(db: Session, company_id: int = None):
    query = select(models.Device)
    if company_id is not None:
        query = query.where(models.Device.company_id == company_id)
    return db.execute(query.order_by(models.Device.name.asc())).scalars().all()

def create_device(db: Session, device: schemas.DeviceCreate, company_id: int):
    db_device = models.Device(
        name=device.name,
        device_type=device.device_type,
        company_id=company_id,
        branch=device.branch,
        camera=device.camera,
        ip_address=device.ip_address,
        os_info=device.os_info,
        app_version=device.app_version
    )
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    return db_device

def update_device(db: Session, device_id: int, device_update: schemas.DeviceUpdate):
    db_device = get_device_by_id(db, device_id)
    if not db_device:
        return None
    update_data = device_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_device, key, value)
    db_device.heartbeat = datetime.utcnow()
    db.commit()
    db.refresh(db_device)
    return db_device

# --- Notification CRUD ---
def get_notification_by_id(db: Session, notification_id: int):
    return db.get(models.Notification, notification_id)

def get_notifications(db: Session, company_id: int = None, recipient_id: int = None, is_read: bool = None):
    query = select(models.Notification)
    filters = []
    if company_id is not None:
        filters.append(models.Notification.company_id == company_id)
    if recipient_id is not None:
        # Show both specific recipient notifications and broadcast notifications (where recipient_id is Null)
        filters.append(or_(models.Notification.recipient_id == recipient_id, models.Notification.recipient_id.is_(None)))
    if is_read is not None:
        filters.append(models.Notification.is_read == is_read)
    filters.append(models.Notification.is_archived == False)
    
    if filters:
        query = query.where(and_(*filters))
    return db.execute(query.order_by(models.Notification.created_at.desc())).scalars().all()

def create_notification(db: Session, ntf: schemas.NotificationCreate, company_id: int, sender_id: int = None):
    db_ntf = models.Notification(
        company_id=company_id,
        recipient_id=ntf.recipient_id,
        sender_id=sender_id,
        title=ntf.title,
        message=ntf.message,
        category=ntf.category,
        priority=ntf.priority,
        expires_at=ntf.expires_at
    )
    db.add(db_ntf)
    db.commit()
    db.refresh(db_ntf)
    return db_ntf

def mark_notification_read(db: Session, notification_id: int):
    db_ntf = get_notification_by_id(db, notification_id)
    if db_ntf:
        db_ntf.is_read = True
        db.commit()
        db.refresh(db_ntf)
    return db_ntf

def archive_notification(db: Session, notification_id: int):
    db_ntf = get_notification_by_id(db, notification_id)
    if db_ntf:
        db_ntf.is_archived = True
        db.commit()
        db.refresh(db_ntf)
    return db_ntf

# --- Activity Timeline CRUD ---
def create_activity_timeline_log(
    db: Session, 
    company_id: int, 
    actor_id: int, 
    action: str, 
    entity_type: str, 
    entity_id: int = None, 
    previous_value: str = None, 
    new_value: str = None, 
    ip_address: str = None, 
    device_info: str = None, 
    browser_info: str = None
):
    log = models.ActivityTimeline(
        company_id=company_id,
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        previous_value=previous_value,
        new_value=new_value,
        ip_address=ip_address,
        device_info=device_info,
        browser_info=browser_info
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

def get_activity_timeline(db: Session, company_id: int = None, entity_type: str = None, entity_id: int = None, limit: int = 50):
    query = select(models.ActivityTimeline)
    filters = []
    if company_id is not None:
        filters.append(models.ActivityTimeline.company_id == company_id)
    if entity_type is not None:
        filters.append(models.ActivityTimeline.entity_type == entity_type)
    if entity_id is not None:
        filters.append(models.ActivityTimeline.entity_id == entity_id)
    if filters:
        query = query.where(and_(*filters))
    return db.execute(query.order_by(models.ActivityTimeline.timestamp.desc()).limit(limit)).scalars().all()

def save_employee_image(db: Session, employee_id: int, file_path: str, pose_type: str, image_bytes: bytes = None):
    db_img = models.EmployeeImage(
        employee_id=employee_id,
        file_path=file_path,
        pose_type=pose_type,
        image_bytes=image_bytes
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
