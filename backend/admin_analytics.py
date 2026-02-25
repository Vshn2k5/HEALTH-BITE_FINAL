from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user
from models import User
import random

router = APIRouter(
    prefix="/api/admin",
    tags=["admin analytics"]
)

@router.get("/dashboard-stats")
async def get_admin_dashboard_stats(current_user: User = Depends(get_current_user)):
    # Verify admin role
    if current_user.role != "ADMIN":
        return {"error": "Unauthorized"}
        
    return {
        "orders_today": 1245,
        "revenue_today": 8430,
        "risk_alerts": 3,
        "system_health": 98,
        "user_health_trend": [
            {"date": "Nov 01", "score": 82},
            {"date": "Nov 10", "score": 85},
            {"date": "Nov 20", "score": 84},
            {"date": "Nov 30", "score": 88}
        ]
    }

@router.get("/risk-flags")
async def get_risk_flags(current_user: User = Depends(get_current_user)):
    if current_user.role != "ADMIN":
        return {"error": "Unauthorized"}
        
    return [
        {
            "item": "Spicy Chicken Supreme",
            "flag": "High Sodium (>150% RDI)",
            "risk": "High",
            "time": "2 hrs ago",
            "image": "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=100&h=100&fit=crop"
        },
        {
            "item": "BBQ Ribs XL",
            "flag": "Excessive Sugar (Glaze)",
            "risk": "High",
            "time": "4 hrs ago",
            "image": "https://images.unsplash.com/photo-1544025162-d7669d26563d?w=100&h=100&fit=crop"
        },
        {
            "item": "Egg Fried Rice XL",
            "flag": "Excessive Saturated Fats",
            "risk": "Medium",
            "time": "5 hrs ago",
            "image": "https://images.unsplash.com/photo-1626555806689-fb53641fbdec?w=100&h=100&fit=crop"
        }
    ]
