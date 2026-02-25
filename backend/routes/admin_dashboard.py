"""Admin Dashboard endpoints — /api/admin/*"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from database import get_db
from models import User, Order, FoodItem, Inventory, HealthProfile
from routes.admin_deps import get_current_admin
from datetime import datetime, date, timedelta

router = APIRouter(prefix="/api/admin", tags=["admin-dashboard"])


def _today_range():
    today = date.today()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())
    return start.isoformat(), end.isoformat()


@router.get("/overview")
def overview(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    today_start, today_end = _today_range()

    # Revenue today
    revenue_today = db.query(func.coalesce(func.sum(Order.total_price), 0)).filter(
        Order.created_at >= today_start, Order.created_at <= today_end
    ).scalar() or 0

    # Same period last week
    last_week_start = (datetime.combine(date.today(), datetime.min.time()) - timedelta(days=7)).isoformat()
    last_week_end = (datetime.combine(date.today(), datetime.max.time()) - timedelta(days=7)).isoformat()
    revenue_last_week = db.query(func.coalesce(func.sum(Order.total_price), 0)).filter(
        Order.created_at >= last_week_start, Order.created_at <= last_week_end
    ).scalar() or 0

    revenue_change = 0
    if revenue_last_week > 0:
        revenue_change = round((revenue_today - revenue_last_week) / revenue_last_week * 100, 1)

    # Orders today
    orders_today = db.query(func.count(Order.id)).filter(
        Order.created_at >= today_start, Order.created_at <= today_end
    ).scalar() or 0

    orders_pending = db.query(func.count(Order.id)).filter(
        Order.status == "pending",
        Order.created_at >= today_start, Order.created_at <= today_end
    ).scalar() or 0

    # Users
    total_users = db.query(func.count(User.id)).filter(User.role == "USER", User.disabled == 0).scalar() or 0
    month_start = date.today().replace(day=1).isoformat()
    # Users don't have joined_at — count all users registered this month via profile
    new_this_month = 0  # placeholder (no registration date on User model)

    # Low stock
    low_stock = db.query(func.count(Inventory.id)).filter(
        Inventory.current_stock < Inventory.reorder_level
    ).scalar() or 0

    return {
        "revenue": {"value": round(revenue_today, 2), "change": revenue_change},
        "orders": {"value": orders_today, "pending": orders_pending},
        "users": {"value": total_users, "newThisMonth": new_this_month},
        "lowStock": {"value": low_stock},
    }


@router.get("/analytics/orders-by-hour-today")
def orders_by_hour(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    today_start, today_end = _today_range()
    orders = db.query(Order).filter(
        Order.created_at >= today_start, Order.created_at <= today_end
    ).all()

    hour_counts = {}
    for order in orders:
        try:
            dt = datetime.fromisoformat(order.created_at)
            h = dt.hour
            hour_counts[h] = hour_counts.get(h, 0) + 1
        except Exception:
            pass

    canteen_hours = range(8, min(datetime.now().hour + 1, 22))
    labels = [f"{h % 12 or 12}{'AM' if h < 12 else 'PM'}" for h in canteen_hours]
    counts = [hour_counts.get(h, 0) for h in canteen_hours]

    return {"hours": labels, "counts": counts}


@router.get("/analytics/sales")
def sales_trend(
    period: str = Query("7d", regex="^(7d|30d|90d)$"),
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin)
):
    days = {"7d": 7, "30d": 30, "90d": 90}[period]
    start_dt = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())
    orders = db.query(Order).filter(Order.created_at >= start_dt.isoformat()).all()

    daily = {}
    for order in orders:
        try:
            d = order.created_at[:10]
            if d not in daily:
                daily[d] = {"revenue": 0, "orders": 0}
            daily[d]["revenue"] += order.total_price or 0
            daily[d]["orders"] += 1
        except Exception:
            pass

    sorted_days = sorted(daily.keys())
    labels = []
    revenue = []
    ord_counts = []
    for d in sorted_days:
        dt = datetime.strptime(d, "%Y-%m-%d")
        labels.append(dt.strftime("%b %d"))
        revenue.append(round(daily[d]["revenue"], 2))
        ord_counts.append(daily[d]["orders"])

    return {"labels": labels, "revenue": revenue, "orders": ord_counts}


@router.get("/alerts")
def get_alerts(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    """Return food items with high sodium or sugar as risk alerts."""
    risky = db.query(FoodItem).filter(
        FoodItem.is_available == True,
        (FoodItem.sodium > 800) | (FoodItem.sugar > 15)
    ).limit(10).all()

    alerts = []
    for f in risky:
        if f.sodium > 800:
            flag = f"High Sodium ({f.sodium}mg)"
            risk = "High" if f.sodium > 1200 else "Medium"
        else:
            flag = f"High Sugar ({f.sugar}g)"
            risk = "High" if f.sugar > 25 else "Medium"

        alerts.append({
            "id": f.id,
            "item": f.name,
            "flag": flag,
            "risk": risk,
            "emoji": f.image_emoji,
            "category": f.category,
        })

    return alerts


@router.get("/dashboard-stats")
def dashboard_stats(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    """Legacy endpoint — keep for admin.html gateway compatibility."""
    ov = overview(db, admin)
    return {
        "orders_today": ov["orders"]["value"],
        "revenue_today": ov["revenue"]["value"],
        "risk_alerts": len(get_alerts(db, admin)),
        "system_health": 98,
        "user_health_trend": [],
    }
