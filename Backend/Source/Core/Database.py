from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
# Source/Core/Database.py -> Source/Core -> Source -> Backend -> Data
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = os.path.join(BASE_DIR, "Data")
os.makedirs(DATA_DIR, exist_ok=True)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.join(DATA_DIR, 'qiyas.db')}"

# connect_args={"check_same_thread": False} is needed only for SQLite.
# It's not needed for other databases.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Import Models here to ensure they are registered with Base metadata
# This is crucial for Alembic or `Base.metadata.create_all` to work
# We import them inside a try/except or just at the end to avoid circular imports if those models import Base
# MOVED TO MAIN.PY or consumption scripts to avoid circular dependency

