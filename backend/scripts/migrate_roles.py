import os
import sys

# Ensure imports work when running from this script location
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.append(ROOT)

from database import SessionLocal
from models import User

def migrate_roles():
    db = SessionLocal()
    try:
        updated = 0
        users = db.query(User).filter(User.role.in_(["SUPER_ADMIN", "MANAGER", "ANALYST"])).all()
        for u in users:
            print(f"Migrating user {u.email} from {u.role} to ADMIN")
            u.role = "ADMIN"
            updated += 1
        
        db.commit()
        print(f"Migration complete. Updated {updated} users.")
    finally:
        db.close()

if __name__ == '__main__':
    migrate_roles()
