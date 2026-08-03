from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime, date, time, timedelta
import re

# Role Schemas
class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None

class RoleOut(RoleBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# Company Schemas
class CompanyBase(BaseModel):
    name: str
    status: Optional[str] = "Active"
    max_employees: Optional[int] = 100
    available_tokens: Optional[int] = 1000
    tokens_used: Optional[int] = 0
    admin_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class CompanyCreate(CompanyBase):
    logo: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    admin_password: Optional[str] = None

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    max_employees: Optional[int] = None
    available_tokens: Optional[int] = None
    tokens_used: Optional[int] = None
    admin_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    logo: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None

class CompanyOut(CompanyBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# User Schemas
class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str
    role_id: int

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role_id: Optional[int] = None
    is_active: Optional[bool] = None

def _validate_password_strength(v: str) -> str:
    """Enforce minimum password complexity to prevent weak credentials."""
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r'[A-Z]', v):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r'[a-z]', v):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r'\d', v):
        raise ValueError("Password must contain at least one digit")
    return v

class AdminRegister(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    phone: Optional[str] = None
    address: Optional[str] = None

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_password_strength(v)

class EmployeeRegister(BaseModel):
    company_id: int
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    employee_id: str = Field(..., min_length=1, max_length=50, pattern=r'^[A-Za-z0-9_\-]+$')
    phone: Optional[str] = None
    designation: Optional[str] = Field(None, max_length=100)
    department_id: Optional[int] = None

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_password_strength(v)


# Token Schemas
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

# Department Schemas
class DepartmentBase(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=20)
    description: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None

class DepartmentOut(DepartmentBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# Shift Schemas
class ShiftBase(BaseModel):
    name: str = Field(..., max_length=100)
    start_time: time
    end_time: time
    grace_period_minutes: int = 15
    description: Optional[str] = None

class ShiftCreate(ShiftBase):
    pass

class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    grace_period_minutes: Optional[int] = None
    description: Optional[str] = None

class ShiftOut(ShiftBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# Employee Schemas
class EmployeeBase(BaseModel):
    employee_id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    designation: Optional[str] = None
    joining_date: Optional[date] = None
    status: str = "Active"
    department_id: Optional[int] = None
    shift_id: Optional[int] = None
    allow_wfh: bool = False
    wfh_address: Optional[str] = None
    wfh_lat: Optional[float] = None
    wfh_lng: Optional[float] = None

    @field_validator('phone')
    @classmethod
    def validate_indian_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v.strip() == "":
            return None
        # Clean phone number (remove spaces, hyphens, brackets)
        cleaned = re.sub(r'[\s\-()]', '', v)
        if not re.match(r'^(?:\+91|91|0)?[6-9]\d{9}$', cleaned):
            raise ValueError('Invalid Indian mobile number. Must be a 10-digit number starting with 6-9, optionally prefixed with +91, 91, or 0.')
        return v

class EmployeeCreate(EmployeeBase):
    create_user_login: bool = False
    password: Optional[str] = None # Required if create_user_login is True

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    joining_date: Optional[date] = None
    status: Optional[str] = None
    department_id: Optional[int] = None
    shift_id: Optional[int] = None
    allow_wfh: Optional[bool] = None
    wfh_address: Optional[str] = None
    wfh_lat: Optional[float] = None
    wfh_lng: Optional[float] = None

class EmployeeImageOut(BaseModel):
    id: int
    file_path: str
    pose_type: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class EmployeeOut(EmployeeBase):
    id: int
    user_id: Optional[int] = None
    company_id: Optional[int] = None
    department: Optional[DepartmentOut] = None
    shift: Optional[ShiftOut] = None
    images: List[EmployeeImageOut] = []
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class UserOut(UserBase):
    id: int
    is_active: bool
    role_id: int
    role: RoleOut
    company_id: Optional[int] = None
    company: Optional[CompanyOut] = None
    employee: Optional[EmployeeOut] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# Face Embedding Schemas
class FaceEmbeddingBase(BaseModel):
    employee_id: int

class FaceEmbeddingOut(FaceEmbeddingBase):
    id: int
    image_id: Optional[int] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# Attendance Schemas
class AttendanceBase(BaseModel):
    employee_id: int
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: str

class AttendanceOut(AttendanceBase):
    id: int
    working_hours: float
    late_arrival: bool
    early_departure: bool
    overtime: float
    emergency_allowed: bool = False
    late_minutes: Optional[int] = 0
    early_exit_minutes: Optional[int] = 0
    break_time_minutes: Optional[int] = 0
    attendance_streak: Optional[int] = 0
    attendance_percentage: Optional[float] = 0.0
    shift_info: Optional[str] = None
    geofence_result: Optional[str] = None
    policy_version: Optional[str] = None
    employee: Optional[EmployeeOut] = None
    model_config = ConfigDict(from_attributes=True)

class AttendanceUpdate(BaseModel):
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: Optional[str] = None
    emergency_allowed: Optional[bool] = None

# Attendance Log Schemas
class AttendanceLogOut(BaseModel):
    id: int
    employee_id: Optional[int] = None
    timestamp: Optional[datetime] = None
    camera: str
    confidence: Optional[float] = None
    liveness_score: Optional[float] = None
    is_spoof: bool
    status: str
    image_path: Optional[str] = None
    location_text: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    face_quality: Optional[float] = None
    blur_score: Optional[float] = None
    brightness_score: Optional[float] = None
    is_occluded: bool
    has_mask: bool
    recognition_time_ms: Optional[float] = None
    processing_time_ms: Optional[float] = None
    embedding_version: Optional[str] = None
    device_id: Optional[int] = None
    employee: Optional[EmployeeOut] = None
    model_config = ConfigDict(from_attributes=True)

# Leave Request Schemas
class LeaveRequestBase(BaseModel):
    start_date: date
    end_date: date
    leave_type: str
    reason: Optional[str] = None

class LeaveRequestCreate(LeaveRequestBase):
    employee_id: int

class LeaveRequestUpdate(BaseModel):
    status: str # Approved, Rejected

class LeaveRequestOut(LeaveRequestBase):
    id: int
    employee_id: int
    status: str
    approved_by: Optional[int] = None
    created_at: Optional[datetime] = None
    employee: Optional[EmployeeOut] = None
    model_config = ConfigDict(from_attributes=True)

# Holiday Schemas
class HolidayBase(BaseModel):
    name: str
    date: date
    description: Optional[str] = None

class HolidayCreate(HolidayBase):
    pass

class HolidayOut(HolidayBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# Setting Schemas
class SettingBase(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

class SettingUpdate(BaseModel):
    value: str

class SettingOut(SettingBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# Audit Log Schemas
class UserEmailOut(BaseModel):
    email: EmailStr
    model_config = ConfigDict(from_attributes=True)

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user: Optional[UserEmailOut] = None
    action: str
    timestamp: Optional[datetime] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# Ticket Message Schemas
class TicketMessageBase(BaseModel):
    message: str

class TicketMessageCreate(TicketMessageBase):
    pass

class TicketMessageOut(TicketMessageBase):
    id: int
    ticket_id: int
    sender_id: int
    sender: UserEmailOut
    timestamp: datetime
    is_delivered: bool = True
    is_read: bool = False
    model_config = ConfigDict(from_attributes=True)

# Ticket Schemas
class TicketBase(BaseModel):
    title: str
    category: str
    priority: str

class TicketCreate(TicketBase):
    pass

class TicketUpdateStatus(BaseModel):
    status: str

class TicketOut(TicketBase):
    id: int
    employee_id: int
    company_id: int
    status: str
    created_at: datetime
    employee: Optional[EmployeeOut] = None
    messages: List[TicketMessageOut] = []
    model_config = ConfigDict(from_attributes=True)

# Device Schemas
class DeviceBase(BaseModel):
    name: str
    device_type: str = "Kiosk"
    branch: str = "Main Headquarters"
    camera: str = "Main Camera"
    ip_address: Optional[str] = None
    os_info: Optional[str] = None
    app_version: Optional[str] = None

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    disk_usage: Optional[float] = None
    battery_level: Optional[int] = None
    network_status: Optional[str] = None

class DeviceOut(DeviceBase):
    id: int
    company_id: Optional[int] = None
    status: str
    heartbeat: datetime
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    battery_level: int
    network_status: str
    last_sync: datetime
    restart_count: int
    model_config = ConfigDict(from_attributes=True)

# Notification Schemas
class NotificationBase(BaseModel):
    title: str
    message: str
    category: str = "General"
    priority: str = "Medium"
    expires_at: Optional[datetime] = None

class NotificationCreate(NotificationBase):
    recipient_id: Optional[int] = None

class NotificationOut(NotificationBase):
    id: int
    company_id: Optional[int] = None
    recipient_id: Optional[int] = None
    sender_id: Optional[int] = None
    is_read: bool
    is_archived: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# ActivityTimeline Schemas
class ActivityTimelineOut(BaseModel):
    id: int
    company_id: Optional[int] = None
    actor_id: Optional[int] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    timestamp: datetime
    ip_address: Optional[str] = None
    device_info: Optional[str] = None
    browser_info: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
