from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean, Text, DateTime
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="USER")  # USER | ADMIN
    disabled = Column(Integer, default=0)
    profile_completed = Column(Integer, default=0)
    onboarding_step = Column(Integer, default=0)

    health_profile = relationship("HealthProfile", back_populates="user", uselist=False)
    orders = relationship("Order", back_populates="user")
    daily_logs = relationship("DailyLog", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="admin")


class HealthProfile(Base):
    __tablename__ = "health_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    age = Column(Integer)
    height_cm = Column(Float)
    weight_kg = Column(Float)
    bmi = Column(Float)
    gender = Column(String)

    disease = Column(String, default="[]")
    severity = Column(String, default="{}")
    health_values = Column(String, default="{}")

    diabetes_status = Column(String, default="Normal")
    bp_status = Column(String, default="Normal")
    cholesterol_status = Column(String, default="Normal")

    bmi_category = Column(String, default="Normal")
    risk_score = Column(Integer, default=0)
    risk_level = Column(String, default="Low")

    allergies = Column(String, default="None")
    dietary_preference = Column(String, default="Veg")

    user = relationship("User", back_populates="health_profile")


# ─── FOOD ITEMS ────────────────────────────────────────────────────────────────

class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False)          # Breakfast | Lunch | Snacks | Beverages | Desserts
    description = Column(Text, default="")
    price = Column(Float, nullable=False)
    calories = Column(Float, default=0)
    protein = Column(Float, default=0)
    carbs = Column(Float, default=0)
    fat = Column(Float, default=0)
    sugar = Column(Float, default=0)
    sodium = Column(Float, default=0)
    dietary_type = Column(String, default="Veg")       # Veg | Non-Veg | Vegan
    image_emoji = Column(String, default="🍽️")
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inventory = relationship("Inventory", back_populates="food", uselist=False)
    order_items = relationship("OrderItem", back_populates="food")


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    food_id = Column(Integer, ForeignKey("food_items.id"), unique=True)
    current_stock = Column(Integer, default=100)
    reorder_level = Column(Integer, default=20)
    unit = Column(String, default="portions")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    food = relationship("FoodItem", back_populates="inventory")


# ─── ORDERS ────────────────────────────────────────────────────────────────────

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    items = Column(String)              # legacy JSON string kept for user-side compatibility
    total_price = Column(Float)
    total_calories = Column(Float)
    total_sugar = Column(Float)
    total_sodium = Column(Float)
    status = Column(String, default="completed")   # pending | completed | cancelled
    payment_method = Column(String, default="Cash")
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

    user = relationship("User", back_populates="orders")
    order_items = relationship("OrderItem", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    food_id = Column(Integer, ForeignKey("food_items.id"), nullable=True)
    food_name = Column(String)          # snapshot at time of order
    qty = Column(Integer, default=1)
    unit_price = Column(Float)
    subtotal = Column(Float)
    health_flag = Column(Boolean, default=False)

    order = relationship("Order", back_populates="order_items")
    food = relationship("FoodItem", back_populates="order_items")


# ─── DAILY LOG ─────────────────────────────────────────────────────────────────

class DailyLog(Base):
    __tablename__ = "daily_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(String, default=lambda: datetime.utcnow().strftime("%Y-%m-%d"))

    water_intake_ml = Column(Integer, default=0)
    steps = Column(Integer, default=0)
    mood = Column(String, default="Neutral")

    user = relationship("User", back_populates="daily_logs")


# ─── AUDIT LOGS ────────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action_type = Column(String, nullable=False)    # CREATE|UPDATE|DELETE|LOGIN|LOGOUT|EXPORT|RETRAIN|STATUS_CHANGE
    target_table = Column(String, nullable=True)
    target_id = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    payload = Column(Text, nullable=True)           # JSON string
    payload_before = Column(Text, nullable=True)    # JSON string
    payload_after = Column(Text, nullable=True)     # JSON string
    ip_address = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    admin = relationship("User", back_populates="audit_logs")


# ─── AI MONITORING ─────────────────────────────────────────────────────────────

class AiModelStatus(Base):
    __tablename__ = "ai_model_status"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, default="active")       # active | degraded | retraining
    version = Column(String, default="1.0.0")
    accuracy = Column(Float, default=0.0)
    precision_score = Column(Float, default=0.0)
    recall_score = Column(Float, default=0.0)
    f1_score = Column(Float, default=0.0)
    last_trained = Column(DateTime, nullable=True)
    total_predictions = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AiTrainingHistory(Base):
    __tablename__ = "ai_training_history"

    id = Column(Integer, primary_key=True, index=True)
    triggered_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    accuracy_before = Column(Float, nullable=True)
    accuracy_after = Column(Float, nullable=True)
    status = Column(String, default="in_progress")  # success | failed | in_progress
    notes = Column(Text, nullable=True)



