"""
database.py — PostgreSQL connection using SQLAlchemy
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ── Database URL ───────────────────────────────────────────────────────────────
# Format: postgresql://username:password@host:port/database_name
DATABASE_URL = "postgresql://neondb_owner:npg_YWOVEHA4jk5D@ep-curly-credit-a19yvvs6-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# ── Engine & Session ───────────────────────────────────────────────────────────
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ── Dependency — used in FastAPI routes ───────────────────────────────────────
def get_db():
    """Yields a database session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
