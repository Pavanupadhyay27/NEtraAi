"""
Re-enrollment script: Re-generates face embeddings from existing enrolled images
using the current face engine. Run this after upgrading the face engine.

Usage:
    ..\.venv\Scripts\python.exe re_enroll.py
"""
import sys
import os

# Add the backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set env vars before importing app modules
from dotenv import load_dotenv
load_dotenv()

from app.core.database import SessionLocal
from app.models import models
from app.services.singletons import face_engine
import cv2
import numpy as np
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ReEnroll")

def re_enroll():
    db = SessionLocal()
    try:
        # Get all employees with images
        employees = db.query(models.Employee).all()
        logger.info(f"Found {len(employees)} employees to re-enroll.")
        
        for employee in employees:
            images = db.query(models.EmployeeImage).filter(
                models.EmployeeImage.employee_id == employee.id
            ).all()
            
            if not images:
                logger.warning(f"No images found for employee {employee.name} ({employee.employee_id})")
                continue
            
            logger.info(f"\nRe-enrolling {employee.name} ({employee.employee_id}) - {len(images)} pose(s)...")
            
            # Delete existing embeddings for this employee
            db.query(models.FaceEmbedding).filter(
                models.FaceEmbedding.employee_id == employee.id
            ).delete()
            db.commit()
            
            re_enrolled_count = 0
            for img_record in images:
                # Read image from disk
                if not os.path.exists(img_record.file_path):
                    logger.warning(f"  Image file not found: {img_record.file_path}")
                    continue
                
                img = cv2.imread(img_record.file_path)
                if img is None:
                    logger.warning(f"  Failed to read image: {img_record.file_path}")
                    continue
                
                # Detect face
                faces = face_engine.detect_faces(img)
                if not faces:
                    logger.warning(f"  No face detected in {img_record.file_path}")
                    continue
                
                face = faces[0]
                
                # Align and extract embedding
                aligned = face_engine.align_face(img, face["landmarks"])
                embedding = face_engine.extract_embedding(aligned)
                embedding_list = embedding.tolist()
                
                # Save new embedding
                new_emb = models.FaceEmbedding(
                    employee_id=employee.id,
                    image_id=img_record.id,
                    embedding=embedding_list
                )
                db.add(new_emb)
                re_enrolled_count += 1
                logger.info(f"  ✓ Re-enrolled pose: {img_record.pose_type}")
            
            db.commit()
            logger.info(f"  Total re-enrolled: {re_enrolled_count}/{len(images)} poses for {employee.name}")
        
        # Final count
        total_embs = db.query(models.FaceEmbedding).count()
        logger.info(f"\n✅ Re-enrollment complete! Total embeddings in DB: {total_embs}")
        
    except Exception as e:
        logger.error(f"Re-enrollment failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    re_enroll()
