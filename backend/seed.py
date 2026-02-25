"""Database Seed Script — Call this to populate initial data"""
import os
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import FoodItem, Inventory, User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

SAMPLE_FOODS = [
    {"name": "Masala Dosa", "category": "Breakfast", "price": 45.0, "calories": 250, "protein": 6, "sodium": 400, "image_emoji": "🌮", "dietary": "Veg"},
    {"name": "Idli Sambar", "category": "Breakfast", "price": 30.0, "calories": 150, "protein": 5, "sodium": 600, "image_emoji": "🍚", "dietary": "Veg"},
    {"name": "Poha", "category": "Breakfast", "price": 25.0, "calories": 220, "protein": 3, "sodium": 300, "image_emoji": "🥗", "dietary": "Veg"},
    {"name": "Upma", "category": "Breakfast", "price": 25.0, "calories": 200, "protein": 4, "sodium": 350, "image_emoji": "🍲", "dietary": "Veg"},
    {"name": "Veg Thali", "category": "Lunch", "price": 80.0, "calories": 650, "protein": 18, "sodium": 950, "image_emoji": "🍛", "dietary": "Veg"},
    {"name": "Chicken Biryani", "category": "Lunch", "price": 120.0, "calories": 700, "protein": 28, "sodium": 1100, "image_emoji": "🍗", "dietary": "Non-Veg"},
    {"name": "Paneer Butter Masala", "category": "Lunch", "price": 90.0, "calories": 550, "protein": 15, "sodium": 800, "image_emoji": "🍲", "dietary": "Veg"},
    {"name": "Dal Makhani", "category": "Lunch", "price": 60.0, "calories": 450, "protein": 12, "sodium": 700, "image_emoji": "🥣", "dietary": "Veg"},
    {"name": "Samosa", "category": "Snacks", "price": 15.0, "calories": 260, "protein": 3, "sodium": 250, "image_emoji": "🥟", "dietary": "Veg"},
    {"name": "Vada Pav", "category": "Snacks", "price": 20.0, "calories": 300, "protein": 4, "sodium": 350, "image_emoji": "🍔", "dietary": "Veg"},
    {"name": "Pani Puri", "category": "Snacks", "price": 30.0, "calories": 150, "protein": 2, "sodium": 450, "image_emoji": "🥘", "dietary": "Veg"},
    {"name": "Bhel Puri", "category": "Snacks", "price": 25.0, "calories": 180, "protein": 3, "sodium": 400, "image_emoji": "🥗", "dietary": "Veg"},
    {"name": "Tea", "category": "Beverages", "price": 10.0, "calories": 40, "protein": 1, "sodium": 10, "image_emoji": "☕", "dietary": "Veg"},
    {"name": "Coffee", "category": "Beverages", "price": 15.0, "calories": 50, "protein": 1, "sodium": 15, "image_emoji": "☕", "dietary": "Veg"},
    {"name": "Cold Coffee", "category": "Beverages", "price": 35.0, "calories": 200, "protein": 4, "sodium": 60, "image_emoji": "🥤", "dietary": "Veg"},
    {"name": "Lassi", "category": "Beverages", "price": 30.0, "calories": 180, "protein": 6, "sodium": 40, "image_emoji": "🥛", "dietary": "Veg"},
    {"name": "Fresh Lime Soda", "category": "Beverages", "price": 25.0, "calories": 80, "protein": 0, "sodium": 60, "image_emoji": "🍋", "dietary": "Veg"},
    {"name": "Mango Shake", "category": "Beverages", "price": 40.0, "calories": 250, "protein": 5, "sodium": 50, "image_emoji": "🥭", "dietary": "Veg"},
    {"name": "Gulab Jamun", "category": "Desserts", "price": 20.0, "calories": 300, "protein": 2, "sodium": 20, "image_emoji": "🥘", "dietary": "Veg"},
    {"name": "Rasgulla", "category": "Desserts", "price": 20.0, "calories": 250, "protein": 2, "sodium": 15, "image_emoji": "🥣", "dietary": "Veg"}
]

def seed_db():
    print("Creating tables if they don't exist...")
    from models import Base
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if admin exists
        admin = db.query(User).filter(User.role == "ADMIN").first()
        if not admin:
            print("Creating default ADMIN user...")
            admin = User(
                name="System Administrator",
                email="admin@canteen.local",
                hashed_password=pwd_context.hash("Admin@123"),
                role="ADMIN",
                profile_completed=1,
            )
            db.add(admin)
            db.commit()
            print(f"Created admin: admin@canteen.local / Admin@123")
            
        # Check if foods exist
        if db.query(FoodItem).count() == 0:
            print("Seeding food items...")
            for f in SAMPLE_FOODS:
                food = FoodItem(
                    name=f["name"],
                    category=f["category"],
                    price=f["price"],
                    calories=f["calories"],
                    protein=f["protein"],
                    sodium=f["sodium"],
                    dietary_type=f["dietary"],
                    image_emoji=f["image_emoji"],
                )
                db.add(food)
                db.flush()
                
                inv = Inventory(food_id=food.id, current_stock=100, reorder_level=20)
                db.add(inv)
                
            db.commit()
            print("Successfully seeded 20 food items & inventory.")
    except Exception as e:
        print(f"Error seeding DB: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
