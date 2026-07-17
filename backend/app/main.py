import os
import threading
import time

import sys

# Enforce IST Timezone for all attendance date calculations (important for HuggingFace / UTC cloud servers)
if sys.platform == "win32":
    os.environ["TZ"] = "IST-5:30"
else:
    os.environ["TZ"] = "Asia/Kolkata"

if hasattr(time, "tzset"):
    time.tzset()
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import logging
from sqlalchemy import delete

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.init_db import init_db
from app.models import models
from app.api.v1 import auth, employees, departments, enrollment, kiosk, attendance, reports, analytics, settings as settings_api, audit, companies, tickets, devices, notifications, timeline, policy

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

from fastapi import Request

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; img-src 'self' data: blob: https:; connect-src 'self' ws: wss: https:;"
    return response

# Mount uploads directory as static files
# Dynamic uploads endpoint: serves images from database (fallback to local disk)
from app.core.database import get_db

@app.get("/uploads/{employee_id}/{filename}")
def get_upload_file(employee_id: str, filename: str, db: Session = Depends(get_db)):
    # Sanitize inputs to prevent directory traversal
    clean_emp_id = os.path.basename(employee_id.replace("..", "").replace("/", "").replace("\\", ""))
    clean_filename = os.path.basename(filename.replace("..", "").replace("/", "").replace("\\", ""))
    
    if not clean_emp_id or not clean_filename:
        raise HTTPException(status_code=400, detail="Invalid request parameters")
        
    # Parse pose type from filename (e.g. "front.jpg" -> "front")
    pose_type = clean_filename.split(".")[0].lower()
    
    # Query database for this employee and pose_type
    db_img = db.query(models.EmployeeImage).join(models.Employee).filter(
        models.Employee.employee_id == clean_emp_id,
        models.EmployeeImage.pose_type.ilike(pose_type)
    ).first()
    
    if db_img and db_img.image_bytes:
        return Response(content=db_img.image_bytes, media_type="image/jpeg")
        
    # Fallback to local file system with strict path canonicalization
    upload_dir_abs = os.path.abspath(settings.UPLOAD_DIR)
    local_path_abs = os.path.abspath(os.path.join(upload_dir_abs, clean_emp_id, clean_filename))
    
    if not local_path_abs.startswith(upload_dir_abs):
        raise HTTPException(status_code=403, detail="Access denied: Path traversal attempt detected")
        
    if os.path.exists(local_path_abs):
        try:
            with open(local_path_abs, "rb") as f:
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
        init_db(db)
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
app.include_router(tickets.router, prefix=f"{settings.API_V1_STR}/tickets", tags=["Support Tickets & Helpdesk"])
app.include_router(devices.router, prefix=f"{settings.API_V1_STR}/devices", tags=["Kiosk Devices"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}/notifications", tags=["In-App Notifications"])
app.include_router(timeline.router, prefix=f"{settings.API_V1_STR}/timeline", tags=["Activity History Timeline"])
app.include_router(policy.router, prefix=f"{settings.API_V1_STR}/policy", tags=["Attendance Rules Policy Engine"])
# Trigger reload - reload 2

