from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core import security
from app.crud import crud
from app.schemas import schemas
from app.models import models

router = APIRouter()

@router.get("/", response_model=List[schemas.TicketOut])
def read_tickets(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    role_name = current_user.role.name if current_user.role else "Employee"
    
    if role_name in ["Super Admin", "Admin", "HR"]:
        # Admins/HR can see all tickets for their company
        return crud.get_tickets(db, company_id=current_user.company_id)
    else:
        # Employees can only see their own tickets
        if not current_user.employee:
            raise HTTPException(status_code=400, detail="User is not registered as an employee")
        return crud.get_tickets(db, company_id=current_user.company_id, employee_id=current_user.employee.id)

@router.post("/", response_model=schemas.TicketOut, status_code=status.HTTP_201_CREATED)
def create_ticket(
    request: Request,
    ticket: schemas.TicketCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    role_name = current_user.role.name if current_user.role else "Employee"
    if role_name != "Employee":
        raise HTTPException(status_code=403, detail="Only employees can open support tickets")
        
    if not current_user.employee:
        raise HTTPException(status_code=400, detail="User is not registered as an employee")
        
    db_ticket = crud.create_ticket(
        db, ticket=ticket, employee_id=current_user.employee.id, company_id=current_user.company_id
    )
    
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Open Support Ticket",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Opened ticket ID {db_ticket.id}: '{ticket.title}'",
        company_id=current_user.company_id
    )
    return db_ticket

@router.post("/{id}/messages", response_model=schemas.TicketMessageOut, status_code=status.HTTP_201_CREATED)
def reply_to_ticket(
    id: int,
    message: schemas.TicketMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    db_ticket = crud.get_ticket_by_id(db, ticket_id=id)
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    # Check company ownership scope
    if current_user.company_id is not None and db_ticket.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this resource")
        
    role_name = current_user.role.name if current_user.role else "Employee"
    if role_name == "Employee":
        if not current_user.employee or db_ticket.employee_id != current_user.employee.id:
            raise HTTPException(status_code=403, detail="Not authorized to post to this ticket")
            
    db_message = crud.create_ticket_message(db, ticket_id=id, msg=message, sender_id=current_user.id)
    return db_message

@router.put("/{id}/status", response_model=schemas.TicketOut)
def update_ticket(
    request: Request,
    id: int,
    payload: schemas.TicketUpdateStatus,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    db_ticket = crud.get_ticket_by_id(db, ticket_id=id)
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if current_user.company_id is not None and db_ticket.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this resource")
        
    role_name = current_user.role.name if current_user.role else "Employee"
    if role_name not in ["Super Admin", "Admin", "HR"]:
        raise HTTPException(status_code=403, detail="Only HR or administrators can resolve support tickets")
        
    updated = crud.update_ticket_status(db, ticket_id=id, status=payload.status)
    
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Resolve Support Ticket",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Updated ticket ID {id} status to '{payload.status}'",
        company_id=current_user.company_id
    )
    return updated
