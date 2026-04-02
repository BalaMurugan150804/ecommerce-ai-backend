"""
models.py — Database table definitions using SQLAlchemy
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base

class User(Base):
    """
    Users table — stores all registered users.

    Roles:
        customer  → sees Customer dashboard
        seller    → sees Seller dashboard
        marketer  → sees Marketer dashboard
        admin     → sees Admin dashboard + all data
    """
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    email      = Column(String, unique=True, index=True, nullable=False)
    password   = Column(String, nullable=False)           # hashed password
    role       = Column(String, default="customer")       # customer/seller/marketer/admin
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
