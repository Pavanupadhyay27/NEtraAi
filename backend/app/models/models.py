import datetime
import json
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Float, Text, Time, Interval, Enum, LargeBinary, UniqueConstraint
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import relationship
from app.core.database import Base

class SafeVector(TypeDecorator):
    impl = Text
    cache_ok = True

    def __init__(self, dimensions):
        self.dimensions = dimensions
        super().__init__()

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            try:
                from pgvector.sqlalchemy import Vector
                return dialect.type_descriptor(Vector(self.dimensions))
            except ImportError:
                pass
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == 'postgresql':
            return value
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if dialect.name == 'postgresql':
            return value
        try:
            return json.loads(value)
        except Exception:
            return value

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    status = Column(String(50), default="Active")  # Active, Suspended, Deauthorized
    max_employees = Column(Integer, default=100)
    available_tokens = Column(Integer, default=1000)
    tokens_used = Column(Integer, default=0)
    admin_email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(String(255), nullable=True)

    users = relationship("User", back_populates="company", cascade="all, delete-orphan")
    employees = relationship("Employee", back_populates="company", cascade="all, delete-orphan")
    departments = relationship("Department", back_populates="company", cascade="all, delete-orphan")
    shifts = relationship("Shift", back_populates="company", cascade="all, delete-orphan")
    settings = relationship("Setting", back_populates="company", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="company", cascade="all, delete-orphan")
    tickets = relationship("Ticket", back_populates="company", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="company", cascade="all, delete-orphan")

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)  # Super Admin, Admin, HR, Employee
    description = Column(String(255), nullable=True)

    users = relationship("User", back_populates="role")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    role = relationship("Role", back_populates="users")
    company = relationship("Company", back_populates="users")
    employee = relationship("Employee", back_populates="user", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="user")

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), nullable=False)
    description = Column(String(255), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)

    __table_args__ = (
        UniqueConstraint("name", "company_id", name="uq_department_name_company"),
        UniqueConstraint("code", "company_id", name="uq_department_code_company"),
    )

    company = relationship("Company", back_populates="departments")
    employees = relationship("Employee", back_populates="department")

class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    grace_period_minutes = Column(Integer, default=15)
    description = Column(String(255), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)

    __table_args__ = (
        UniqueConstraint("name", "company_id", name="uq_shift_name_company"),
    )

    company = relationship("Company", back_populates="shifts")

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=True)
    designation = Column(String(100), nullable=True)
    joining_date = Column(Date, nullable=False, default=datetime.date.today)
    status = Column(String(20), default="Active")  # Active, Inactive, Suspended
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, unique=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    allow_wfh = Column(Boolean, default=False)
    wfh_address = Column(String(255), nullable=True)
    wfh_lat = Column(Float, nullable=True)
    wfh_lng = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    company = relationship("Company", back_populates="employees")
    department = relationship("Department", back_populates="employees")
    shift = relationship("Shift")
    user = relationship("User", back_populates="employee")
    images = relationship("EmployeeImage", back_populates="employee", cascade="all, delete-orphan")
    embeddings = relationship("FaceEmbedding", back_populates="employee", cascade="all, delete-orphan")
    attendance_records = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan")
    attendance_logs = relationship("AttendanceLog", back_populates="employee", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", back_populates="employee", cascade="all, delete-orphan")
    tickets = relationship("Ticket", back_populates="employee", cascade="all, delete-orphan")

class EmployeeImage(Base):
    __tablename__ = "employee_images"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(255), nullable=False)
    pose_type = Column(String(50), nullable=False)  # Front, Left, Right, Up, Down, Smile, Neutral, etc.
    image_bytes = Column(LargeBinary, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    employee = relationship("Employee", back_populates="images")
    embeddings = relationship("FaceEmbedding", back_populates="image", cascade="all, delete-orphan")

class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    image_id = Column(Integer, ForeignKey("employee_images.id", ondelete="CASCADE"), nullable=True)
    embedding = Column(SafeVector(512), nullable=False)  # pgvector field for 512 dimensions (ArcFace) or JSON text on SQLite
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    employee = relationship("Employee", back_populates="embeddings")
    image = relationship("EmployeeImage", back_populates="embeddings")

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    check_in = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)
    working_hours = Column(Float, default=0.0)  # Calculated in hours
    late_arrival = Column(Boolean, default=False)
    early_departure = Column(Boolean, default=False)
    overtime = Column(Float, default=0.0)  # Calculated in hours
    status = Column(String(20), default="Absent")  # Present, Absent, Late, Half Day, Leave, Holiday, WFH
    emergency_allowed = Column(Boolean, default=False)

    # Enterprise Extensions
    late_minutes = Column(Integer, default=0)
    early_exit_minutes = Column(Integer, default=0)
    break_time_minutes = Column(Integer, default=0)
    attendance_streak = Column(Integer, default=0)
    attendance_percentage = Column(Float, default=100.0)
    shift_info = Column(String(255), nullable=True)
    geofence_result = Column(String(100), nullable=True)
    policy_version = Column(String(50), nullable=True)

    employee = relationship("Employee", back_populates="attendance_records")

class AttendanceLog(Base):
    __tablename__ = "attendance_logs"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=True)  # Null if not recognized
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    camera = Column(String(100), default="Kiosk")
    confidence = Column(Float, nullable=True)
    liveness_score = Column(Float, nullable=True)
    is_spoof = Column(Boolean, default=False)
    status = Column(String(50), nullable=False)  # Match Success, Spoof Rejected, Unknown Person, Low Confidence
    image_path = Column(String(255), nullable=True)
    location_text = Column(String(255), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Recognition Analytics Extensions
    face_quality = Column(Float, nullable=True)
    blur_score = Column(Float, nullable=True)
    brightness_score = Column(Float, nullable=True)
    is_occluded = Column(Boolean, default=False)
    has_mask = Column(Boolean, default=False)
    recognition_time_ms = Column(Float, nullable=True)
    processing_time_ms = Column(Float, nullable=True)
    embedding_version = Column(String(50), nullable=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)

    employee = relationship("Employee", back_populates="attendance_logs")

class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    leave_type = Column(String(50), nullable=False)  # Sick, Casual, Annual, unpaid
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="Pending")  # Pending, Approved, Rejected
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    employee = relationship("Employee", back_populates="leave_requests")

class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    date = Column(Date, unique=True, nullable=False)
    description = Column(String(255), nullable=True)

class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), nullable=False)
    value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)

    __table_args__ = (
        UniqueConstraint("key", "company_id", name="uq_setting_key_company"),
    )

    company = relationship("Company", back_populates="settings")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)  # Login, Logout, Create Employee, Mark Attendance, etc.
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    details = Column(Text, nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)

    company = relationship("Company", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)  # Payroll, Attendance, IT, Leave, etc.
    priority = Column(String(50), default="Medium")  # Low, Medium, High
    status = Column(String(50), default="Open")  # Open, In Progress, Closed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    employee = relationship("Employee", back_populates="tickets")
    company = relationship("Company", back_populates="tickets")
    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan")

class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    is_delivered = Column(Boolean, default=True)
    is_read = Column(Boolean, default=False)

    ticket = relationship("Ticket", back_populates="messages")
    sender = relationship("User")

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    device_type = Column(String(50), default="Kiosk")  # Kiosk, Mobile, Gateway
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    branch = Column(String(100), default="Main Headquarters")
    camera = Column(String(100), default="Main Camera")
    ip_address = Column(String(50), nullable=True)
    os_info = Column(String(100), nullable=True)
    app_version = Column(String(50), nullable=True)
    status = Column(String(50), default="Online")  # Online, Offline, Maintenance
    heartbeat = Column(DateTime, default=datetime.datetime.utcnow)
    cpu_usage = Column(Float, default=0.0)
    memory_usage = Column(Float, default=0.0)
    disk_usage = Column(Float, default=0.0)
    battery_level = Column(Integer, default=100)
    network_status = Column(String(50), default="Good")
    last_sync = Column(DateTime, default=datetime.datetime.utcnow)
    restart_count = Column(Integer, default=0)

    company = relationship("Company", back_populates="devices")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    recipient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  # Null if broadcast
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String(100), default="General")  # Attendance, HR, Leave, Alert, System
    priority = Column(String(50), default="Medium")  # Low, Medium, High
    is_read = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

    company = relationship("Company")
    recipient = relationship("User", foreign_keys=[recipient_id])
    sender = relationship("User", foreign_keys=[sender_id])

class ActivityTimeline(Base):
    __tablename__ = "activity_timelines"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)  # Create, Update, Delete, Authenticate, Scan
    entity_type = Column(String(100), nullable=False)  # Employee, Organization, Device, Attendance, Ticket
    entity_id = Column(Integer, nullable=True)
    previous_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    ip_address = Column(String(50), nullable=True)
    device_info = Column(String(255), nullable=True)
    browser_info = Column(String(255), nullable=True)

    company = relationship("Company")
    actor = relationship("User")


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subscription_json = Column(Text, nullable=False)  # JSON string of subscription credentials
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", backref="push_subscriptions")
