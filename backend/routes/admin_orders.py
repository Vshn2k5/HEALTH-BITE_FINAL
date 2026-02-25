"""Admin Orders Management — /api/admin/orders"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from database import get_db
from models import Order, User
from routes.admin_deps import get_current_admin
from routes.audit_helper import log_action
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/admin/orders", tags=["admin-orders"])


class OrderStatusUpdate(BaseModel):
    status: str  # pending | completed | cancelled


@router.get("/")
def list_orders(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(Order).outerjoin(User)

    if status:
        q = q.filter(Order.status == status)
    if search:
        # Search by order ID or user name
        if search.isdigit():
            q = q.filter(Order.id == int(search))
        else:
            q = q.filter(User.name.ilike(f"%{search}%"))

    # Order by newest first
    q = q.order_by(Order.created_at.desc())

    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()

    results = []
    for order in items:
        # For legacy orders, `items` holds a JSON string of IDs, 
        # new orders use `order.order_items`. We'll just provide basic info here.
        
        # Calculate roughly how many items
        item_count = len(order.order_items) if order.order_items else 0
        if item_count == 0 and order.items:
            try:
                import json
                parsed = json.loads(order.items)
                item_count = len(parsed) if isinstance(parsed, list) else 1
            except:
                item_count = 1

        results.append(
            {
                "id": order.id,
                "user_name": order.user.name if order.user else "Guest",
                "user_email": order.user.email if order.user else None,
                "total_price": order.total_price,
                "status": order.status,
                "payment_method": order.payment_method,
                "created_at": order.created_at,
                "item_count": item_count,
            }
        )

    return {
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page,
        "items": results,
    }


@router.patch("/{order_id}/status")
def update_order_status(
    order_id: int,
    body: OrderStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    if body.status not in ["pending", "completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status
    if old_status == body.status:
        return {"id": order.id, "status": order.status}

    order.status = body.status
    db.commit()

    log_action(
        db,
        admin.id,
        "STATUS_CHANGE",
        "orders",
        order.id,
        f"Changed order #{order.id} status from {old_status} to {body.status}",
        before={"status": old_status},
        after={"status": body.status},
        request=request,
    )

    return {"id": order.id, "status": order.status}
