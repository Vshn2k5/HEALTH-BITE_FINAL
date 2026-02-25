"""Admin Reports & Export — /api/admin/export"""
from fastapi import APIRouter, Depends, Query, Response, Request
from sqlalchemy.orm import Session
from database import get_db
from models import Order, FoodItem, Inventory
from routes.admin_deps import get_current_admin
from routes.audit_helper import log_action
import csv
from io import StringIO
from datetime import datetime

router = APIRouter(prefix="/api/admin/export", tags=["admin-export"])


def _generate_csv_response(rows: list, headers: list, filename: str):
    f = StringIO()
    writer = csv.writer(f)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    
    return Response(
        content=f.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}.csv"}
    )


@router.get("/{report_type}/preview")
def preview_report(
    report_type: str,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    if report_type == "sales":
        return {
            "total_rows": db.query(Order).filter(Order.status == 'completed').count(),
            "columns": ["Order ID", "Date", "Customer", "Amount", "Status"],
            "rows": [[o.id, o.created_at[:10], o.user.name if o.user else "?", f"${o.total_price}", o.status] 
                     for o in db.query(Order).filter(Order.status == 'completed').limit(5).all()],
            "summary": {"generated_at": datetime.utcnow().isoformat()}
        }
    elif report_type == "inventory":
        return {
            "total_rows": db.query(Inventory).count(),
            "columns": ["Food ID", "Food Name", "Category", "Stock", "Status"],
            "rows": [[i.food_id, i.food.name if i.food else "?", i.food.category if i.food else "?", i.current_stock, "Low" if i.current_stock <= i.reorder_level else "OK"] 
                     for i in db.query(Inventory).limit(5).all()],
            "summary": {"generated_at": datetime.utcnow().isoformat()}
        }
    else:
        # Fallback for health or unknown
        return {
            "total_rows": 0,
            "columns": ["ID", "Data"],
            "rows": [],
            "summary": {"generated_at": datetime.utcnow().isoformat()}
        }


@router.get("/sales")
def export_sales(
    request: Request,
    from_date: str = Query(None, alias="from"),
    to_date: str = Query(None, alias="to"),
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    q = db.query(Order).filter(Order.status == "completed")
    # Simplistic date filtering
    if from_date:
        q = q.filter(Order.created_at >= from_date)
    if to_date:
        q = q.filter(Order.created_at <= to_date + "T23:59:59")
        
    orders = q.all()
    headers = ["Order ID", "Date", "Time", "Customer ID", "Customer Name", "Total Price", "Payment Method"]
    rows = []
    
    for o in orders:
        dt = o.created_at
        rows.append([
            o.id,
            dt[:10] if dt else "",
            dt[11:19] if dt else "",
            o.user_id,
            o.user.name if o.user else "Guest",
            o.total_price,
            o.payment_method
        ])
        
    log_action(db, admin.id, "EXPORT", "orders", None, f"Exported {len(rows)} sales records", request=request)
    return _generate_csv_response(rows, headers, f"sales_report_{datetime.now().strftime('%Y%m%d')}")


@router.get("/health")
def export_health(
    request: Request,
    from_date: str = Query(None, alias="from"),
    to_date: str = Query(None, alias="to"),
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    # Just returning empty/dummy CSV for now as per plan
    headers = ["User ID", "BMI", "Risk Score", "Conditions"]
    rows = [[1, 24.5, 12, "None"], [2, 31.2, 45, "Hypertension"]]
    log_action(db, admin.id, "EXPORT", "health_profiles", None, "Exported health records", request=request)
    return _generate_csv_response(rows, headers, f"health_report_{datetime.now().strftime('%Y%m%d')}")


@router.get("/inventory")
def export_inventory(
    request: Request,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    invs = db.query(Inventory).all()
    headers = ["Food ID", "Name", "Category", "Current Stock", "Reorder Level", "Unit", "Status"]
    rows = []
    
    for i in invs:
        status = "In Stock"
        if i.current_stock == 0:
            status = "Out of Stock"
        elif i.current_stock <= i.reorder_level:
            status = "Low Stock"
            
        rows.append([
            i.food_id,
            i.food.name if i.food else "Unknown",
            i.food.category if i.food else "Unknown",
            i.current_stock,
            i.reorder_level,
            i.unit,
            status
        ])
        
    log_action(db, admin.id, "EXPORT", "inventory", None, f"Exported {len(rows)} inventory records", request=request)
    return _generate_csv_response(rows, headers, f"inventory_report_{datetime.now().strftime('%Y%m%d')}")
