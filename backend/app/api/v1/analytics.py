from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_, desc
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
import asyncio
import json

from app.core.database import get_db
from app.core import security
from app.core.security import RoleCheckerSSE
from app.core import event_bus
from app.crud import crud
from app.schemas import schemas
from app.models import models

router = APIRouter()

checker_view = security.RoleChecker(["Super Admin", "Admin", "HR"])

@router.get("/dashboard-summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    today = date.today()
    
    # 1. Total Employees
    total_employees = db.query(func.count(models.Employee.id)).filter(
        models.Employee.status == "Active"
    ).scalar() or 0
    
    # 2. Present Today (Status = Present or Late or Half Day)
    present_today = db.query(func.count(models.Attendance.id)).filter(
        and_(
            models.Attendance.date == today,
            models.Attendance.status.in_(["Present", "Late", "Half Day"])
        )
    ).scalar() or 0
    
    # 3. Late Today
    late_today = db.query(func.count(models.Attendance.id)).filter(
        and_(
            models.Attendance.date == today,
            models.Attendance.status == "Late"
        )
    ).scalar() or 0
    
    # 4. Checked Out
    checked_out_today = db.query(func.count(models.Attendance.id)).filter(
        and_(
            models.Attendance.date == today,
            models.Attendance.check_out.isnot(None)
        )
    ).scalar() or 0
    
    # 5. Absent Today
    absent_today = max(0, total_employees - present_today)
    
    # 6. Attendance Rate
    attendance_percentage = (present_today / total_employees * 100) if total_employees > 0 else 0.0
    
    return {
        "total_employees": total_employees,
        "present_today": present_today,
        "absent_today": absent_today,
        "late_today": late_today,
        "checked_out_today": checked_out_today,
        "attendance_percentage": round(attendance_percentage, 1)
    }

@router.get("/attendance-trends")
def get_attendance_trends(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    """
    Returns daily stats for the last N days (date, present, late, absent) for ECharts.
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)
    
    # Generate list of dates
    date_list = [start_date + timedelta(days=i) for i in range(days)]
    
    # Get total active employees for this company
    query = db.query(func.count(models.Employee.id)).filter(
        models.Employee.status == "Active"
    )
    if current_user.company_id is not None:
        query = query.filter(models.Employee.company_id == current_user.company_id)
    total_active = query.scalar() or 0
    
    trends = []
    for d in date_list:
        # Present status checks (include WFH as active)
        present_query = db.query(func.count(models.Attendance.id)).join(
            models.Employee, models.Attendance.employee_id == models.Employee.id
        ).filter(
            and_(
                models.Attendance.date == d,
                models.Attendance.status.in_(["Present", "Late", "Half Day", "WFH"])
            )
        )
        if current_user.company_id is not None:
            present_query = present_query.filter(models.Employee.company_id == current_user.company_id)
        present = present_query.scalar() or 0
        
        # Late status check
        late_query = db.query(func.count(models.Attendance.id)).join(
            models.Employee, models.Attendance.employee_id == models.Employee.id
        ).filter(
            and_(
                models.Attendance.date == d,
                models.Attendance.status == "Late"
            )
        )
        if current_user.company_id is not None:
            late_query = late_query.filter(models.Employee.company_id == current_user.company_id)
        late = late_query.scalar() or 0
        
        absent = max(0, total_active - present)
        
        trends.append({
            "date": d.isoformat(),
            "present": present,
            "late": late,
            "absent": absent
        })
        
    return trends

@router.get("/department-distribution")
def get_department_distribution(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    """
    Returns employee and attendance counts by department for ECharts.
    """
    today = date.today()
    if current_user.company_id is not None:
        departments = db.query(models.Department).filter(models.Department.company_id == current_user.company_id).all()
    else:
        departments = db.query(models.Department).all()
    
    dist = []
    for dept in departments:
        # Total active in dept
        total_in_dept = db.query(func.count(models.Employee.id)).filter(
            and_(
                models.Employee.department_id == dept.id,
                models.Employee.status == "Active"
            )
        ).scalar() or 0
        
        # Present today in dept
        present_in_dept = db.query(func.count(models.Attendance.id)).join(models.Employee).filter(
            and_(
                models.Employee.department_id == dept.id,
                models.Attendance.date == today,
                models.Attendance.status.in_(["Present", "Late", "Half Day"])
            )
        ).scalar() or 0
        
        dist.append({
            "id": dept.id,
            "department": dept.name,
            "code": dept.code,
            "total_employees": total_in_dept,
            "present_today": present_in_dept
        })
        
    return dist

@router.get("/recent-activity", response_model=List[schemas.AttendanceLogOut])
def get_recent_activity(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    """
    Returns latest kiosk scan logs for the dashboard tickfeed.
    """
    cutoff = datetime.utcnow() - timedelta(hours=24)
    return db.query(models.AttendanceLog).filter(
        models.AttendanceLog.timestamp >= cutoff
    ).order_by(desc(models.AttendanceLog.timestamp)).limit(limit).all()


@router.get("/live-stream")
async def live_stream(
    current_user: models.User = Depends(RoleCheckerSSE(["Super Admin", "Admin", "HR"]))
):
    """
    Real-time Server-Sent Events (SSE) feed of kiosk scans.
    """
    async def event_generator():
        queue = event_bus.subscribe()
        try:
            while True:
                # Wait for next event published to the bus
                event_data = await queue.get()
                
                # Yield standard SSE formatted message
                yield f"data: {json.dumps(event_data)}\n\n"
        except asyncio.CancelledError:
            # Client disconnected
            pass
        finally:
            event_bus.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/heatmap")
def get_attendance_heatmap(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    """
    Returns daily attendance counts for the last 365 days to render a GitHub-style heatmap.
    """
    start_date = date.today() - timedelta(days=365)
    
    query = db.query(
        models.Attendance.date,
        func.count(models.Attendance.id)
    ).filter(
        models.Attendance.date >= start_date
    )
    
    if employee_id:
        query = query.filter(models.Attendance.employee_id == employee_id)
        query = query.filter(models.Attendance.status.in_(["Present", "Late", "Half Day"]))
    else:
        query = query.filter(models.Attendance.status.in_(["Present", "Late", "Half Day"]))
        
    results = query.group_by(models.AttendanceDate).all() if hasattr(models, 'AttendanceDate') else query.group_by(models.Attendance.date).all()
    
    heatmap_data = {r[0].isoformat(): r[1] for r in results}
    return heatmap_data

@router.get("/recognition")
def get_recognition_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    company_id = current_user.company_id
    logs_query = db.query(models.AttendanceLog)
    if company_id is not None:
        logs_query = logs_query.join(models.Employee).filter(models.Employee.company_id == company_id)
        
    total_scans = logs_query.count()
    spoofs = logs_query.filter(models.AttendanceLog.is_spoof == True).count()
    
    avg_confidence = db.query(func.avg(models.AttendanceLog.confidence))
    if company_id is not None:
        avg_confidence = avg_confidence.join(models.Employee).filter(models.Employee.company_id == company_id)
    avg_confidence_val = avg_confidence.scalar() or 0.0
    
    avg_proc_time = db.query(func.avg(models.AttendanceLog.processing_time_ms))
    if company_id is not None:
        avg_proc_time = avg_proc_time.join(models.Employee).filter(models.Employee.company_id == company_id)
    avg_proc_val = avg_proc_time.scalar() or 120.0  # fallback baseline ms
    
    return {
        "total_scans": total_scans,
        "spoof_attempts": spoofs,
        "average_confidence": round(float(avg_confidence_val), 2),
        "average_processing_time_ms": round(float(avg_proc_val), 1)
    }

@router.get("/occupancy")
def get_office_occupancy(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    company_id = current_user.company_id
    today = date.today()
    
    active_emp_query = db.query(models.Employee).filter(models.Employee.status == "Active")
    if company_id is not None:
        active_emp_query = active_emp_query.filter(models.Employee.company_id == company_id)
    total_strength = active_emp_query.count()
    
    present_query = db.query(models.Attendance).join(models.Employee).filter(
        and_(
            models.Attendance.date == today,
            models.Attendance.check_in.isnot(None),
            models.Attendance.check_out.is_(None)
        )
    )
    if company_id is not None:
        present_query = present_query.filter(models.Employee.company_id == company_id)
        
    occupied_count = present_query.count()
    
    return {
        "total_strength": total_strength,
        "occupied_count": occupied_count,
        "occupancy_rate_percentage": round((occupied_count / total_strength * 100) if total_strength > 0 else 0.0, 1)
    }

@router.get("/late-trends")
def get_late_trends(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    company_id = current_user.company_id
    today = date.today()
    start_date = today - timedelta(days=30)
    
    query = db.query(
        models.Attendance.date,
        func.avg(models.Attendance.late_minutes)
    ).join(models.Employee).filter(
        and_(
            models.Attendance.date >= start_date,
            models.Attendance.late_minutes > 0
        )
    )
    if company_id is not None:
        query = query.filter(models.Employee.company_id == company_id)
        
    results = query.group_by(models.Attendance.date).order_by(models.Attendance.date.asc()).all()
    
    return [{"date": r[0].isoformat(), "average_late_minutes": round(float(r[1]), 1)} for r in results]
