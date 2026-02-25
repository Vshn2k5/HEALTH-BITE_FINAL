"""Admin Audit Logs — /api/admin/audit"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import AuditLog, User
from routes.admin_deps import get_current_admin
from typing import Optional

router = APIRouter(prefix="/api/admin/audit", tags=["admin-audit"])


@router.get("/summary")
def audit_summary(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    total = db.query(func.count(AuditLog.id)).scalar()
    todays = db.query(func.count(AuditLog.id)).filter(func.date(AuditLog.timestamp) == func.date('now')).scalar()
    
    unique_admins = db.query(func.count(func.distinct(AuditLog.admin_id))).scalar()
    
    # Let's count high risk actions (e.g. DELETE, RETRAIN, STATUS_CHANGE)
    critical_actions = db.query(func.count(AuditLog.id)).filter(AuditLog.action_type.in_(["DELETE", "RETRAIN", "STATUS_CHANGE"])).scalar()
    
    return {
        "total_actions": total,
        "todays_actions": todays,
        "active_admins": unique_admins,
        "critical_actions": critical_actions
    }


@router.get("/admins")
def get_audit_admins(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    # Get distinct admins who have audit logs
    admin_ids = db.query(AuditLog.admin_id).distinct().all()
    admin_ids = [aid[0] for aid in admin_ids if aid[0] is not None]
    
    admins = db.query(User).filter(User.id.in_(admin_ids)).all()
    return [{"id": a.id, "name": a.name} for a in admins]


@router.get("/")
def get_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    admin_id: Optional[int] = None,
    action_type: Optional[str] = None,
    target_table: Optional[str] = None,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(AuditLog).outerjoin(User)
    
    if search:
        q = q.filter((AuditLog.summary.ilike(f"%{search}%")) | (AuditLog.target_table.ilike(f"%{search}%")))
    if admin_id:
        q = q.filter(AuditLog.admin_id == admin_id)
    if action_type:
        q = q.filter(AuditLog.action_type == action_type)
    if target_table:
        q = q.filter(AuditLog.target_table == target_table)
        
    q = q.order_by(AuditLog.timestamp.desc())
    
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    
    results = []
    for log in items:
        # Get admin initials safely
        initials = "??"
        if log.admin and log.admin.name:
            parts = log.admin.name.split()
            initials = "".join([p[0].upper() for p in parts[:2]])
            
        results.append({
            "id": log.id,
            "timestamp_display": log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if log.timestamp else None,
            "admin_name": log.admin.name if log.admin else "System",
            "admin_initials": initials,
            "admin_role": log.admin.role if log.admin else "N/A",
            "action_type": log.action_type,
            "summary": log.summary,
            "target_table": log.target_table,
            "ip_address": log.ip_address,
            "payload": log.payload,
            "payload_before": log.payload_before,
            "payload_after": log.payload_after
        })
        
    return {
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page,
        "items": results
    }
