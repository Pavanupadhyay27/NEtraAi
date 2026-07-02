from fastapi import APIRouter, Depends, HTTPException, status, Query, Response, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_
from typing import Optional
from datetime import date, datetime, timedelta
import io

from app.core.database import get_db
from app.core import security
from app.crud import crud
from app.schemas import schemas
from app.models import models
from app.services.reports import ReportGenerator

router = APIRouter()

checker_view = security.RoleChecker(["Super Admin", "Admin", "HR"])

@router.get("/export")
def export_report(
    request: Request,
    report_type: str = Query(..., description="daily, weekly, monthly, employee, department"),
    format: str = Query("csv", description="csv, xlsx, pdf"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    employee_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    min_hours: Optional[float] = Query(None),
    max_hours: Optional[float] = Query(None),
    columns: Optional[str] = Query(None, description="Comma-separated column names to include"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    # Establish defaults for dates
    if not start_date:
        start_date = date.today() - timedelta(days=30)
    if not end_date:
        end_date = date.today()

    # Query attendance records
    query = db.query(models.Attendance).join(models.Employee)
    filters = [models.Attendance.date.between(start_date, end_date)]
    
    if employee_id:
        filters.append(models.Attendance.employee_id == employee_id)
    if department_id:
        filters.append(models.Employee.department_id == department_id)
    if min_hours is not None:
        filters.append(models.Attendance.working_hours >= min_hours)
    if max_hours is not None:
        filters.append(models.Attendance.working_hours <= max_hours)
        
    query = query.filter(and_(*filters)).order_by(models.Attendance.date.desc())
    records = query.all()

    # Format the data into lists of dicts (for CSV/Excel) and nested lists (for PDF)
    data = []
    pdf_rows = []
    
    # Parse columns
    selected_cols = [c.strip() for c in columns.split(",")] if columns else [
        "Date", "Employee ID", "Name", "Department", "Check In", "Check Out", "Hours Worked", "Overtime", "Status"
    ]
    
    headers = selected_cols
    
    for r in records:
        dept_name = r.employee.department.name if r.employee.department else "General"
        ci_str = r.check_in.strftime("%H:%M:%S") if r.check_in else "-"
        co_str = r.check_out.strftime("%H:%M:%S") if r.check_out else "-"
        
        full_row = {
            "Date": str(r.date),
            "Employee ID": r.employee.employee_id,
            "Name": r.employee.name,
            "Department": dept_name,
            "Check In": ci_str,
            "Check Out": co_str,
            "Hours Worked": r.working_hours,
            "Overtime": r.overtime,
            "Status": r.status
        }
        
        row_dict = {col: full_row.get(col, "-") for col in selected_cols}
        data.append(row_dict)
        
        pdf_row = []
        for col in selected_cols:
            val = full_row.get(col, "-")
            if col in ["Name", "Department"] and isinstance(val, str):
                pdf_row.append(val[:15])
            else:
                pdf_row.append(str(val))
        pdf_rows.append(pdf_row)
        
    title = f"NetraID Attendance Report ({report_type.capitalize()})"
    metadata = {
        "Report Type": report_type.capitalize(),
        "Exported By": current_user.email,
        "Start Date": str(start_date),
        "End Date": str(end_date),
        "Total Records": str(len(records))
    }

    # Audit download
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Export Attendance Report",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Exported {report_type} report in {format} format."
    )

    if format.lower() == "csv":
        csv_data = ReportGenerator.to_csv(data)
        response = Response(content=csv_data, media_type="text/csv")
        response.headers["Content-Disposition"] = f"attachment; filename=attendance_{report_type}_{start_date}_to_{end_date}.csv"
        return response
        
    elif format.lower() == "xlsx":
        xlsx_data = ReportGenerator.to_xlsx(data, sheet_name="Attendance")
        response = Response(content=xlsx_data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response.headers["Content-Disposition"] = f"attachment; filename=attendance_{report_type}_{start_date}_to_{end_date}.xlsx"
        return response
        
    elif format.lower() == "pdf":
        pdf_data = ReportGenerator.to_pdf(title, headers, pdf_rows, metadata)
        response = Response(content=pdf_data, media_type="application/pdf")
        response.headers["Content-Disposition"] = f"attachment; filename=attendance_{report_type}_{start_date}_to_{end_date}.pdf"
        return response
        
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Supported: csv, xlsx, pdf")

@router.get("/preview")
def preview_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    employee_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    min_hours: Optional[float] = Query(None),
    max_hours: Optional[float] = Query(None),
    columns: Optional[str] = Query(None, description="Comma-separated column names to include"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_view)
):
    """
    Returns filtered attendance records and columns for custom preview in the UI before export.
    """
    if not start_date:
        start_date = date.today() - timedelta(days=30)
    if not end_date:
        end_date = date.today()

    query = db.query(models.Attendance).join(models.Employee)
    filters = [models.Attendance.date.between(start_date, end_date)]
    
    if employee_id:
        filters.append(models.Attendance.employee_id == employee_id)
    if department_id:
        filters.append(models.Employee.department_id == department_id)
    if min_hours is not None:
        filters.append(models.Attendance.working_hours >= min_hours)
    if max_hours is not None:
        filters.append(models.Attendance.working_hours <= max_hours)
        
    query = query.filter(and_(*filters)).order_by(models.Attendance.date.desc())
    records = query.all()

    # Parse columns
    selected_cols = [c.strip() for c in columns.split(",")] if columns else [
        "Date", "Employee ID", "Name", "Department", "Check In", "Check Out", "Hours Worked", "Overtime", "Status"
    ]

    data = []
    for r in records:
        dept_name = r.employee.department.name if r.employee.department else "General"
        ci_str = r.check_in.strftime("%H:%M:%S") if r.check_in else "-"
        co_str = r.check_out.strftime("%H:%M:%S") if r.check_out else "-"
        
        full_row = {
            "Date": str(r.date),
            "Employee ID": r.employee.employee_id,
            "Name": r.employee.name,
            "Department": dept_name,
            "Check In": ci_str,
            "Check Out": co_str,
            "Hours Worked": r.working_hours,
            "Overtime": r.overtime,
            "Status": r.status
        }
        
        filtered_row = {col: full_row.get(col, "-") for col in selected_cols}
        data.append(filtered_row)
        
    return {
        "columns": selected_cols,
        "records": data,
        "total_count": len(records)
    }
