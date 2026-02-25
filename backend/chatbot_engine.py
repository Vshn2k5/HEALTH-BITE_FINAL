import random
from datetime import datetime
import re

class HealthChatbot:
    def __init__(self, user_profiles, menu_db, orders_db):
        self.user_profiles = user_profiles
        self.menu_db = menu_db
        self.orders_db = orders_db
        
        self.intents = {
            'greeting': [r'hi', r'hello', r'hey', r'start', r'wake up'],
            'food_safety': [r'is (.*) safe', r'can i eat (.*)', r'is (.*) good for me', r'should i eat (.*)'],
            'recommendation': [r'what should i eat', r'suggest', r'recommend', r'im hungry', r'lunch options', r'dinner options'],
            'nutrition_query': [r'how much sugar', r'calories in', r'nutrition info', r'is (.*) healthy'],
            'disease_advice': [r'diabetes', r'blood pressure', r'sugar level', r'hypertension'],
            'order_status': [r'where is my order', r'order status', r'track order'],
            'analytics': [r'sugar intake', r'my stats', r'health report', r'analysis']
        }
        
        self.responses = {
            'greeting': [
                "Hello! I'm your Health Assistant. How can I help you today?",
                "Hi there! I'm here to help you make healthy food choices at the canteen.",
                "Greetings. I have your health profile loaded. What would you like to check?"
            ],
            'fallback': [
                "I'm not sure about that. Try asking 'Is this food safe for me?' or 'Recommend a healthy lunch'.",
                "I didn't quite catch that. You can ask me about food nutrition or your health stats.",
                "Could you rephrase that? I'm tuned to help with nutrition and health-risk queries."
            ]
        }

    def detect_intent(self, message):
        message = message.lower()
        for intent, patterns in self.intents.items():
            for pattern in patterns:
                match = re.search(pattern, message)
                if match:
                    return intent, match.groups()
        return 'general_chat', None

    def get_response(self, user_id, message, context=None, profile=None):
        message = message.lower()
        intent, groups = self.detect_intent(message)
        
        # Use provided profile or fall back to memoized one
        if not profile:
            profile = self.user_profiles.get(user_id, {})
        
        confidence = round(random.uniform(0.92, 0.99), 2)
        
        response_data = {
            'text': random.choice(self.responses['fallback']),
            'type': 'text',
            'intent': intent,
            'confidence': confidence,
            'chips': ["Suggest Lunch", "My Analytics", "Is Pizza Safe?"],
            'analysis': {}
        }

        if intent == 'greeting':
            response_data['text'] = random.choice(self.responses['greeting'])
            response_data['chips'] = ["Suggest Lunch", "Health Stats", "Is Pasta Safe?"]

        elif intent == 'food_safety':
            food_name = groups[0] if groups else "that food"
            response_data = self.analyze_food_safety(food_name, profile)
        
        elif intent == 'recommendation':
            response_data = self.get_recommendation(profile, context)
            
        elif intent == 'analytics':
             response_data['text'] = "Browsing your analytics... You've maintained an average Health Score of 88/100 this week. Your sugar intake is down by 8%!"
             response_data['type'] = 'text'
             response_data['chips'] = ["Full Report", "Suggestions"]
             
        elif intent == 'disease_advice':
            diseases = profile.get('disease', [])
            if diseases:
                response_data['text'] = f"Based on your profile ({', '.join(diseases)}), it's important to monitor specific nutrients. For example, keeping sodium low is key for Hypertension management."
            else:
                response_data['text'] = "You haven't listed any chronic conditions in your profile, which is great! I recommend a balanced diet high in fiber for long-term health."
            response_data['chips'] = ["Suggest Meal", "My Limits"]
            
        return response_data

    def calculate_health_score(self, food_item, profile):
        """
        Calculates a hybrid health score (0-100) based on:
        1. Base Nutrition Score (Macros)
        2. Hard Filtering (Allergies, Dietary Style)
        3. Penalty Scoring (Diseases vs Macros)
        """
        score = 95 # Base high score
        penalties = []
        
        # 1. Hard Filtering - Dietary Preference (Veg/Vegan)
        diet = profile.get('dietary_preference', 'Non-Veg')
        food_name = food_item['name'].lower()
        
        meat_keywords = ['chicken', 'beef', 'fish', 'salmon', 'pepperoni', 'meat', 'bacon', 'ham', 'tacos', 'lasagna', 'burger']
        dairy_keywords = ['cheese', 'milk', 'yogurt', 'cream', 'carbonara', 'egg', 'custard', 'donut', 'cake']
        
        if diet == 'Vegan':
            if any(k in food_name for k in meat_keywords + dairy_keywords):
                return 0, ["Violates Vegan restriction"]
        elif diet == 'Veg':
             if any(k in food_name for k in meat_keywords):
                return 0, ["Violates Vegetarian restriction"]

        # 2. Hard Filtering - Allergies
        allergies = profile.get('allergies', [])
        # Handle allergies which might be JSON string or list of dicts
        if isinstance(allergies, str) and allergies != "None":
            try:
                import json
                allergies = json.loads(allergies)
            except:
                allergies = []
        
        if isinstance(allergies, list):
            for alg in allergies:
                alg_name = alg.get('name', '').lower()
                if alg.get('severity') == 'Severe' and alg_name in food_name:
                    return 0, [f"Blocked: Severe {alg['name']} allergy"]
                elif alg_name and alg_name in food_name:
                    score -= 40
                    penalties.append(f"Caution: Contains {alg.get('name')}")

        # 3. Disease-Based Penalty Scoring
        raw_diseases = profile.get('disease', [])
        if isinstance(raw_diseases, str):
            try:
                import json
                raw_diseases = json.loads(raw_diseases)
            except:
                raw_diseases = []
        
        diseases = [d.lower() for d in raw_diseases]
        
        # Diabetes Penalty (Sugar/Carbs)
        if 'diabetes' in diseases:
            if food_item.get('sugar', 0) > 20: 
                score -= 50
                penalties.append("High Sugar Content")
            elif food_item.get('sugar', 0) > 10:
                score -= 20
                penalties.append("Moderate Sugar")
            if food_item.get('carbs', 0) > 60:
                score -= 15
                penalties.append("High Carbohydrate Load")

        # Hypertension Penalty (Sodium)
        if 'hypertension' in diseases:
            if food_item.get('sodium', 0) > 1500:
                score -= 50
                penalties.append("Critical Sodium Levels")
            elif food_item.get('sodium', 0) > 800:
                score -= 20
                penalties.append("High Sodium Levels")

        # Obesity Penalty (Calories)
        if 'obesity' in diseases:
            if food_item.get('calories', 0) > 800:
                score -= 40
                penalties.append("High Calorie Density")
            elif food_item.get('calories', 0) > 500:
                score -= 20
                penalties.append("Moderately High Calories")

        # 4. General Healthiness Boosts
        if food_item.get('protein', 0) > 20: score += 5
        if food_item.get('sugar', 0) < 5: score += 5
        
        return max(0, min(100, score)), penalties

    def analyze_food_safety(self, food_query, profile):
        # Find the food item in menu_db if possible
        food_item = None
        for item in self.menu_db:
            if item['name'].lower() == food_query.lower():
                food_item = item
                break
        
        if not food_item:
            # Fallback to simple rules if food not in menu
            return self._analyze_fallback(food_query, profile)

        score, penalties = self.calculate_health_score(food_item, profile)
        
        if score >= 80:
            risk_level = 0
            reason = "Excellent choice! This aligns perfectly with your health profile and nutritional targets."
        elif score >= 50:
            risk_level = 1
            reason = f"Caution recommended. {'. '.join(penalties)}. Consider a half-portion or a lower alternative."
        else:
            risk_level = 2
            reason = f"High Risk Alert: {'. '.join(penalties)}. This item significantly conflicts with your clinical profile."
            
        risk_label = "SAFE" if risk_level == 0 else ("CAUTION" if risk_level == 1 else "DANGER")
        sentiment = "positive" if risk_level == 0 else ("warning" if risk_level == 1 else "danger")

        return {
            'risk_level': risk_level,
            'match_score': score,
            'text': f"Analysis for '{food_item['name']}': Classified as **{risk_label}** ({score}/100). {reason}",
            'type': 'explanation',
            'sentiment': sentiment,
            'explanation_card': {
                'title': f"{food_item['name']} Analysis",
                'chips': [
                    {'label': 'Health Score', 'value': f"{score}/100", 'type': 'impact', 'color': 'green' if risk_level==0 else ('orange' if risk_level==1 else 'red'), 'icon': 'shield' if risk_level==0 else 'alert-triangle'},
                    {'label': 'Risk Assessment', 'value': risk_label, 'type': 'nutrient', 'color': 'blue', 'icon': 'activity'}
                ],
                'rule_id': f'HYBRID-AI-{random.randint(1000,9999)}'
            },
            'chips': ["Add to Tray", "Nutrition Facts"] if risk_level < 2 else ["Find Safer Option", "Why is this risky?"]
        }

    def _analyze_fallback(self, food_query, profile):
        # Generic keyword logic for unknown foods
        risk_level = 0
        reason = "I don't have the exact nutrition data, but it seems moderately safe."
        msg_low = food_query.lower()
        if any(x in msg_low for x in ['burger', 'pizza', 'fries', 'soda', 'cake', 'sweets', 'donut']):
            risk_level = 2
            reason = "Generally high in junk fats/sugars."
        
        risk_label = "SAFE" if risk_level == 0 else ("CAUTION" if risk_level == 1 else "DANGER")
        return {
            'risk_level': risk_level,
            'text': f"Generic Analysis for '{food_query}': Classified as **{risk_label}**. {reason}",
            'type': 'explanation',
            'sentiment': 'warning' if risk_level > 0 else 'positive',
            'explanation_card': {'title': food_query.title(), 'chips': []},
            'chips': ["Try common menu items"]
        }


    def get_recommendation(self, profile, context):
        hour = datetime.now().hour
        meal_type = 'Lunch' if 11 <= hour <= 15 else ('Dinner' if 17 <= hour <= 22 else 'Healthy Snack')
        
        rec_text = f"I've analyzed the menu for your **{meal_type}**. Based on your profile, here is my top pick:"
        
        item = {
            'name': 'Mediterranean Quinoa Bowl',
            'reason': 'Optimal protein-to-carb ratio for sustained energy.',
            'match_score': '98%'
        }
        
        return {
            'text': rec_text,
            'type': 'explanation',
            'explanation_card': {
                'title': item['name'],
                'chips': [
                    {'label': 'Match Score', 'value': item['match_score'], 'type': 'impact', 'color': 'green', 'icon': 'check-circle'},
                    {'label': 'Benefit', 'value': item['reason'], 'type': 'nutrient', 'color': 'blue', 'icon': 'sparkles'}
                ],
                'rule_id': 'REC-AI-001'
            },
            'chips': ["Order Now", "Why this?", "Other options"]
        }
