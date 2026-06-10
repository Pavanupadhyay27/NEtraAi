import sqlite3
conn = sqlite3.connect('netraid.db')
c = conn.cursor()

c.execute("SELECT name FROM sqlite_master WHERE type='table'")
print('Tables:', c.fetchall())

c.execute("SELECT COUNT(*) FROM face_embeddings")
print('Embeddings:', c.fetchone())

c.execute("SELECT * FROM attendance_logs ORDER BY id DESC LIMIT 10")
print('Attendance logs:', c.fetchall())

c.execute("SELECT * FROM attendance ORDER BY id DESC LIMIT 10")
print('Attendances:', c.fetchall())

conn.close()
