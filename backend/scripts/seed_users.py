import os
import sys

# Ensure imports work when running from this script location
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.append(ROOT)

from database import SessionLocal, Base, engine
from models import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

DEFAULT_USERS = [
    {"name": "Admin User", "email": "admin@example.com", "password": "Admin@1234!", "role": "ADMIN"},
    {"name": "Test User", "email": "test@example.com", "password": "Test@1234!", "role": "USER"},
]


def create_user(db, name, email, password, role):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        print(f"User already exists: {email} (id={existing.id})")
        return existing

    hashed = pwd_context.hash(password)
    user = User(name=name, email=email, hashed_password=hashed, role=role, disabled=0)
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"Created user: {email} (id={user.id})")
    return user


def main():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        for u in DEFAULT_USERS:
            create_user(db, u['name'], u['email'], u['password'], u['role'])
    finally:
        db.close()

if __name__ == '__main__':
    main()
