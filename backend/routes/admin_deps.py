"""Admin authentication & RBAC dependencies."""
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user
from models import User

ADMIN_ROLES = {"ADMIN"}

ROLE_LEVEL = {
    "ADMIN": 2,
    "USER": 1,
}


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require the caller to be any admin-level role."""
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    if current_user.disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )
    return current_user


def require_role(*roles):
    """Factory: only allow specific roles."""
    def checker(current_user: User = Depends(get_current_admin)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(roles)}"
            )
        return current_user
    return checker


def require_min_role(min_role: str):
    """Factory: allow min_role and above."""
    min_level = ROLE_LEVEL.get(min_role, 2)

    def checker(current_user: User = Depends(get_current_admin)) -> User:
        if ROLE_LEVEL.get(current_user.role, 0) < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires at least {min_role} role"
            )
        return current_user
    return checker
