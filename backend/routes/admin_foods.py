"""Admin Food CRUD — /api/admin/foods"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import FoodItem, Inventory, OrderItem
from routes.admin_deps import get_current_admin
from routes.audit_helper import log_action
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/admin/foods", tags=["admin-foods"])


class FoodCreate(BaseModel):
    name: str
    category: str
    description: Optional[str] = ""
    price: float = 0.0
    calories: float = 0
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    sugar: float = 0
    sodium: float = 0
    dietary_type: str = "Veg"
    image_url: Optional[str] = ""
    stock: int = 100
    reorder_level: int = 20
    available: bool = True


class FoodUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    calories: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fat: Optional[float] = None
    sugar: Optional[float] = None
    sodium: Optional[float] = None
    dietary_type: Optional[str] = None
    image_url: Optional[str] = None
    stock: Optional[int] = None
    is_available: Optional[bool] = None
    available: Optional[bool] = None


def _food_dict(f: FoodItem) -> dict:
    return {
        "id": f.id,
        "name": f.name,
        "category": f.category,
        "description": f.description,
        "price": f.price,
        "calories": f.calories,
        "protein": f.protein,
        "carbs": f.carbs,
        "fat": f.fat,
        "sugar": f.sugar,
        "sodium": f.sodium,
        "dietary_type": f.dietary_type,
        "image_emoji": f.image_emoji,
        "is_available": f.is_available,
        "stock": f.inventory.current_stock if f.inventory else None,
        "reorder_level": f.inventory.reorder_level if f.inventory else None,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }


@router.get("")
@router.get("/")
def list_foods(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    available_only: bool = False,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(FoodItem)
    if search:
        q = q.filter(FoodItem.name.ilike(f"%{search}%"))
    if category:
        q = q.filter(FoodItem.category == category)
    if available_only:
        q = q.filter(FoodItem.is_available == True)

    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page,
        "items": [_food_dict(f) for f in items],
    }


@router.post("", status_code=201)
@router.post("/", status_code=201)
def create_food(body: FoodCreate, request: Request, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    food = FoodItem(
        name=body.name, category=body.category, description=body.description,
        price=body.price, calories=body.calories, protein=body.protein,
        carbs=body.carbs, fat=body.fat, sugar=body.sugar, sodium=body.sodium,
        dietary_type=body.dietary_type, image_emoji=body.image_url,
        is_available=body.available
    )
    db.add(food)
    db.flush()  # get food.id

    inv = Inventory(food_id=food.id, current_stock=body.stock, reorder_level=body.reorder_level)
    db.add(inv)
    db.commit()
    db.refresh(food)

    log_action(db, admin.id, "CREATE", "food_items", food.id,
               f"Created food item: {food.name}", {"name": food.name, "category": food.category}, request=request)

    return _food_dict(food)


@router.put("/{food_id}")
def update_food(food_id: int, body: FoodUpdate, request: Request, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    food = db.query(FoodItem).filter(FoodItem.id == food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Food item not found")

    before = _food_dict(food)
    data = body.dict(exclude_none=True)
    
    if "image_url" in data:
        food.image_emoji = data.pop("image_url")
    if "available" in data:
        food.is_available = data.pop("available")
    if "stock" in data:
        stock_val = data.pop("stock")
        if food.inventory:
            food.inventory.current_stock = stock_val
            food.inventory.updated_at = datetime.utcnow()
            
    for field, val in data.items():
        setattr(food, field, val)
        
    food.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(food)

    log_action(db, admin.id, "UPDATE", "food_items", food.id,
               f"Updated food item: {food.name}", before=before, after=_food_dict(food), request=request)

    return _food_dict(food)


@router.delete("/{food_id}", status_code=204)
def delete_food(food_id: int, request: Request, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    food = db.query(FoodItem).filter(FoodItem.id == food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Food item not found")

    # Block delete if active orders
    active_count = db.query(func.count(OrderItem.id)).filter(OrderItem.food_id == food_id).scalar()
    if active_count > 0:
        raise HTTPException(status_code=422, detail=f"Cannot delete: food has {active_count} order record(s)")

    name = food.name
    if food.inventory:
        db.delete(food.inventory)
    db.delete(food)
    db.commit()

    log_action(db, admin.id, "DELETE", "food_items", food_id,
               f"Deleted food item: {name}", request=request)


@router.patch("/{food_id}/availability")
def toggle_availability(food_id: int, request: Request, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    food = db.query(FoodItem).filter(FoodItem.id == food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Food item not found")

    food.is_available = not food.is_available
    food.updated_at = datetime.utcnow()
    db.commit()

    log_action(db, admin.id, "STATUS_CHANGE", "food_items", food.id,
               f"{'Enabled' if food.is_available else 'Disabled'} food: {food.name}", request=request)

    return {"id": food.id, "is_available": food.is_available}
