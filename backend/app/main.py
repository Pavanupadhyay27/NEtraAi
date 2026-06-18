import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.init_db import init_db
from app.api.v1 import auth, employees, departments, enrollment, kiosk, attendance, reports, analytics, settings as settings_api, audit

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
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_error = None

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
        init_db(db)
        db_error = "Success"
    except Exception as e:
        import traceback
        db_error = f"{e}\n{traceback.format_exc()}"
        logger.error(f"Error seeding database: {e}")
    finally:
        db.close()

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
