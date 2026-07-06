from sqlalchemy import create_engine, text

DB_URL = "postgresql://postgres:Netra9334%23%23@db.erzowqgbpeobbzpjkmtt.supabase.co:5432/postgres"

engine = create_engine(DB_URL)
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE companies ADD COLUMN admin_email VARCHAR(255);"))
        print("Added admin_email")
    except Exception as e:
        print("admin_email already exists or error:", e)
    
    try:
        conn.execute(text("ALTER TABLE companies ADD COLUMN max_employees INTEGER DEFAULT 100;"))
        print("Added max_employees")
    except Exception as e:
        print("max_employees already exists or error:", e)
    conn.commit()
print("Done")
