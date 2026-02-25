from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Get the directory where the database file will be stored
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Database URL - Using SQLite for simplicity
SQLALCHEMY_DATABASE_URL = f"sqlite:///{BASE_DIR}/canteen.db"

try:
    # Create database engine
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

    # Create session factory
    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine
    )

    # Create base class for models
    Base = declarative_base()

    # Dependency function to get database session
    def get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
except Exception as e:
    print(f"Database connection error: {e}")
