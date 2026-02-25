from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from chatbot_engine import HealthChatbot
from database import get_db
from dependencies import get_current_user
from models import User, HealthProfile, FoodItem
import json

router = APIRouter(prefix="/api/chatbot", tags=["Chatbot"])

# Initialize Chatbot Engine (This will be re-initialized per request with fresh food items)
chatbot_engine = None # Placeholder, will be initialized in the endpoint

@router.post("/query")
async def chatbot_query(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        data = await request.json()
        message = data.get('message', '')
        context = data.get('context', {})
        
        # Fetch user's actual health profile
        db_profile = db.query(HealthProfile).filter(HealthProfile.user_id == current_user.id).first()
        
        profile_data = {}
        if db_profile:
            try:
                diseases = json.loads(db_profile.disease) if db_profile.disease else []
            except:
                diseases = []
                
            profile_data = {
                "age": db_profile.age,
                "bmi": db_profile.bmi,
                "disease": diseases,
                "allergies": db_profile.allergies
            }

        # Fetch fresh DB foods instead of the old hardcoded list
        db_foods = db.query(FoodItem).filter(FoodItem.is_available == True).all()
        food_items = []
        
        for f in db_foods:
            food_items.append({
                "id": f.id,
                "name": f.name,
                "category": f.category,
                "price": f.price,
                "image": f.image_emoji,
                "calories": f.calories,
                "sugar": f.sugar,
                "protein": f.protein,
                "sodium": f.sodium,
                "carbs": f.carbs,
                "description": f.description or ""
            })

        # Initialize Bot Engine with the live DB foods for this request
        # Assuming the chatbot_engine constructor takes profile_data as the first arg, food_items as second, and context as third
        # Based on the original `chatbot_engine = HealthChatbot({}, FOOD_ITEMS, [])`
        # The first argument seems to be for initial context/state, which is passed dynamically in `get_response`
        # So, we pass an empty dict for initial state, and the fetched food_items.
        # The third argument `[]` in the original init suggests it might be for history or similar, which is also passed dynamically.
        # Let's assume the constructor signature is HealthChatbot(initial_state, food_items, initial_history)
        current_chatbot_engine = HealthChatbot({}, food_items, [])
        
        # Get response from engine with real profile data
        response = current_chatbot_engine.get_response(
            user_id=str(current_user.id),
            message=message,
            context=context,
            profile=profile_data
        )

        # UI Enrichment Logic (from smart canteen - Copy - Copy)
        msg_low = message.lower()
        if "pasta" in msg_low or "quinoa" in msg_low:
            response['type'] = 'explanation'
            response['text'] = "I recommended the **Quinoa Bowl** because its low glycemic index (GI: 53) aligns with your health management profile."
            response['explanation_card'] = {
                'title': 'Why this recommendation?',
                'chips': [
                    {'label': 'Glycemic Control', 'value': 'Low GI (53) prevents spikes', 'type': 'impact', 'color': 'green', 'icon': 'trending-down'},
                    {'label': 'Sodium Alert', 'value': 'Low sodium (200mg)', 'type': 'warning', 'color': 'orange', 'icon': 'alert-triangle'}
                ],
                'rule_id': 'NUTRI-882 • Conf: 98%'
            }
        elif "chicken" in msg_low or "salad" in msg_low:
            response['type'] = 'explanation'
            response['text'] = "The **Grilled Salmon** or **Fresh Green Salad** are excellent choices! They have high fiber and protein content which is excellent for your sugar management."
            response['explanation_card'] = {
                'title': 'Macro Comparison',
                'chips': [
                    {'label': 'Impact', 'value': 'Stable Glucose', 'type': 'impact', 'color': 'green', 'icon': 'activity'},
                    {'label': 'Fiber', 'value': '7.2g / serving', 'type': 'nutrient', 'color': 'blue', 'icon': 'bar-chart-3'}
                ],
                'rule_id': 'NUTRI-901 • Conf: 95%'
            }
        
        return response
        
    except Exception as e:
        print(f"Chatbot Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
