import sqlite3
conn = sqlite3.connect('netraid.db')
c = conn.cursor()

c.execute("SELECT * FROM employees")
print('Employees:', c.fetchall())

c.execute("SELECT * FROM users")
print('Users:', c.fetchall())

conn.close()
