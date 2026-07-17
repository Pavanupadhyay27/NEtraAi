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
        
    db.delete(db_company)
    db.commit()
    
    crud.create_audit_log(
        db=db,
        user_id=current_user.id,
        action="Delete Company",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"De-onboarded / Deleted company ID: {id} and name: {db_company.name}"
    )
    return {"message": "Company deleted successfully"}
