import sqlite3
import os
# Use backend root directory for the database file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(BASE_DIR, 'canteen.db')
conn = sqlite3.connect(DB)
cur = conn.cursor()
try:
    cur.execute('SELECT id, name, email, role, hashed_password FROM users')
    rows = cur.fetchall()
    print('USERS:')
    for r in rows:
        print(r)
except Exception as e:
    print('ERROR:', e)
finally:
    conn.close()
