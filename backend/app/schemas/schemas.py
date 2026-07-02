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

class UserOut(UserBase):
    id: int
    is_active: bool
    role_id: int
    role: RoleOut
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

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
    joining_date: date
    status: str = "Active"
    department_id: Optional[int] = None
    shift_id: Optional[int] = None
    allow_wfh: bool = False

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

class EmployeeImageOut(BaseModel):
    id: int
    file_path: str
    pose_type: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class EmployeeOut(EmployeeBase):
    id: int
    user_id: Optional[int] = None
    department: Optional[DepartmentOut] = None
    shift: Optional[ShiftOut] = None
    images: List[EmployeeImageOut] = []
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
