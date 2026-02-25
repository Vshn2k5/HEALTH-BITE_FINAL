"""Admin Users Management — /api/admin/users"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from database import get_db
from models import User
from routes.admin_deps import get_current_admin
from routes.audit_helper import log_action
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


class UserRoleUpdate(BaseModel):
    role: str  # USER | ADMIN


class UserStatusUpdate(BaseModel):
    disabled: int  # 0 or 1


@router.get("/")
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(User)

    if search:
        q = q.filter((User.name.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%")))
    if role:
        q = q.filter(User.role == role)

    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()

    results = []
    for u in items:
        # Get risk level if profile exists
        risk_level = "Unknown"
        health_score = None
        if u.health_profile:
            risk_level = getattr(u.health_profile, "risk_level", "Unknown")
            health_score = getattr(u.health_profile, "risk_score", None)
            
        results.append(
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "disabled": u.disabled,
                "profile_completed": u.profile_completed,
                "risk_level": risk_level,
                "health_score": health_score,
            }
        )

    return {
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page,
        "items": results,
    }


@router.patch("/{user_id}/role")
def update_user_role(
    user_id: int,
    body: UserRoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    valid_roles = {"USER", "ADMIN"}
    if body.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent changing own role
    if user.id == admin.id:
        raise HTTPException(status_code=403, detail="Cannot change your own role")

    old_role = user.role
    if old_role == body.role:
        return {"id": user.id, "role": user.role}

    user.role = body.role
    db.commit()

    log_action(
        db,
        admin.id,
        "UPDATE",
        "users",
        user.id,
        f"Changed role for {user.email} from {old_role} to {body.role}",
        before={"role": old_role},
        after={"role": body.role},
        request=request,
    )

    return {"id": user.id, "role": user.role, "email": user.email}


@router.patch("/{user_id}/status")
def update_user_status(
    user_id: int,
    body: UserStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    if body.disabled not in [0, 1]:
        raise HTTPException(status_code=400, detail="disabled must be 0 or 1")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent disabling self
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")

    old_status = user.disabled
    if old_status == body.disabled:
        return {"id": user.id, "disabled": user.disabled}

    user.disabled = body.disabled
    db.commit()

    action_text = "Deactivated" if body.disabled == 1 else "Activated"
    log_action(
        db,
        admin.id,
        "STATUS_CHANGE",
        "users",
        user.id,
        f"{action_text} user {user.email}",
        before={"disabled": old_status},
        after={"disabled": body.disabled},
        request=request,
    )

    return {"id": user.id, "disabled": user.disabled, "email": user.email}
