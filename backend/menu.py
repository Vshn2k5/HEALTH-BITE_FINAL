from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user
from models import User, HealthProfile, Order, FoodItem

from schemas import OrderCreate, OrderResponse
from chatbot_engine import HealthChatbot
import json

router = APIRouter(
    prefix="/api/menu",
    tags=["menu"]
)

@router.get("/intelligent")
async def get_intelligent_menu(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch real food items added by the admin from DB
    db_foods = db.query(FoodItem).filter(FoodItem.is_available == True).all()
    food_items = []
    
    for f in db_foods:
        food_items.append({
            "id": f.id,
            "name": f.name,
            "category": f.category,
            "price": f.price,
            "image": f.image_emoji,  # map image_emoji to image for the frontend
            "calories": f.calories,
            "sugar": f.sugar,
            "protein": f.protein,
            "sodium": f.sodium,
            "carbs": f.carbs,
            "description": f.description or ""
        })

    # Get user profile
    profile_db = db.query(HealthProfile).filter(HealthProfile.user_id == current_user.id).first()
    
    # Simple profile if none exists
    profile = {
        "age": 25,
        "disease": [],
        "allergies": [],
        "dietary_preference": "Non-Veg",
        "target_calories": 2000
    }
    
    if profile_db:
        try:
            diseases = json.loads(profile_db.disease) if profile_db.disease else []
            allergies = json.loads(profile_db.allergies) if profile_db.allergies and profile_db.allergies != "None" else []
        except:
            diseases = []
            allergies = []
        
        profile = {
            "age": profile_db.age,
            "disease": diseases,
            "allergies": allergies,
            "dietary_preference": profile_db.dietary_preference or "Non-Veg",
            "target_calories": 2000 
        }

    # Initialize Chatbot Engine for analysis
    engine = HealthChatbot({}, food_items, [])
    
    intelligent_menu = []
    for item in food_items:
        # Use new scoring engine
        score, penalties = engine.calculate_health_score(item, profile)
        
        # Add matches and insights
        item_copy = item.copy()
        item_copy['match_score'] = score
        
        if score >= 80:
            item_copy['risk_level'] = 0
            item_copy['insight'] = "Perfect match for your health profile."
        elif score >= 50:
            item_copy['risk_level'] = 1
            item_copy['insight'] = f"Caution: {', '.join(penalties)}" if penalties else "Moderate nutrition match."
        else:
            item_copy['risk_level'] = 2
            item_copy['insight'] = f"Restricted: {', '.join(penalties)}" if penalties else "High risk for your profile."
        
        # Assign tag based on nutrition
        low_gi_keywords = ['quinoa', 'oats', 'lentils', 'broccoli', 'almonds', 'nuts', 'seeds']
        if item.get('sugar', 0) == 0: item_copy['tag'] = "Sugar Free"
        elif any(k in item['name'].lower() for k in low_gi_keywords): item_copy['tag'] = "Low GI"
        elif item.get('carbs', 0) < 20: item_copy['tag'] = "Low Carb"
        elif item.get('protein', 0) > 25: item_copy['tag'] = "High Protein"
        elif item.get('sugar', 0) < 5: item_copy['tag'] = "Low Sugar"
        else: item_copy['tag'] = "Standard"
        
        intelligent_menu.append(item_copy)
        
    return intelligent_menu


@router.post("/order")
async def place_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_order = Order(
        user_id=current_user.id,
        items=json.dumps(order_data.items),
        total_price=order_data.total_price,
        total_calories=order_data.total_calories,
        total_sugar=order_data.total_sugar,
        total_sodium=order_data.total_sodium
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order

@router.get("/history")
async def get_order_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    orders = db.query(Order).filter(Order.user_id == current_user.id).order_by(Order.id.desc()).all()
    return orders
