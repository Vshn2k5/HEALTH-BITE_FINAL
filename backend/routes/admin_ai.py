"""Admin AI Monitoring — /api/admin/ai"""
from fastapi import APIRouter, Depends, BackgroundTasks, Request
from sqlalchemy.orm import Session
from database import get_db
from models import AiModelStatus, AiTrainingHistory, User
from routes.admin_deps import get_current_admin
from routes.audit_helper import log_action
from datetime import datetime
import time

router = APIRouter(prefix="/api/admin/ai", tags=["admin-ai"])


@router.get("/status")
def ai_status(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    status_row = db.query(AiModelStatus).first()
    if not status_row:
        status_row = AiModelStatus()
        db.add(status_row)
        db.commit()
    
    return {
        "status": status_row.status,
        "version": status_row.version,
        "accuracy": status_row.accuracy,
        "precision": status_row.precision_score,
        "recall": status_row.recall_score,
        "f1": status_row.f1_score,
        "last_trained": status_row.last_trained.isoformat() if status_row.last_trained else None,
        "total_predictions": status_row.total_predictions,
    }


@router.get("/features")
def ai_features(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    # Synthetic feature importance for the UI chart
    return {
        "features": [
            {"name": "User Age", "importance": 0.25},
            {"name": "BMI", "importance": 0.18},
            {"name": "Disease Hist.", "importance": 0.22},
            {"name": "Allergies", "importance": 0.15},
            {"name": "Past Orders", "importance": 0.12},
            {"name": "Time of Day", "importance": 0.08},
        ]
    }


@router.get("/accuracy-history")
def ai_accuracy_history(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    history = db.query(AiTrainingHistory).filter(AiTrainingHistory.status == 'success').order_by(AiTrainingHistory.ended_at.asc()).limit(10).all()
    
    dates = []
    acc = []
    notes = []
    
    for h in history:
        dates.append(h.ended_at.strftime("%b %d") if h.ended_at else "?")
        acc.append(h.accuracy_after or 0)
        notes.append(h.notes or "")
        
    if not dates:
        dates = ["Jan 1", "Jan 15", "Feb 1", "Feb 15", "Mar 1"]
        acc = [82.5, 84.1, 85.0, 87.2, 88.5]
        notes = ["Initial", "Tuned params", "Added features", "More data", "Current"]
        
    return {"dates": dates, "accuracy": acc, "notes": notes}


@router.get("/logs")
def ai_logs(page: int = 1, per_page: int = 20, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    # Mock recommendation logs
    return {
        "total": 120,
        "page": page,
        "pages": 6,
        "logs": [
            {
                "id": f"log-{i}",
                "user_name": f"User {i}",
                "food_name": "Salad Bowl",
                "reason": "Low sodium recommended",
                "confidence": 88.5,
                "action": "accepted",
                "created_at": datetime.utcnow().isoformat()
            } for i in range(1, 11)
        ]
    }


@router.get("/training-history")
def ai_training_history(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    h_list = db.query(AiTrainingHistory).order_by(AiTrainingHistory.started_at.desc()).limit(20).all()
    
    results = []
    for h in h_list:
        results.append({
            "id": h.id,
            "started_at": h.started_at.isoformat() if h.started_at else None,
            "duration": f"{h.duration_seconds}s" if h.duration_seconds else "-",
            "accuracy_before": h.accuracy_before,
            "accuracy_after": h.accuracy_after,
            "status": h.status,
            "triggered_by_name": "System"  # Simplify
        })
        
    if not results:
        results = [{
            "id": 1,
            "started_at": datetime.utcnow().isoformat(),
            "duration": "125s",
            "accuracy_before": 87.2,
            "accuracy_after": 88.5,
            "status": "success",
            "triggered_by_name": "Admin"
        }]
    return {"history": results}


def _run_retrain_task(db: Session, training_id: int):
    """Background task to simulate ML retraining."""
    time.sleep(10)  # Simulate 10-second training
    
    th = db.query(AiTrainingHistory).filter(AiTrainingHistory.id == training_id).first()
    ms = db.query(AiModelStatus).first()
    
    if th and ms:
        # Update metrics
        ms.status = "active"
        ms.version = "1.0.1"  # bumped
        new_acc = min(99.9, ms.accuracy + 1.2 if ms.accuracy else 88.5)
        ms.accuracy = new_acc
        ms.last_trained = datetime.utcnow()
        
        # Update run hx
        th.status = "success"
        th.ended_at = datetime.utcnow()
        th.duration_seconds = 10
        th.accuracy_after = new_acc
        th.notes = "Retrained with latest user data"
        
        db.commit()


@router.post("/retrain", status_code=202)
def trigger_retrain(request: Request, bg_tasks: BackgroundTasks, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    status_row = db.query(AiModelStatus).first()
    if not status_row:
        status_row = AiModelStatus(accuracy=85.0)
        db.add(status_row)
        
    if status_row.status == "retraining":
        return {"error": "Training already in progress"}
        
    current_acc = status_row.accuracy
    status_row.status = "retraining"
    
    th = AiTrainingHistory(
        triggered_by=admin.id,
        accuracy_before=current_acc,
        status="in_progress"
    )
    db.add(th)
    db.commit()
    db.refresh(th)
    
    log_action(db, admin.id, "RETRAIN", "ai_model", None, "Triggered AI model retrain", request=request)
    
    bg_tasks.add_task(_run_retrain_task, db, th.id)
    
    return {"message": "Retraining started", "training_id": th.id}
