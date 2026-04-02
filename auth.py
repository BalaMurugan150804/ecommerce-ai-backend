"""
auth.py — Authentication logic
Handles: password hashing, JWT creation, login, register
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from database import get_db
from models import User

# ── Config ─────────────────────────────────────────────────────────────────────
SECRET_KEY  = "ecommerce_ai_secret_key_2025"   # change this in production
ALGORITHM   = "HS256"
TOKEN_EXPIRE_HOURS = 24

# ── Password Hashing ───────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash a plain password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    """Check plain password against hashed password."""
    return pwd_context.verify(plain, hashed)

# ── JWT Token ──────────────────────────────────────────────────────────────────
def create_token(data: dict) -> str:
    """Create a JWT token with expiry."""
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    """Decode and verify a JWT token."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token."
        )

# ── Request Schemas ────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name:     str
    email:    str
    password: str
    role:     str = "customer"   # default role is customer

    class Config:
        json_schema_extra = {
            "example": {
                "name":     "Bala Murugan",
                "email":    "bala@example.com",
                "password": "mypassword123",
                "role":     "customer"
            }
        }

class LoginRequest(BaseModel):
    email:    str
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "email":    "bala@example.com",
                "password": "mypassword123"
            }
        }

# ── Router ─────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new user.

    - Checks if email already exists
    - Hashes the password
    - Saves user to PostgreSQL
    - Returns JWT token immediately (auto login after register)
    """
    # Check if email already registered
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered. Please login instead."
        )

    # Validate role
    valid_roles = ["customer", "seller", "marketer", "admin"]
    if request.role not in valid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Choose from: {valid_roles}"
        )

    # Create user
    new_user = User(
        name     = request.name,
        email    = request.email,
        password = hash_password(request.password),
        role     = request.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate token
    token = create_token({
        "id":    new_user.id,
        "email": new_user.email,
        "role":  new_user.role,
        "name":  new_user.name,
    })

    return {
        "message":  f"Welcome {new_user.name}! Account created successfully.",
        "token":    token,
        "user": {
            "id":    new_user.id,
            "name":  new_user.name,
            "email": new_user.email,
            "role":  new_user.role,
        }
    }


@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Login with email and password.

    - Finds user by email
    - Verifies password
    - Returns JWT token + user info
    """
    # Find user
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=401,
            detail="No account found with this email."
        )

    # Verify password
    if not verify_password(request.password, user.password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect password."
        )

    # Check active
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is disabled. Contact admin."
        )

    # Generate token
    token = create_token({
        "id":    user.id,
        "email": user.email,
        "role":  user.role,
        "name":  user.name,
    })

    return {
        "message": f"Welcome back, {user.name}!",
        "token":   token,
        "user": {
            "id":    user.id,
            "name":  user.name,
            "email": user.email,
            "role":  user.role,
        }
    }


@router.get("/me")
def get_me(token: str, db: Session = Depends(get_db)):
    """
    Get current logged-in user info from token.
    Frontend calls this on page load to verify token is still valid.
    """
    payload = decode_token(token)
    user = db.query(User).filter(User.id == payload["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {
        "id":    user.id,
        "name":  user.name,
        "email": user.email,
        "role":  user.role,
    }


@router.get("/users", tags=["Admin"])
def get_all_users(token: str, db: Session = Depends(get_db)):
    """
    Admin only — get all registered users.
    """
    payload = decode_token(token)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access only.")

    users = db.query(User).all()
    return {
        "total": len(users),
        "users": [
            {
                "id":         u.id,
                "name":       u.name,
                "email":      u.email,
                "role":       u.role,
                "is_active":  u.is_active,
                "created_at": str(u.created_at),
            }
            for u in users
        ]
    }
