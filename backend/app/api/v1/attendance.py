from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timedelta, time
from sqlalchemy import and_

from app.core.database import get_db
from app.core import security
from app.crud import crud
from app.schemas import schemas
from app.models import models

router = APIRouter()

checker_view = security.RoleChecker(["Super Admin", "Admin", "HR"])
checker_manage = security.RoleChecker(["Super Admin", "Admin"])

@router.get("/daily", response_model=List[schemas.AttendanceOut])
def read_daily_attendance(
    date_val: Optional[date] = None,
    employee_id: Optional[int] = None,
    department_id: Optional[int] = None,
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    target_company_id = current_user.company_id if current_user.company_id is not None else company_id
    if not date_val:
        date_val = date.today()
    if department_id:
        dept = crud.get_department_by_id(db, department_id)
        if not dept or (target_company_id is not None and dept.company_id != target_company_id):
            raise HTTPException(status_code=404, detail="Department not found")
    if employee_id:
        emp = crud.get_employee_by_id(db, employee_id)
        if not emp or (target_company_id is not None and emp.company_id != target_company_id):
            raise HTTPException(status_code=404, detail="Employee not found")
            
    return crud.get_daily_attendance(
        db, date_val=date_val, employee_id=employee_id, department_id=department_id, company_id=target_company_id
    )

@router.put("/{id}", response_model=schemas.AttendanceOut)
def manual_update_attendance(
    request: Request,
    id: int,
    data: schemas.AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    db_att = crud.get_attendance_by_id(db, id)
    if not db_att or (current_user.company_id is not None and db_att.employee.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Attendance record not found")
        
    updated = crud.update_attendance(db, id=id, data=data)
    if not updated:
        raise HTTPException(status_code=404, detail="Attendance record not found")
        
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Manual Attendance Correction",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Adjusted attendance ID: {id} for date {updated.date}. New Status: {updated.status}",
        company_id=current_user.company_id
    )
    return updated

@router.post("/manual", response_model=schemas.AttendanceOut)
def manual_create_or_update_attendance(
    request: Request,
    data: schemas.AttendanceBase,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    # Verify employee exists and matches company
    employee = db.query(models.Employee).filter(
        models.Employee.id == data.employee_id
    ).first()
    if not employee or (current_user.company_id is not None and employee.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Employee not found")
        
    # Check if record already exists for that employee and date
    db_att = db.query(models.Attendance).filter(
        and_(
            models.Attendance.employee_id == data.employee_id,
            models.Attendance.date == data.date
        )
    ).first()
    
    if db_att:
        # Update existing record
        db_att.check_in = data.check_in
        db_att.check_out = data.check_out
        db_att.status = data.status
    else:
        # Create new record
        db_att = models.Attendance(
            employee_id=data.employee_id,
            date=data.date,
            check_in=data.check_in,
            check_out=data.check_out,
            status=data.status,
            late_arrival=False,
            early_departure=False,
            working_hours=0.0,
            overtime=0.0,
            emergency_allowed=False
        )
        db.add(db_att)
        
    # Determine late arrival flag based on shift or global settings
    if db_att.check_in:
        # Resolve shift start
        if employee.shift:
            shift_start = employee.shift.start_time
            grace_mins = employee.shift.grace_period_minutes
        else:
            start_time_setting = crud.get_setting_by_key(db, "CHECK_IN_START", company_id=employee.company_id)
            grace_period_setting = crud.get_setting_by_key(db, "GRACE_PERIOD_MINUTES", company_id=employee.company_id)
            
            start_str = start_time_setting.value if start_time_setting else "09:00"
            grace_mins = int(grace_period_setting.value) if grace_period_setting else 15
            try:
                hr, mn = map(int, start_str.split(":"))
                shift_start = time(hr, mn)
            except Exception:
                shift_start = time(9, 0)
                
        check_in_deadline = datetime.combine(db_att.date, shift_start) + timedelta(minutes=grace_mins)
        db_att.late_arrival = db_att.check_in > check_in_deadline
        if db_att.status not in ["Absent", "Half Day"]:
            db_att.status = "Late" if db_att.late_arrival else "Present"
    else:
        db_att.late_arrival = False

    # Recalculate working hours if both check_in and check_out exist
    if db_att.check_in and db_att.check_out:
        diff = db_att.check_out - db_att.check_in
        db_att.working_hours = round(diff.total_seconds() / 3600.0, 2)
        db_att.overtime = max(0.0, round(db_att.working_hours - 8.0, 2))
    else:
        db_att.working_hours = 0.0
        db_att.overtime = 0.0
        
    db.commit()
    db.refresh(db_att)
    
    # Create audit log
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Manual Attendance Override",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Manually logged attendance for employee {employee.name} (ID: {employee.employee_id}) on {data.date}. Status: {db_att.status}",
        company_id=current_user.company_id
    )
    return db_att

@router.get("/logs", response_model=List[schemas.AttendanceLogOut])
def read_attendance_logs(
    skip: int = 0,
    limit: int = 100,
    employee_id: Optional[int] = None,
    date_str: Optional[str] = None, # YYYY-MM-DD
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    role_name = current_user.role.name if current_user.role else "Employee"
    if role_name == "Employee":
        if not current_user.employee:
            return []
        employee_id = current_user.employee.id
        
    target_company_id = current_user.company_id if current_user.company_id is not None else company_id
    return crud.get_attendance_logs(db, company_id=target_company_id, skip=skip, limit=limit, employee_id=employee_id, date_str=date_str)

@router.get("/employee/{employee_id}", response_model=List[schemas.AttendanceOut])
def get_employee_attendance_history(
    employee_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    emp = crud.get_employee_by_id(db, employee_id)
    if not emp or (current_user.company_id is not None and emp.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Employee not found")

    role_name = current_user.role.name if current_user.role else "Employee"
    if role_name not in ["Super Admin", "Admin", "HR"]:
        if not current_user.employee or current_user.employee.id != employee_id:
            raise HTTPException(status_code=403, detail="Not authorized to view other employee records")

    if not start_date:
        start_date = date.today() - timedelta(days=30)
    if not end_date:
        end_date = date.today()
    from sqlalchemy import and_
    return db.query(models.Attendance).filter(
        and_(
            models.Attendance.employee_id == employee_id,
            models.Attendance.date.between(start_date, end_date)
        )
    ).order_by(models.Attendance.date.desc()).all()
