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
    phone: Optional[str] = None
    address: Optional[str] = None
    max_employees: int = 100
    available_tokens: int = 1000
    subscription_tier: str = "Free"

class CompanyCreate(CompanyBase):
    admin_password: Optional[str] = None

class CompanyOut(CompanyBase):
    id: int
    status: str
    active_employees: int = 0
    tokens_used: int = 0
    created_at: datetime
    
    class Config:
        from_attributes = True

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
    companies = db.query(models.Company).filter(
        models.Company.name != "NetraID Base"
    ).offset(skip).limit(limit).all()
    for c in companies:
        c.active_employees = db.query(models.Employee).filter(
            models.Employee.company_id == c.id,
            models.Employee.status == "Active"
        ).count()
    return companies

@router.put("/{company_id}/limit", response_model=CompanyOut)
def update_company_limit(
    company_id: int,
    max_employees: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_super_admin)
):
    """
    Update a company's maximum employees limit. (Super Admin only)
    """
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    db_company.max_employees = max_employees
    db.commit()
    db.refresh(db_company)
    
    db_company.active_employees = db.query(models.Employee).filter(
        models.Employee.company_id == db_company.id,
        models.Employee.status == "Active"
    ).count()
    
    return db_company

@router.put("/{company_id}/tier", response_model=CompanyOut)
def update_company_tier(
    company_id: int,
    subscription_tier: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_super_admin)
):
    """
    Update a company's subscription tier. (Super Admin only)
    """
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    db_company.subscription_tier = subscription_tier
    db.commit()
    db.refresh(db_company)
    
    db_company.active_employees = db.query(models.Employee).filter(
        models.Employee.company_id == db_company.id,
        models.Employee.status == "Active"
    ).count()
    
    return db_company

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
        phone=company.phone,
        address=company.address,
        max_employees=company.max_employees,
        available_tokens=company.available_tokens,
        subscription_tier=company.subscription_tier,
        status="Active"
    )
    db.add(new_company)
    db.commit()
    db.refresh(new_company)
    
    # Seed default settings from NetraID Base
    try:
        from app.crud import crud
        default_company = db.query(models.Company).filter(models.Company.name == "NetraID Base").first()
        if default_company:
            base_settings = crud.get_settings(db, company_id=default_company.id)
            for s in base_settings:
                crud.set_setting(db, s.key, s.value, s.description, company_id=new_company.id)
    except Exception as e:
        import logging
        logging.getLogger("CompaniesAPI").error(f"Failed to seed settings for new company: {e}")
        
    if company.admin_email and company.admin_password:
        from app.crud import crud
        from app.schemas import schemas
        admin_role = crud.get_role_by_name(db, "Admin")
        if admin_role:
            existing_user = crud.get_user_by_email(db, company.admin_email)
            if not existing_user:
                user_create = schemas.UserCreate(
                    email=company.admin_email,
                    password=company.admin_password,
                    role_id=admin_role.id
                )
                crud.create_user(db, user_create, company_id=new_company.id)

    new_company.active_employees = 0
    return new_company

class TokenAdd(BaseModel):
    amount: int

@router.post("/{company_id}/add-tokens", response_model=CompanyOut)
def add_tokens(
    company_id: int,
    payload: TokenAdd,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_super_admin)
):
    """
    Add tokens to a company. (Super Admin only)
    """
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    db_company.available_tokens += payload.amount
    db.commit()
    db.refresh(db_company)
    
    db_company.active_employees = db.query(models.Employee).filter(
        models.Employee.company_id == db_company.id,
        models.Employee.status == "Active"
    ).count()
    
    return db_company

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
    db_company.active_employees = db.query(models.Employee).filter(
        models.Employee.company_id == db_company.id,
        models.Employee.status == "Active"
    ).count()
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
    db_company.active_employees = db.query(models.Employee).filter(
        models.Employee.company_id == db_company.id,
        models.Employee.status == "Active"
    ).count()
    return db_company

from app.schemas.schemas import SettingOut, SettingUpdate
@router.get("/{company_id}/settings", response_model=List[SettingOut])
def get_company_settings(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_super_admin)
):
    from app.crud import crud
    return crud.get_settings(db, company_id=company_id)

@router.put("/{company_id}/settings/{key}", response_model=SettingOut)
def update_company_setting(
    company_id: int,
    key: str,
    payload: SettingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(checker_super_admin)
):
    from app.crud import crud
    setting = crud.get_setting_by_key(db, key=key, company_id=company_id)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
        
    updated = crud.set_setting(db, key=key, value=payload.value, company_id=company_id)
    return updated
