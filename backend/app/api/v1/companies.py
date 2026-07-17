from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core import security
from app.crud import crud
from app.schemas import schemas
from app.models import models

router = APIRouter()

# Verify role -> only Super Admin has access to tenant management
checker_super = security.RoleChecker(["Super Admin"])

@router.get("/", response_model=List[schemas.CompanyOut])
def read_companies(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_super)
):
    return crud.get_companies(db, skip=skip, limit=limit)

@router.get("/{id}", response_model=schemas.CompanyOut)
def read_company(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_super)
):
    db_company = crud.get_company_by_id(db, company_id=id)
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    return db_company

@router.post("/", response_model=schemas.CompanyOut, status_code=status.HTTP_201_CREATED)
def create_company(
    request: Request,
    company: schemas.CompanyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_super)
):
    existing = crud.get_company_by_name(db, name=company.name)
    if existing:
        raise HTTPException(status_code=400, detail="Company name already exists")
    
    db_company = crud.create_company(db, company=company)
    
    # Create Company Admin User if email is provided
    if company.admin_email:
        existing_user = crud.get_user_by_email(db, company.admin_email)
        if not existing_user:
            admin_role = crud.get_role_by_name(db, "Admin")
            if admin_role:
                from app.core.security import get_password_hash
                password_to_use = company.admin_password if company.admin_password else "Admin@NetraID2026"
                hashed_pwd = get_password_hash(password_to_use)
                new_admin = models.User(
                    email=company.admin_email,
                    hashed_password=hashed_pwd,
                    role_id=admin_role.id,
                    company_id=db_company.id,
                    is_active=True if company.status == "Active" else False
                )
                db.add(new_admin)
                db.commit()

    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Create Company",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Onboarded company: {company.name}"
    )
    return db_company

@router.put("/{id}", response_model=schemas.CompanyOut)
def update_company(
    request: Request,
    id: int,
    company: schemas.CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_super)
):
    db_company = crud.get_company_by_id(db, id)
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    old_status = db_company.status
    updated = crud.update_company(db, company_id=id, company=company)
    
    # Auto-activate administrators if company is marked Active
    if company.status == "Active" and old_status != "Active":
        from sqlalchemy import select
        users_to_activate = db.execute(
            select(models.User).where(models.User.company_id == id)
        ).scalars().all()
        for u in users_to_activate:
            if u.role and u.role.name in ["Admin", "HR"]:
                u.is_active = True
        db.commit()
        
    details = f"Updated company ID: {id}."
    if company.status and company.status != old_status:
        details += f" Status changed from '{old_status}' to '{company.status}'."
        
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Update Company",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=details
    )
    return updated

@router.delete("/{id}")
def delete_company(
    request: Request,
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_super)
):
    db_company = crud.get_company_by_id(db, id)
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")

    company_name = db_company.name

    try:
        from sqlalchemy import select, delete as sql_delete

        # 1. Get all employee IDs under this company
        emp_ids = db.execute(
            select(models.Employee.id).where(models.Employee.company_id == id)
        ).scalars().all()

        if emp_ids:
            # 2. Delete ticket messages for tickets belonging to these employees
            ticket_ids = db.execute(
                select(models.Ticket.id).where(models.Ticket.company_id == id)
            ).scalars().all()
            if ticket_ids:
                db.execute(sql_delete(models.TicketMessage).where(models.TicketMessage.ticket_id.in_(ticket_ids)))

            # 3. Delete face embeddings for employee images
            image_ids = db.execute(
                select(models.EmployeeImage.id).where(models.EmployeeImage.employee_id.in_(emp_ids))
            ).scalars().all()
            if image_ids:
                db.execute(sql_delete(models.FaceEmbedding).where(models.FaceEmbedding.image_id.in_(image_ids)))
            db.execute(sql_delete(models.FaceEmbedding).where(models.FaceEmbedding.employee_id.in_(emp_ids)))

            # 4. Delete employee images
            db.execute(sql_delete(models.EmployeeImage).where(models.EmployeeImage.employee_id.in_(emp_ids)))

            # 5. Delete attendance records and logs
            db.execute(sql_delete(models.Attendance).where(models.Attendance.employee_id.in_(emp_ids)))
            db.execute(sql_delete(models.AttendanceLog).where(models.AttendanceLog.employee_id.in_(emp_ids)))

            # 6. Delete leave requests
            db.execute(sql_delete(models.LeaveRequest).where(models.LeaveRequest.employee_id.in_(emp_ids)))

            # 7. Delete tickets
            db.execute(sql_delete(models.Ticket).where(models.Ticket.company_id == id))

        # 8. Delete notifications
        db.execute(sql_delete(models.Notification).where(models.Notification.company_id == id))

        # 9. Delete activity timelines
        db.execute(sql_delete(models.ActivityTimeline).where(models.ActivityTimeline.company_id == id))

        # 10. Null out employee user_id FK before deleting users
        if emp_ids:
            db.execute(
                models.Employee.__table__.update()
                .where(models.Employee.id.in_(emp_ids))
                .values(user_id=None)
            )
            db.flush()

        # 11. Delete employees
        db.execute(sql_delete(models.Employee).where(models.Employee.company_id == id))

        # 12. Delete users (employees' login accounts)
        db.execute(sql_delete(models.User).where(models.User.company_id == id))

        # 13. Delete departments and shifts
        db.execute(sql_delete(models.Department).where(models.Department.company_id == id))
        db.execute(sql_delete(models.Shift).where(models.Shift.company_id == id))

        # 14. Delete settings, audit logs, devices
        db.execute(sql_delete(models.Setting).where(models.Setting.company_id == id))
        db.execute(sql_delete(models.AuditLog).where(models.AuditLog.company_id == id))
        db.execute(sql_delete(models.Device).where(models.Device.company_id == id))

        # 15. Finally delete the company itself
        db.execute(sql_delete(models.Company).where(models.Company.id == id))
        db.commit()

    except Exception as e:
        db.rollback()
        # Log the full technical error server-side for debugging
        import logging
        logging.getLogger("NetraID").error(f"Company deletion failed for ID {id}: {e}", exc_info=True)
        # Return a sanitized message to the client (no internal details)
        raise HTTPException(status_code=500, detail="Failed to delete company. Please try again or contact support.")

    return {"message": f"Company '{company_name}' and all associated data deleted successfully"}
