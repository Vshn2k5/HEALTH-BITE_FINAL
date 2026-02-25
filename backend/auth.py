from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from models import User
from schemas import UserCreate, UserResponse, LoginRequest, LoginResponse, RoleEnum, ForgotPasswordRequest, ResetPasswordRequest, VerifyIdentityRequest, DirectResetPasswordRequest
from database import get_db
from jose import jwt
import os
from datetime import datetime, timedelta
import re

# Create router for auth endpoints
router = APIRouter(
    prefix="/api/auth",
    tags=["authentication"]
)

# JWT configuration - In production, use environment variables
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Password hashing context
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# Password validation regex
PASSWORD_REGEX = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$"


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    User login endpoint
    """
    user = db.query(User).filter(User.email == request.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password
    if not pwd_context.verify(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify role matches
    if request.role.value == "ADMIN" and user.role in ["ADMIN", "SUPER_ADMIN", "MANAGER", "ANALYST"]:
        pass # Allow standard admin portal login for all existing staff levels
    elif user.role != request.role.value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid role",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + access_token_expires
    to_encode = {"sub": user.email, "role": user.role, "user_id": user.id, "exp": expire}
    access_token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return LoginResponse(
        message="Login successful",
        email=user.email,
        name=user.name,
        role=user.role,
        token=access_token,
        profile_completed=bool(user.profile_completed),
        onboarding_step=user.onboarding_step
    )


@router.post("/register", response_model=LoginResponse)
def register(request: UserCreate, db: Session = Depends(get_db)):
    """
    User registration endpoint
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    if len(request.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )
    
    # Strong password validation
    if not re.match(PASSWORD_REGEX, request.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must include uppercase, lowercase, number, and special character"
        )

    # Hash the password before storing
    hashed = pwd_context.hash(request.password)

    # Create new user
    db_user = User(
        name=request.name,
        email=request.email,
        hashed_password=hashed,
        role=request.role.value,
        disabled=0
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Create access token
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + access_token_expires
    to_encode = {"sub": db_user.email, "role": db_user.role, "user_id": db_user.id, "exp": expire}
    access_token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return LoginResponse(
        message="Registration successful",
        email=db_user.email,
        name=db_user.name,
        role=db_user.role,
        token=access_token,
        profile_completed=bool(db_user.profile_completed),
        onboarding_step=db_user.onboarding_step
    )


@router.post("/forgot-password", response_model=dict)
async def forgot_password(
    request: ForgotPasswordRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Initiate password reset process
    """
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        # Don't reveal if user exists for security, just return success
        return {"message": "If this email is registered, you will receive a reset link shortly."}

    # Create reset token (valid for 15 mins)
    expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode = {"sub": user.email, "type": "reset", "exp": expire}
    reset_token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    # Send email (async in background)
    from utils import send_reset_email
    background_tasks.add_task(send_reset_email, user.email, reset_token)

    return {"message": "If this email is registered, you will receive a reset link shortly."}


@router.post("/reset-password", response_model=dict)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Reset password using valid token
    """
    try:
        payload = jwt.decode(request.token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "reset":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")
            
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Validate new password strength
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )
    
    if not re.match(PASSWORD_REGEX, request.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must include uppercase, lowercase, number, and special character"
        )

    # Hash new password and save
    hashed = pwd_context.hash(request.new_password)
    user.hashed_password = hashed
    db.commit()

    return {"message": "Password reset successful"}


@router.post("/verify-identity", response_model=dict)
def verify_identity(request: VerifyIdentityRequest, db: Session = Depends(get_db)):
    """
    Verify user identity by matching email and name
    """
    user = db.query(User).filter(User.email == request.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email."
        )

    # Case-insensitive name comparison
    if user.name.strip().lower() != request.name.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Name does not match our records."
        )

    return {"verified": True, "message": "Identity verified successfully."}


@router.post("/reset-password-direct", response_model=dict)
def reset_password_direct(request: DirectResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Directly reset password after identity verification
    """
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Validate password strength
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )

    if not re.match(PASSWORD_REGEX, request.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must include uppercase, lowercase, number, and special character"
        )

    # Hash and save new password
    hashed = pwd_context.hash(request.new_password)
    user.hashed_password = hashed
    db.commit()

    return {"message": "Password reset successful"}
