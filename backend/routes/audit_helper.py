"""Audit log utility — call after every admin write operation."""
import json
from sqlalchemy.orm import Session
from models import AuditLog
from fastapi import Request


def log_action(
    db: Session,
    admin_id: int,
    action_type: str,
    target_table: str,
    target_id: str = None,
    summary: str = None,
    payload: dict = None,
    before: dict = None,
    after: dict = None,
    request: Request = None,
):
    """Insert an audit log entry. Call AFTER the successful DB commit."""
    ip = None
    ua = None
    if request:
        ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent")

    entry = AuditLog(
        admin_id=admin_id,
        action_type=action_type,
        target_table=target_table,
        target_id=str(target_id) if target_id else None,
        summary=summary,
        payload=json.dumps(payload) if payload else None,
        payload_before=json.dumps(before) if before else None,
        payload_after=json.dumps(after) if after else None,
        ip_address=ip,
        user_agent=ua,
    )
    db.add(entry)
    db.commit()
