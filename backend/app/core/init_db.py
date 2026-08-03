from sqlalchemy import text, select
from sqlalchemy.orm import Session
from app.core.database import Base, engine
from app.models import models
from app.crud import crud
from app.schemas import schemas
from app.core.config import settings
from datetime import time, date
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

    # 1.5 Add WFH and Location tracking columns
    try:
        db.execute(text("SELECT wfh_address FROM employees LIMIT 1"))
    except Exception:
        db.rollback()
        logger.info("Adding WFH location columns to employees table...")
        db.execute(text("ALTER TABLE employees ADD COLUMN wfh_address VARCHAR(255) DEFAULT NULL"))
        db.execute(text("ALTER TABLE employees ADD COLUMN wfh_lat FLOAT DEFAULT NULL"))
        db.execute(text("ALTER TABLE employees ADD COLUMN wfh_lng FLOAT DEFAULT NULL"))
        db.commit()

    try:
        db.execute(text("SELECT location_text FROM attendance_logs LIMIT 1"))
    except Exception:
        db.rollback()
        logger.info("Adding location columns to attendance_logs table...")
        db.execute(text("ALTER TABLE attendance_logs ADD COLUMN location_text VARCHAR(255) DEFAULT NULL"))
        db.execute(text("ALTER TABLE attendance_logs ADD COLUMN latitude FLOAT DEFAULT NULL"))
        db.execute(text("ALTER TABLE attendance_logs ADD COLUMN longitude FLOAT DEFAULT NULL"))
        db.commit()

    # Ensure HNSW index exists on PostgreSQL
    if db.bind.dialect.name == "postgresql":
        try:
            logger.info("Dropping old settings_key_key constraint if exists...")
            db.execute(text("ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;"))
            db.execute(text("ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_key;"))
            db.execute(text("ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_code_key;"))
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning(f"Could not drop legacy constraints: {e}")
            
        try:
            logger.info("Ensuring face_embeddings pgvector HNSW index is present...")
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS face_embeddings_hnsw_idx 
                ON face_embeddings 
                USING hnsw (embedding vector_cosine_ops);
            """))
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning(f"Could not create HNSW index: {e}")

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

    # Ensure shift_id column exists in employees table
    try:
        db.execute(text("SELECT shift_id FROM employees LIMIT 1"))
    except Exception:
        db.rollback()
        logger.info("Adding shift_id column to employees table...")
        db.execute(text("ALTER TABLE employees ADD COLUMN shift_id INTEGER REFERENCES shifts(id) DEFAULT NULL"))
        db.commit()

    # Ensure allow_wfh column exists in employees table
    try:
        db.execute(text("SELECT allow_wfh FROM employees LIMIT 1"))
    except Exception:
        db.rollback()
        logger.info("Adding allow_wfh column to employees table...")
        db.execute(text("ALTER TABLE employees ADD COLUMN allow_wfh BOOLEAN DEFAULT FALSE"))
        db.commit()
    
    # Ensure image_bytes column exists in employee_images table
    try:
        db.execute(text("SELECT image_bytes FROM employee_images LIMIT 1"))
    except Exception:
        db.rollback()
        logger.info("Adding image_bytes column to employee_images table...")
        if db.bind.dialect.name == "postgresql":
            db.execute(text("ALTER TABLE employee_images ADD COLUMN image_bytes BYTEA"))
        else:
            db.execute(text("ALTER TABLE employee_images ADD COLUMN image_bytes BLOB"))
        db.commit()

    # Ensure attendance_logs extension columns exist
    attendance_log_cols = [
        ("face_quality", "FLOAT DEFAULT NULL"),
        ("blur_score", "FLOAT DEFAULT NULL"),
        ("brightness_score", "FLOAT DEFAULT NULL"),
        ("is_occluded", "BOOLEAN DEFAULT FALSE"),
        ("has_mask", "BOOLEAN DEFAULT FALSE"),
        ("recognition_time_ms", "FLOAT DEFAULT NULL"),
        ("processing_time_ms", "FLOAT DEFAULT NULL"),
        ("embedding_version", "VARCHAR(50) DEFAULT NULL"),
        ("device_id", "INTEGER DEFAULT NULL"),
    ]
    for col_name, col_def in attendance_log_cols:
        try:
            db.execute(text(f"SELECT {col_name} FROM attendance_logs LIMIT 1"))
        except Exception:
            db.rollback()
            logger.info(f"Adding {col_name} column to attendance_logs table...")
            db.execute(text(f"ALTER TABLE attendance_logs ADD COLUMN {col_name} {col_def}"))
            db.commit()

    # Ensure attendance extension columns exist
    attendance_cols = [
        ("late_minutes", "INTEGER DEFAULT 0"),
        ("early_exit_minutes", "INTEGER DEFAULT 0"),
        ("break_time_minutes", "INTEGER DEFAULT 0"),
        ("attendance_streak", "INTEGER DEFAULT 0"),
        ("attendance_percentage", "FLOAT DEFAULT 100.0"),
        ("shift_info", "VARCHAR(255) DEFAULT NULL"),
        ("geofence_result", "VARCHAR(100) DEFAULT NULL"),
        ("policy_version", "VARCHAR(50) DEFAULT NULL"),
    ]
    for col_name, col_def in attendance_cols:
        try:
            db.execute(text(f"SELECT {col_name} FROM attendance LIMIT 1"))
        except Exception:
            db.rollback()
            logger.info(f"Adding {col_name} column to attendance table...")
            db.execute(text(f"ALTER TABLE attendance ADD COLUMN {col_name} {col_def}"))
            db.commit()

    # Ensure ticket_messages is_delivered and is_read columns exist for PostgreSQL/SQLite compatibility
    try:
        db.execute(text("SELECT is_delivered FROM ticket_messages LIMIT 1"))
    except Exception:
        db.rollback()
        logger.info("Adding is_delivered column to ticket_messages table...")
        db.execute(text("ALTER TABLE ticket_messages ADD COLUMN is_delivered BOOLEAN DEFAULT TRUE"))
        db.commit()

    try:
        db.execute(text("SELECT is_read FROM ticket_messages LIMIT 1"))
    except Exception:
        db.rollback()
        logger.info("Adding is_read column to ticket_messages table...")
        db.execute(text("ALTER TABLE ticket_messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE"))
        db.commit()

    # Seed Default Company
    default_company = db.execute(select(models.Company).where(models.Company.name == "NetraID Base")).scalar_one_or_none()
    if not default_company:
        logger.info("Seeding default company 'NetraID Base'...")
        default_company = models.Company(
            name="NetraID Base",
            status="Active",
            max_employees=1000,
            available_tokens=999999
        )
        db.add(default_company)
        db.commit()
        db.refresh(default_company)
        
    # 0. Seed Shifts
    shifts_to_seed = [
        {"name": "Regular Day Shift", "start_time": time(9, 0), "end_time": time(17, 0), "grace_period_minutes": 15, "description": "Standard business hours"},
        {"name": "Morning Shift", "start_time": time(7, 0), "end_time": time(15, 0), "grace_period_minutes": 15, "description": "Early morning shift"},
        {"name": "Evening Shift", "start_time": time(15, 0), "end_time": time(23, 0), "grace_period_minutes": 15, "description": "Evening / second shift"},
        {"name": "Night Shift", "start_time": time(23, 0), "end_time": time(7, 0), "grace_period_minutes": 15, "description": "Overnight shift"}
    ]
    for s in shifts_to_seed:
        shift_record = db.execute(select(models.Shift).where(
            models.Shift.name == s["name"],
            models.Shift.company_id == default_company.id
        )).scalar_one_or_none()
        if not shift_record:
            logger.info(f"Seeding shift: {s['name']}")
            db_shift = models.Shift(**s, company_id=default_company.id)
            db.add(db_shift)
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
        dept = db.execute(select(models.Department).where(
            models.Department.code == d["code"],
            models.Department.company_id == default_company.id
        )).scalar_one_or_none()
        if not dept:
            logger.info(f"Seeding department: {d['name']} ({d['code']})")
            crud.create_department(db, schemas.DepartmentCreate(**d), company_id=default_company.id)
            
    # 3. Seed Default Settings
    default_settings = [
        {"key": "CHECK_IN_START", "value": "11:00", "description": "Official start of work day (HH:MM)"},
        {"key": "CHECK_OUT_END", "value": "19:00", "description": "Official end of work day (HH:MM)"},
        {"key": "GRACE_PERIOD_MINUTES", "value": "0", "description": "Grace period for check-ins in minutes"},
        {"key": "KIOSK_FACE_THRESHOLD", "value": str(settings.KIOSK_FACE_THRESHOLD), "description": "Cosine similarity threshold for face match"},
        {"key": "KIOSK_LIVENESS_THRESHOLD", "value": str(settings.KIOSK_LIVENESS_THRESHOLD), "description": "Softmax probability threshold for face liveness"},
        {"key": "ENROLLMENT_LIVENESS_CHECK", "value": "true", "description": "Enforce liveness check during employee facial enrollment"},
        {"key": "ENROLLMENT_LIVENESS_THRESHOLD", "value": "0.50", "description": "Liveness probability threshold specifically for employee facial enrollment"},
        {"key": "VOICE_GREETING_ENABLED", "value": "true", "description": "Enable voice greeting on successful attendance"},
        {"key": "SYSTEM_MAINTENANCE_MODE", "value": "false", "description": "Toggle maintenance mode to suspend active check-ins"},
        {"key": "MAX_ENROLLMENT_IMAGES", "value": "5", "description": "Maximum face images captured during registration"},
        {"key": "KIOSK_AUTO_RESET_SECONDS", "value": "5", "description": "Duration in seconds the success screen stays visible before scanning again"},
        {"key": "NOTIFICATION_WEBHOOK_URL", "value": "", "description": "Slack, Discord or Telegram webhook URL for spoof security alerts"},
        {"key": "QR_FALLBACK_ENABLED", "value": "true", "description": "Enable QR Code badge verification fallback on kiosk if face match is borderline"},
        {"key": "RTSP_STREAM_ENABLED", "value": "false", "description": "Enable asynchronous RTSP IP camera frame processing background service"},
        {"key": "RTSP_STREAM_URL", "value": "rtsp://admin:admin123@192.168.1.100:554/stream1", "description": "RTSP video stream connection URL"},
        {"key": "COMPANY_NAME", "value": "NetraID Enterprise", "description": "Name of the organization displayed on employee ID cards"},
        {"key": "COMPANY_LOGO", "value": "", "description": "Base64 image data or URL of the company logo displayed on ID cards"},
        {"key": "BADGE_THEME_COLOR", "value": "Navy Blue", "description": "Primary color theme of employee ID cards (Navy Blue, Charcoal, Emerald, Saffron)"},
        {"key": "BADGE_PATTERN_TYPE", "value": "Indian Mandala", "description": "Background pattern design style (None, Indian Mandala, Corporate Waves, Cyber Grid)"},
        {"key": "LOCATION_RESTRICTION_ENABLED", "value": "false", "description": "Enable location restriction for kiosk attendance"},
        {"key": "LOCATION_LATITUDE", "value": "0.0", "description": "Office center latitude coordinate"},
        {"key": "LOCATION_LONGITUDE", "value": "0.0", "description": "Office center longitude coordinate"},
        {"key": "LOCATION_RADIUS_METERS", "value": "50", "description": "Allowed radius in meters for marking attendance"}
    ]
    
    for s in default_settings:
        setting = crud.get_setting_by_key(db, s["key"], company_id=default_company.id)
        if not setting:
            logger.info(f"Seeding setting: {s['key']} = {s['value']}")
            crud.set_setting(db, s["key"], s["value"], s["description"], company_id=default_company.id)
            
    # 3. Seed Initial Super Admin User (Super Admins are company-agnostic, company_id=None)
    admin_email = settings.INITIAL_ADMIN_EMAIL
    admin_user = crud.get_user_by_email(db, admin_email)
    if not admin_user:
        logger.info(f"Seeding Super Admin user: {admin_email}")
        admin_create = schemas.UserCreate(
            email=admin_email,
            password=settings.INITIAL_ADMIN_PASSWORD,
            role_id=db_roles["Super Admin"].id
        )
        crud.create_user(db, admin_create, company_id=None)
    else:
        logger.info(f"Super Admin user {admin_email} already exists. Syncing password with configuration...")
        admin_user.hashed_password = crud.get_password_hash(settings.INITIAL_ADMIN_PASSWORD)
        admin_user.company_id = None
        db.commit()

    # 4. Seed Default Company Admin User linked to NetraID Base
    default_admin_email = "hr@netraid.ai"
    default_admin = crud.get_user_by_email(db, default_admin_email)
    if not default_admin:
        logger.info(f"Seeding default company admin user: {default_admin_email}")
        admin_create = schemas.UserCreate(
            email=default_admin_email,
            password="Admin@NetraID2026",
            role_id=db_roles["Admin"].id
        )
        crud.create_user(db, admin_create, company_id=default_company.id)

    # 5. Seed Default Employee User linked to NetraID Base
    default_emp_email = "employee@netraid.ai"
    default_emp = crud.get_user_by_email(db, default_emp_email)
    if not default_emp:
        logger.info(f"Seeding default employee user: {default_emp_email}")
        emp_create = schemas.UserCreate(
            email=default_emp_email,
            password="Employee@NetraID2026",
            role_id=db_roles["Employee"].id
        )
        db_user = crud.create_user(db, emp_create, company_id=default_company.id)
        
        eng_dept = db.execute(select(models.Department).where(
            models.Department.code == "ENG",
            models.Department.company_id == default_company.id
        )).scalar_one_or_none()
        dept_id = eng_dept.id if eng_dept else None

        employee_in = schemas.EmployeeCreate(
            name="Rahul Kumar",
            employee_id="EMP101",
            phone="9876543210",
            email=default_emp_email,
            designation="Software Engineer",
            department_id=dept_id,
            joining_date=date.today(),
            status="Active"
        )
        crud.create_employee(db, employee_in, user_id=db_user.id, company_id=default_company.id)
        
    logger.info("Database initialization and seeding completed successfully.")
