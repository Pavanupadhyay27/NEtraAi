import os
import shutil
import sqlite3

def clean_db(db_path):
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found.")
        return

    print(f"Cleaning database: {db_path}")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Get employee user_ids first
    try:
        c.execute("SELECT user_id, employee_id, name FROM employees")
        employees = c.fetchall()
        employee_user_ids = [emp[0] for emp in employees if emp[0] is not None]
        print(f"Found {len(employees)} employees in {db_path}.")
    except sqlite3.OperationalError as e:
        print(f"Could not read employees: {e}")
        conn.close()
        return

    # Delete related records
    tables = [
        "face_embeddings",
        "employee_images",
        "attendance",
        "attendance_logs",
        "leave_requests",
        "ticket_messages",
        "tickets",
        "employees"
    ]
    
    for table in tables:
        try:
            c.execute(f"DELETE FROM {table}")
            print(f"Deleted records from table: {table}")
        except sqlite3.OperationalError as e:
            print(f"Table {table} delete error: {e}")

    # Associated Users
    if employee_user_ids:
        try:
            placeholders = ','.join('?' for _ in employee_user_ids)
            c.execute(f"DELETE FROM users WHERE id IN ({placeholders})", employee_user_ids)
            print(f"Deleted {c.rowcount} associated employee user accounts from users table.")
        except sqlite3.OperationalError as e:
            print(f"Users table delete error: {e}")

    conn.commit()
    conn.close()
    print(f"Finished cleaning database: {db_path}\n")

def delete_employee_data():
    # Clean both potential database paths
    clean_db('netraid.db')
    clean_db('../netraid.db')

    # Delete image files from uploads
    uploads_dir = './uploads'
    if os.path.exists(uploads_dir):
        deleted_dirs = 0
        for item in os.listdir(uploads_dir):
            item_path = os.path.join(uploads_dir, item)
            if os.path.isdir(item_path):
                try:
                    shutil.rmtree(item_path)
                    print(f"Deleted uploads directory: {item_path}")
                    deleted_dirs += 1
                except Exception as e:
                    print(f"Error deleting directory {item_path}: {e}")
        print(f"Cleared {deleted_dirs} employee upload folders from {uploads_dir}.")
    else:
        print("Uploads directory not found.")

    print("\n[SUCCESS] All employee data has been successfully deleted!")

if __name__ == '__main__':
    delete_employee_data()
