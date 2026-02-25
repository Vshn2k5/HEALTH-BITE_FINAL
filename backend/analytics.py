from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user
from models import User
import random
from datetime import datetime, timedelta

router = APIRouter(
    prefix="/api/analytics",
    tags=["analytics"]
)

@router.get("/nutrition")
async def get_nutrition_analytics(
    days: int = Query(7),
    current_user: User = Depends(get_current_user)
):
    # Generates mock nutrition data based on days
    daily_data = []
    base_date = datetime.now()
    
    for i in range(days):
        date = base_date - timedelta(days=days-1-i)
        daily_data.append({
            "day": date.strftime("%Y-%m-%d"),
            "day_name": date.strftime("%a"),
            "calories": random.randint(1800, 2400),
            "protein": random.randint(50, 100),
            "carbs": random.randint(200, 300),
            "fat": random.randint(40, 80),
            "sugar": random.randint(30, 60),
            "sodium": random.randint(1500, 2500)
        })
    
    return {
        "daily_data": daily_data,
        "limits": {
            "calories": 2000,
            "sugar": 50,
            "sodium": 2300,
            "protein": 60,
            "carbs": 250,
            "fat": 70
        },
        "macro_distribution": {
            "protein": 25,
            "carbs": 50,
            "fat": 25
        }
    }

@router.get("/risk")
async def get_health_risks(current_user: User = Depends(get_current_user)):
    return [
        {"name": "Diabetes", "risk_score": 12, "trend": "down", "message": "Improving thanks to low sugar choices."},
        {"name": "Hypertension", "risk_score": 45, "trend": "up", "message": "Sodium intake high this week."},
        {"name": "Obesity", "risk_score": 28, "trend": "stable", "message": "Calorie intake matching burn rate."},
        {"name": "Anemia", "risk_score": 5, "trend": "down", "message": "Iron-rich foods added to diet."}
    ]

@router.get("/prediction")
async def get_health_predictions(current_user: User = Depends(get_current_user)):
    return [
        {
            "id": "PRED-001",
            "type": "warning",
            "title": "Sodium Overload Warning",
            "description": "At current rate, you will exceed your weekly sodium limit by 35%. This may increase blood pressure.",
            "suggestion": "Switch your afternoon Ramen for a Fresh Salad.",
            "intensity": 75
        },
        {
            "id": "PRED-002",
            "type": "success",
            "title": "Fiber Goal on Track",
            "description": "Consistent intake of Quinoa and Vegetables has stabilized your glucose levels.",
            "suggestion": "Keep up the great work!",
            "intensity": 90
        }
    ]

@router.get("/timeline")
async def get_health_timeline(current_user: User = Depends(get_current_user)):
    base_date = datetime.now()
    timeline = []
    for i in range(10):
        date = base_date - timedelta(days=i*2)
        timeline.append({
            "date": date.strftime("%b %d"),
            "score": random.randint(75, 95),
            "event": "Profile Updated" if i == 9 else ("High Sodium Day" if i % 3 == 0 else "Optimal Nutrition")
        })
    return timeline[::-1]
