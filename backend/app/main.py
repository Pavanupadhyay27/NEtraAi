import os
import threading
import time
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import logging
from sqlalchemy import delete

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.init_db import init_db
from app.api.v1 import auth, employees, departments, enrollment, kiosk, attendance, reports, analytics, settings as settings_api, audit, companies
from app.models import models

# Logging configuration
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("NetraID")

from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Mount uploads directory as static files
# Dynamic uploads endpoint: serves images from database (fallback to local disk)
from app.core.database import get_db

@app.get("/uploads/{employee_id}/{filename}")
def get_upload_file(employee_id: str, filename: str, db: Session = Depends(get_db)):
    # Parse pose type from filename (e.g. "front.jpg" -> "front")
    pose_type = filename.split(".")[0].lower()
    
    # Query database for this employee and pose_type
    db_img = db.query(models.EmployeeImage).join(models.Employee).filter(
        models.Employee.employee_id == employee_id,
        models.EmployeeImage.pose_type.ilike(pose_type)
    ).first()
    
    if db_img and db_img.image_bytes:
        return Response(content=db_img.image_bytes, media_type="image/jpeg")
        
    # Fallback to local file system if not in DB (e.g. legacy/development)
    local_path = os.path.join(settings.UPLOAD_DIR, employee_id, filename)
    if os.path.exists(local_path):
        try:
            with open(local_path, "rb") as f:
                return Response(content=f.read(), media_type="image/jpeg")
        except Exception:
            pass
            
    raise HTTPException(status_code=404, detail="File not found")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_error = None

def purge_old_audit_logs():
    """Background loop to delete audit logs older than 24 hours."""
    logger.info("Starting background audit log purger thread...")
    while True:
        try:
            db = SessionLocal()
            cutoff = datetime.now() - timedelta(hours=24)
            stmt = delete(models.AuditLog).where(models.AuditLog.timestamp < cutoff)
            result = db.execute(stmt)
            db.commit()
            deleted_count = result.rowcount
            if deleted_count > 0:
                logger.info(f"Purged {deleted_count} audit logs older than 24 hours.")
            db.close()
        except Exception as e:
            logger.error(f"Error purging old audit logs: {e}")
        time.sleep(3600)

# Create folders on startup
@app.on_event("startup")
def startup_event():
    global db_error
    logger.info("Starting NetraID Backend...")
    
    # Create upload directory
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    logger.info(f"Uploads directory verified: {settings.UPLOAD_DIR}")
    
    # Create models directory
    os.makedirs(settings.MODELS_DIR, exist_ok=True)
    logger.info(f"Models directory verified: {settings.MODELS_DIR}")
    
    # Initialize and Seed database
    db = SessionLocal()
    try:
        from sqlalchemy import text
        from app.core.database import engine
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE companies ADD COLUMN admin_email VARCHAR(255);"))
                conn.commit()
        except Exception:
            pass
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE companies ADD COLUMN max_employees INTEGER DEFAULT 100;"))
                conn.commit()
        except Exception:
            pass
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE companies ADD COLUMN available_tokens INTEGER DEFAULT 1000;"))
                conn.execute(text("ALTER TABLE companies ADD COLUMN tokens_used INTEGER DEFAULT 0;"))
                conn.commit()
        except Exception:
            pass
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE companies ADD COLUMN phone VARCHAR(50);"))
                conn.execute(text("ALTER TABLE companies ADD COLUMN address VARCHAR(255);"))
                conn.commit()
        except Exception:
            pass
        try:
            with engine.connect() as conn:
                conn.execute(text("DELETE FROM companies WHERE name = 'NetraID Demo';"))
                conn.commit()
        except Exception:
            pass
            
        try:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;"))
                conn.commit()
        except Exception as e:
            logger.warning(f"Could not drop settings_key_key constraint: {e}")
            
        try:
            with engine.connect() as conn:
                conn.execute(text("DROP INDEX IF EXISTS settings_key_key;"))
                conn.execute(text("DROP INDEX IF EXISTS ix_settings_key;"))
                conn.commit()
        except Exception as e:
            logger.warning(f"Could not drop settings_key_key index: {e}")
            
        init_db(db)
        
        # Backfill settings for existing companies
        try:
            from app.models import models
            from app.crud import crud
            all_companies = db.query(models.Company).all()
            base_company = db.query(models.Company).filter(models.Company.name == "NetraID Base").first()
            if base_company:
                base_settings = crud.get_settings(db, company_id=base_company.id)
                for company in all_companies:
                    if company.id == base_company.id:
                        continue
                    existing_settings = crud.get_settings(db, company_id=company.id)
                    if not existing_settings:
                        for s in base_settings:
                            crud.set_setting(db, s.key, s.value, s.description, company_id=company.id)
        except Exception as e:
            logger.error(f"Error backfilling settings: {e}")
            
        db_error = "Success"
        
        # Start background RTSP processor
        try:
            from app.services.singletons import rtsp_processor
            rtsp_processor.start()
        except Exception as rtsp_err:
            logger.error(f"Failed to start background RTSP processor: {rtsp_err}")
            
        # Start background audit logs purger
        try:
            purger_thread = threading.Thread(target=purge_old_audit_logs, daemon=True)
            purger_thread.start()
            logger.info("Background audit logs purger started successfully.")
        except Exception as purger_err:
            logger.error(f"Failed to start background audit logs purger: {purger_err}")
            
    except Exception as e:
        import traceback
        db_error = f"{e}\n{traceback.format_exc()}"
        logger.error(f"Error seeding database: {e}")
    finally:
        db.close()

@app.on_event("shutdown")
def shutdown_event():
    logger.info("Stopping NetraID Backend...")
    try:
        from app.services.singletons import rtsp_processor
        rtsp_processor.stop()
    except Exception as e:
        logger.error(f"Failed to stop background RTSP processor: {e}")

# Health check and root route
@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "message": "NetraID Backend API is running",
        "docs": "/docs"
    }

@app.get("/debug-db")
def debug_db():
    masked_url = None
    if settings.DATABASE_URL:
        # Mask password for security
        parts = settings.DATABASE_URL.split("@")
        if len(parts) >= 2:
            creds = parts[0]
            host_info = "@".join(parts[1:])
            if ":" in creds:
                scheme_user, _ = creds.rsplit(":", 1)
                masked_url = f"{scheme_user}:****@{host_info}"
            else:
                masked_url = f"{creds}:****@{host_info}"
        else:
            masked_url = settings.DATABASE_URL
            
    return {
        "db_error": db_error,
        "database_url": masked_url
    }

@app.get("/health", tags=["Status"])
def health_check():
    from app.services.singletons import face_engine
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": "1.0.0",
        "mock_mode": face_engine.mock_mode
    }


# Include API Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(employees.router, prefix=f"{settings.API_V1_STR}/employees", tags=["Employee Management"])
app.include_router(departments.router, prefix=f"{settings.API_V1_STR}/departments", tags=["Department Management"])
app.include_router(enrollment.router, prefix=f"{settings.API_V1_STR}/enrollment", tags=["Face Enrollment"])
app.include_router(kiosk.router, prefix=f"{settings.API_V1_STR}/kiosk", tags=["Kiosk Attendance Screen"])
app.include_router(attendance.router, prefix=f"{settings.API_V1_STR}/attendance", tags=["Attendance Logs & Feeds"])
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}/reports", tags=["Reporting & Exports"])
app.include_router(analytics.router, prefix=f"{settings.API_V1_STR}/analytics", tags=["Dashboard Analytics"])
app.include_router(settings_api.router, prefix=f"{settings.API_V1_STR}/settings", tags=["System Settings"])
app.include_router(audit.router, prefix=f"{settings.API_V1_STR}/audit", tags=["System Audit Logs"])
app.include_router(companies.router, prefix=f"{settings.API_V1_STR}/companies", tags=["Company Management"])
# Trigger reload - reload 2

