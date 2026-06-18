from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import Base, engine
from app.models import models
from app.crud import crud
from app.schemas import schemas
from app.core.config import settings
import logging

logger = logging.getLogger("InitDB")

def init_db(db: Session):
    # Enable vector extension for PostgreSQL
    if db.bind.dialect.name == "postgresql":
        logger.info("Enabling pgvector extension on PostgreSQL...")
        db.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        db.commit()

    # Create all tables if they don't exist
    logger.info("Creating all database tables if they do not exist...")
    Base.metadata.create_all(bind=engine)

    # Ensure emergency_allowed column exists
    try:
        db.execute(text("SELECT emergency_allowed FROM attendance LIMIT 1"))
    except Exception:
        db.rollback()
        logger.info("Adding emergency_allowed column to attendance table...")
        db.execute(text("ALTER TABLE attendance ADD COLUMN emergency_allowed BOOLEAN DEFAULT FALSE"))
        db.commit()
    
    # Ensure image_path column exists in attendance_logs table
    try:
        db.execute(text("SELECT image_path FROM attendance_logs LIMIT 1"))
    except Exception:
        db.rollback()
        logger.info("Adding image_path column to attendance_logs table...")
        db.execute(text("ALTER TABLE attendance_logs ADD COLUMN image_path VARCHAR(255) DEFAULT NULL"))
        db.commit()
    
    # 1. Seed Roles
    roles = [
        {"name": "Super Admin", "description": "Full access to all system features and settings"},
        {"name": "Admin", "description": "Administrative access to employees, analytics, and reports"},
        {"name": "HR", "description": "Manage attendance records, leaves, and employee profiles"},
        {"name": "Employee", "description": "Read-only access to own attendance logs and leave requests"}
    ]
    
    db_roles = {}
    for r in roles:
        role = crud.get_role_by_name(db, r["name"])
        if not role:
            logger.info(f"Seeding role: {r['name']}")
            role = crud.create_role(db, r["name"], r["description"])
        db_roles[r["name"]] = role
        
    # 2. Seed Corporate Departments
    departments = [
        {"name": "Engineering", "code": "ENG", "description": "Software development, DevOps, QA, and IT systems"},
        {"name": "Human Resources", "code": "HR", "description": "Recruitment, payroll, and staff relations"},
        {"name": "Marketing & Sales", "code": "MKT", "description": "Product branding, marketing campaigns, and client sales"},
        {"name": "Finance & Accounts", "code": "FIN", "description": "Financial planning, accounting, and budgeting"},
        {"name": "Operations", "code": "OPS", "description": "Office administration and business facilities"}
    ]
    for d in departments:
        dept = crud.get_department_by_code(db, d["code"])
        if not dept:
            logger.info(f"Seeding department: {d['name']} ({d['code']})")
            crud.create_department(db, schemas.DepartmentCreate(**d))
            
    # 3. Seed Default Settings
    default_settings = [
        {"key": "CHECK_IN_START", "value": "11:00", "description": "Official start of work day (HH:MM)"},
        {"key": "CHECK_OUT_END", "value": "19:00", "description": "Official end of work day (HH:MM)"},
        {"key": "GRACE_PERIOD_MINUTES", "value": "0", "description": "Grace period for check-ins in minutes"},
        {"key": "KIOSK_FACE_THRESHOLD", "value": str(settings.KIOSK_FACE_THRESHOLD), "description": "Cosine similarity threshold for face match"},
        {"key": "KIOSK_LIVENESS_THRESHOLD", "value": str(settings.KIOSK_LIVENESS_THRESHOLD), "description": "Softmax probability threshold for face liveness"},
        {"key": "ENROLLMENT_LIVENESS_CHECK", "value": "true", "description": "Enforce liveness check during employee facial enrollment"},
        {"key": "ENROLLMENT_LIVENESS_THRESHOLD", "value": "0.70", "description": "Liveness probability threshold specifically for employee facial enrollment"},
        {"key": "VOICE_GREETING_ENABLED", "value": "true", "description": "Enable voice greeting on successful attendance"},
        {"key": "SYSTEM_MAINTENANCE_MODE", "value": "false", "description": "Toggle maintenance mode to suspend active check-ins"},
        {"key": "MAX_ENROLLMENT_IMAGES", "value": "5", "description": "Maximum face images captured during registration"},
        {"key": "KIOSK_AUTO_RESET_SECONDS", "value": "5", "description": "Duration in seconds the success screen stays visible before scanning again"}
    ]
    
    for s in default_settings:
        setting = crud.get_setting_by_key(db, s["key"])
        if not setting:
            logger.info(f"Seeding setting: {s['key']} = {s['value']}")
            crud.set_setting(db, s["key"], s["value"], s["description"])
            
    # 3. Seed Initial Super Admin User
    admin_email = settings.INITIAL_ADMIN_EMAIL
    admin_user = crud.get_user_by_email(db, admin_email)
    if not admin_user:
        logger.info(f"Seeding Super Admin user: {admin_email}")
        admin_create = schemas.UserCreate(
            email=admin_email,
            password=settings.INITIAL_ADMIN_PASSWORD,
            role_id=db_roles["Super Admin"].id
        )
        crud.create_user(db, admin_create)
    else:
        logger.info(f"Super Admin user {admin_email} already exists. Syncing password with configuration...")
        admin_user.hashed_password = crud.get_password_hash(settings.INITIAL_ADMIN_PASSWORD)
        db.commit()
        
    logger.info("Database initialization and seeding completed successfully.")
