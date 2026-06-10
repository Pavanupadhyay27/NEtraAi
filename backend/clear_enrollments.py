"""Clear all black/invalid face enrollments from the database"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv()

import cv2
import numpy as np
import sqlite3

# Connect directly to SQLite for cleanup
conn = sqlite3.connect('netraid.db')
c = conn.cursor()

# Count current state
c.execute("SELECT COUNT(*) FROM face_embeddings")
emb_count = c.fetchone()[0]
c.execute("SELECT COUNT(*) FROM employee_images")
img_count = c.fetchone()[0]
print(f"Current: {emb_count} embeddings, {img_count} employee images")

# Delete all face embeddings
c.execute("DELETE FROM face_embeddings")
print(f"Deleted all face embeddings")

# Delete all employee images from DB
c.execute("DELETE FROM employee_images")
print(f"Deleted all employee image records from DB")

conn.commit()
conn.close()

# Also delete the actual image files
import shutil
uploads_dir = "./uploads/EMP01"
if os.path.exists(uploads_dir):
    for f in os.listdir(uploads_dir):
        fpath = os.path.join(uploads_dir, f)
        if os.path.isfile(fpath):
            os.remove(fpath)
            print(f"Deleted file: {fpath}")
    print("Cleared all uploaded image files")

print("\n✅ Cleanup complete! You can now re-enroll fresh from the UI.")
print("Go to: http://localhost:3001/employees → select employee → Biometric Enroll")
