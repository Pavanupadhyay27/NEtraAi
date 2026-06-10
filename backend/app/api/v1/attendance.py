from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timedelta

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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    if not date_val:
        date_val = date.today()
    return crud.get_daily_attendance(db, date_val=date_val, employee_id=employee_id, department_id=department_id)

@router.put("/{id}", response_model=schemas.AttendanceOut)
def manual_update_attendance(
    request: Request,
    id: int,
    data: schemas.AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_manage)
):
    updated = crud.update_attendance(db, id=id, data=data)
    if not updated:
        raise HTTPException(status_code=404, detail="Attendance record not found")
        
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Manual Attendance Correction",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Adjusted attendance ID: {id} for date {updated.date}. New Status: {updated.status}"
    )
    return updated

@router.get("/logs", response_model=List[schemas.AttendanceLogOut])
def read_attendance_logs(
    skip: int = 0,
    limit: int = 100,
    employee_id: Optional[int] = None,
    date_str: Optional[str] = None, # YYYY-MM-DD
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    return crud.get_attendance_logs(db, skip=skip, limit=limit, employee_id=employee_id, date_str=date_str)

@router.get("/employee/{employee_id}", response_model=List[schemas.AttendanceOut])
def get_employee_attendance_history(
    employee_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
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
