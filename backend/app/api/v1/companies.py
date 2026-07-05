from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core import security
from app.models import models
from pydantic import BaseModel

router = APIRouter()

checker_super_admin = security.RoleChecker(["Super Admin"])

class CompanyBase(BaseModel):
    name: str
    admin_email: Optional[str] = None
    max_employees: int = 100

class CompanyCreate(CompanyBase):
    pass

class CompanyOut(CompanyBase):
    id: int
    status: str
    created_at: datetime
    
    class Config:
        orm_mode = True

@router.get("/", response_model=List[CompanyOut])
def get_companies(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_super_admin)
):
    """
    Get all companies (Super Admin only).
    """
    companies = db.query(models.Company).offset(skip).limit(limit).all()
    return companies

@router.post("/", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
def create_company(
    company: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_super_admin)
):
    """
    Register a new company (Super Admin only).
    """
    db_company = db.query(models.Company).filter(models.Company.name == company.name).first()
    if db_company:
        raise HTTPException(status_code=400, detail="Company name already registered")
        
    new_company = models.Company(
        name=company.name,
        admin_email=company.admin_email,
        max_employees=company.max_employees,
        status="Active"
    )
    db.add(new_company)
    db.commit()
    db.refresh(new_company)
    return new_company

@router.put("/{company_id}/suspend", response_model=CompanyOut)
def suspend_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_super_admin)
):
    """
    Suspend a company. Its users will be denied access. (Super Admin only)
    """
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    if db_company.id == 1:
        raise HTTPException(status_code=400, detail="Cannot suspend the default host company")
        
    db_company.status = "Suspended"
    db.commit()
    db.refresh(db_company)
    return db_company

@router.put("/{company_id}/activate", response_model=CompanyOut)
def activate_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_super_admin)
):
    """
    Activate a suspended company. (Super Admin only)
    """
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    db_company.status = "Active"
    db.commit()
    db.refresh(db_company)
    return db_company
