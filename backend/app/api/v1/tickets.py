from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core import security
from app.crud import crud
from app.schemas import schemas
from app.models import models

router = APIRouter()

@router.get("/", response_model=List[schemas.TicketOut])
def read_tickets(
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    role_name = current_user.role.name if current_user.role else "Employee"
    target_company_id = current_user.company_id if current_user.company_id is not None else company_id
    
    def is_admin_ticket(t):
        # Look up the sender of the first message in this ticket
        first_msg = db.query(models.TicketMessage).filter(models.TicketMessage.ticket_id == t.id).order_by(models.TicketMessage.timestamp.asc()).first()
        if first_msg:
            sender_user = db.query(models.User).filter(models.User.id == first_msg.sender_id).first()
            if sender_user and sender_user.role:
                return sender_user.role.name in ["Super Admin", "Admin", "HR"]
        # Fallback to checking the ticket owner employee user role
        if t.employee and t.employee.user and t.employee.user.role:
            return t.employee.user.role.name in ["Super Admin", "Admin", "HR"]
        return False

    if role_name == "Super Admin":
        # Super Admin resolves admin/HR problems. Show admin tickets across all companies.
        all_tickets = crud.get_tickets(db, company_id=target_company_id)
        return [t for t in all_tickets if is_admin_ticket(t)]
        
    elif role_name in ["Admin", "HR"]:
        # Company Admin/HR resolves employee grievances/problems. Show employee tickets only.
        company_tickets = crud.get_tickets(db, company_id=target_company_id)
        return [t for t in company_tickets if not is_admin_ticket(t)]
        
    else:
        # Employees can only see their own tickets
        if not current_user.employee:
            raise HTTPException(status_code=400, detail="User is not registered as an employee")
        return crud.get_tickets(db, company_id=target_company_id, employee_id=current_user.employee.id)

@router.post("/", response_model=schemas.TicketOut, status_code=status.HTTP_201_CREATED)
def create_ticket(
    request: Request,
    ticket: schemas.TicketCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    employee_id = current_user.employee.id if current_user.employee else None
    if not employee_id:
        # Check if user has an associated employee profile or grab first employee profile if admin
        first_emp = db.query(models.Employee).filter(models.Employee.company_id == current_user.company_id).first()
        if first_emp:
            employee_id = first_emp.id
        else:
            raise HTTPException(status_code=400, detail="No registered employee profile found for opening ticket")
        
    db_ticket = crud.create_ticket(
        db, ticket=ticket, employee_id=employee_id, company_id=current_user.company_id
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

from fastapi.responses import StreamingResponse
import json
import asyncio

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
    
    # Notify employee if admin/HR replies
    if db_ticket.employee and db_ticket.employee.user_id and db_ticket.employee.user_id != current_user.id:
        db_ntf = models.Notification(
            company_id=db_ticket.company_id,
            recipient_id=db_ticket.employee.user_id,
            sender_id=current_user.id,
            title="New Support Ticket Reply",
            message=f"New message on ticket #{db_ticket.id} ('{db_ticket.title}'): \"{message.message[:60]}...\"",
            category="HR",
            priority="Medium"
        )
        db.add(db_ntf)
        db.commit()

        # Trigger Web Push notification in the background
        from app.core.webpush_service import send_notification_to_user
        try:
            send_notification_to_user(
                db=db,
                user_id=db_ticket.employee.user_id,
                title=f"Support Ticket #{db_ticket.id}",
                message=f"New reply: \"{message.message[:50]}...\"",
                url="/tickets"
            )
        except Exception:
            pass
    
    # Broadcast reply to SSE stream
    from app.core import event_bus
    event_payload = {
        "id": db_message.id,
        "ticket_id": db_message.ticket_id,
        "sender_id": db_message.sender_id,
        "sender": {
            "email": db_message.sender.email if db_message.sender else current_user.email
        },
        "message": db_message.message,
        "timestamp": db_message.timestamp.isoformat(),
        "is_delivered": True,
        "is_read": False
    }
    event_bus.publish_ticket_message(event_payload)
    
    return db_message


@router.post("/{id}/read")
def mark_ticket_read(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    db_ticket = crud.get_ticket_by_id(db, ticket_id=id)
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    db.query(models.TicketMessage).filter(
        models.TicketMessage.ticket_id == id,
        models.TicketMessage.sender_id != current_user.id
    ).update({"is_read": True, "is_delivered": True})
    db.commit()
    
    # Broadcast read status update to SSE stream
    from app.core import event_bus
    event_bus.publish_ticket_message({
        "ticket_id": id,
        "type": "read_receipt",
        "reader_id": current_user.id
    })
    
    return {"status": "ok"}


@router.post("/{id}/typing")
def send_typing_status(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    db_ticket = crud.get_ticket_by_id(db, ticket_id=id)
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if current_user.company_id is not None and db_ticket.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this resource")
        
    from app.core import event_bus
    event_payload = {
        "type": "typing",
        "ticket_id": id,
        "sender_id": current_user.id,
        "email": current_user.email
    }
    event_bus.publish_ticket_message(event_payload)
    return {"status": "ok"}

@router.get("/{id}/stream")
async def ticket_stream(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user_sse)
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
            raise HTTPException(status_code=403, detail="Not authorized to access this ticket stream")

    async def event_generator():
        from app.core import event_bus
        queue = event_bus.subscribe_tickets()
        try:
            while True:
                # Wait for next event published to the bus
                event_data = await queue.get()
                if event_data.get("ticket_id") == id:
                    yield f"data: {json.dumps(event_data)}\n\n"
        except asyncio.CancelledError:
            # Client disconnected
            pass
        finally:
            event_bus.unsubscribe_tickets(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

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
    
    # Notify employee if ticket status is changed
    if db_ticket.employee and db_ticket.employee.user_id:
        db_ntf = models.Notification(
            company_id=db_ticket.company_id,
            recipient_id=db_ticket.employee.user_id,
            sender_id=current_user.id,
            title=f"Ticket #{db_ticket.id} {payload.status}",
            message=f"Your support ticket #{db_ticket.id} ('{db_ticket.title}') has been marked as {payload.status.lower()}.",
            category="HR",
            priority="Medium"
        )
        db.add(db_ntf)
        db.commit()
    
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

from fastapi import UploadFile, File
from fastapi.responses import FileResponse
import os
import shutil

@router.post("/{id}/attachment", response_model=schemas.TicketMessageOut, status_code=status.HTTP_201_CREATED)
def upload_attachment(
    id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    db_ticket = crud.get_ticket_by_id(db, ticket_id=id)
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if current_user.company_id is not None and db_ticket.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this resource")
        
    # Read file bytes
    content = file.file.read()
    
    # Try Cloudinary upload
    from app.core.cloudinary import upload_to_cloudinary
    cloudinary_url = upload_to_cloudinary(content, file.filename)
    
    if cloudinary_url:
        attachment_url = cloudinary_url
    else:
        # Create upload directory and fallback to local disk
        upload_dir = f"uploads/tickets/{id}"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, file.filename)
        file.file.seek(0)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        attachment_url = f"/api/v1/tickets/attachments/{id}/{file.filename}"
        
    message_text = f"[ATTACHMENT:{file.filename}|{attachment_url}]"
    
    msg_schema = schemas.TicketMessageCreate(message=message_text)
    db_message = crud.create_ticket_message(db, ticket_id=id, msg=msg_schema, sender_id=current_user.id)
    
    # Broadcast reply to SSE stream
    from app.core import event_bus
    event_payload = {
        "id": db_message.id,
        "ticket_id": db_message.ticket_id,
        "sender_id": db_message.sender_id,
        "sender": {
            "email": db_message.sender.email if db_message.sender else current_user.email
        },
        "message": db_message.message,
        "timestamp": db_message.timestamp.isoformat(),
        "is_delivered": True,
        "is_read": False
    }
    event_bus.publish_ticket_message(event_payload)
    
    return db_message

@router.get("/attachments/{ticket_id}/{filename}")
def get_ticket_attachment(ticket_id: int, filename: str):
    clean_filename = os.path.basename(filename.replace("..", "").replace("/", "").replace("\\", ""))
    file_path = f"uploads/tickets/{ticket_id}/{clean_filename}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Attachment not found")
    return FileResponse(file_path)
