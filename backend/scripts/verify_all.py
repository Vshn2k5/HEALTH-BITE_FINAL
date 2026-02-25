import requests
import sys
import uuid

BASE_URL = "http://localhost:8000/api"

import traceback

def print_result(name, res, expected_codes=[200, 201, 202, 204]):
    if res.status_code in expected_codes:
        print(f"[PASS] {name} ({res.status_code})")
        return True
    else:
        safe_text = res.text.encode('ascii', 'ignore').decode('ascii')
        print(f"[FAIL] {name} - Expected {expected_codes}, got {res.status_code}: {safe_text}")
        return False

def run_tests():
    print("====================================")
    print("  HEALTHBITE E2E SYSTEM VERIFICATION")
    print("====================================")

    # 1. Auth Setup
    print("\n--- 1. Authentication ---")
    
    admin_login = requests.post(f"{BASE_URL}/auth/login", json={"email": "admin@canteen.local", "password": "Admin@123", "role": "ADMIN"})
    if not print_result("Admin Login", admin_login): sys.exit(1)
    admin_token = admin_login.json().get("token")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Register random user
    rand_email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    user_reg = requests.post(f"{BASE_URL}/auth/register", json={"name":"Test User", "email":rand_email, "password":"Password@123", "role": "USER"})
    print_result("User Registration", user_reg)
    user_token = user_reg.json().get("token") if user_reg.status_code in [200, 201] else None
    
    if not user_token:
        # fallback login
        user_login = requests.post(f"{BASE_URL}/auth/login", json={"email": "viva1@lavida.com", "password": "Password123", "role": "USER"})
        user_token = user_login.json().get("token")
    user_headers = {"Authorization": f"Bearer {user_token}"} if user_token else {}


    # 2. Admin Dashboard & Analytics
    print("\n--- 2. Admin Dashboard & Analytics ---")
    endpoints = [
        ("/admin/overview", admin_headers),
        ("/admin/analytics/orders-by-hour-today", admin_headers),
        ("/admin/analytics/sales?period=7d", admin_headers),
        ("/admin/alerts", admin_headers),
        ("/admin/analytics/revenue-by-category", admin_headers),
        ("/admin/analytics/popular-foods", admin_headers),
        ("/admin/analytics/category-heatmap", admin_headers),
        ("/admin/analytics/disease-distribution", admin_headers),
        ("/admin/analytics/risk-trends", admin_headers),
        ("/admin/analytics/peak-hours", admin_headers),
        ("/admin/analytics/top-spenders", admin_headers),
        ("/admin/analytics/ai-impact", admin_headers),
    ]
    for path, hdr in endpoints:
        res = requests.get(f"{BASE_URL}{path}", headers=hdr)
        print_result(f"GET {path}", res)

    # 3. Admin Foods CRUD
    print("\n--- 3. Admin Foods Module ---")
    res = requests.get(f"{BASE_URL}/admin/foods", headers=admin_headers)
    print_result("GET /admin/foods", res)
    
    food_payload = {
        "name": "Verification Burger", "category": "Meals", "description": "Testing",
        "price": 99.99, "calories": 500, "protein": 20, "carbs": 30, "fat": 10, "sugar": 5, "sodium": 100,
        "dietary_type": "Non-Veg", "image_url": "🍔", "stock": 50, "reorder_level": 10, "available": True
    }
    create_res = requests.post(f"{BASE_URL}/admin/foods/", json=food_payload, headers=admin_headers)
    print_result("POST /admin/foods/", create_res, [201])
    
    if create_res.status_code == 201:
        food_id = create_res.json().get("id")
        
        upd_res = requests.put(f"{BASE_URL}/admin/foods/{food_id}", json={"price": 105.00}, headers=admin_headers)
        print_result(f"PUT /admin/foods/{food_id}", upd_res)
        
        avail_res = requests.patch(f"{BASE_URL}/admin/foods/{food_id}/availability", json={"available": False}, headers=admin_headers)
        print_result(f"PATCH /admin/foods/{food_id}/availability", avail_res)

        del_res = requests.delete(f"{BASE_URL}/admin/foods/{food_id}", headers=admin_headers)
        print_result(f"DELETE /admin/foods/{food_id}", del_res)


    # 4. Admin Inventory & Orders & Users
    print("\n--- 4. Admin Inventory, Orders, Users ---")
    res = requests.get(f"{BASE_URL}/admin/inventory/", headers=admin_headers)
    print_result("GET /admin/inventory/", res)
    if res.status_code == 200 and len(res.json().get("items", [])) > 0:
        inv_id = res.json()["items"][0]["id"]
        upd_inv = requests.put(f"{BASE_URL}/admin/inventory/{inv_id}", json={"current_stock": 150}, headers=admin_headers)
        print_result(f"PUT /admin/inventory/{inv_id}", upd_inv)

    res = requests.get(f"{BASE_URL}/admin/orders/", headers=admin_headers)
    print_result("GET /admin/orders/", res)

    res = requests.get(f"{BASE_URL}/admin/users/", headers=admin_headers)
    print_result("GET /admin/users/", res)
    if res.status_code == 200 and len(res.json().get("items", [])) > 0:
        target_user = next((u for u in res.json()["items"] if u["role"] == "USER"), None)
        if target_user:
            uid = target_user["id"]
            stat_res = requests.patch(f"{BASE_URL}/admin/users/{uid}/status", json={"disabled": 0}, headers=admin_headers)
            print_result(f"PATCH /admin/users/{uid}/status", stat_res)


    # 5. Admin AI & Audit & Export
    print("\n--- 5. Admin AI, Audit, Export ---")
    ai_endpoints = ["/admin/ai/status", "/admin/ai/features", "/admin/ai/accuracy-history", "/admin/ai/logs", "/admin/ai/training-history"]
    for path in ai_endpoints:
        res = requests.get(f"{BASE_URL}{path}", headers=admin_headers)
        print_result(f"GET {path}", res)
    
    retrain_res = requests.post(f"{BASE_URL}/admin/ai/retrain", headers=admin_headers)
    print_result("POST /admin/ai/retrain", retrain_res, [200, 202])

    audit_endpoints = ["/admin/audit/summary", "/admin/audit/admins", "/admin/audit/"]
    for path in audit_endpoints:
        res = requests.get(f"{BASE_URL}{path}", headers=admin_headers)
        print_result(f"GET {path}", res)

    export_endpoints = ["/admin/export/sales/preview", "/admin/export/sales"]
    for path in export_endpoints:
        res = requests.get(f"{BASE_URL}{path}", headers=admin_headers)
        print_result(f"GET {path}", res)


    # 6. User Flows
    print("\n--- 6. User Portal Flows ---")
    if user_headers:
        chk_res = requests.get(f"{BASE_URL}/health/check", headers=user_headers)
        print_result("GET /health/check", chk_res)
        
        # Make a health profile so intelligent menu doesn't fail
        hp_payload = {
            "age": 25, "gender": "male", "height_cm": 175, "weight_kg": 70, "activity_level": "Moderate",
            "dietary_preferences": ["None"], "allergies": [], "medical_conditions": []
        }
        hp_res = requests.post(f"{BASE_URL}/health/profile", json=hp_payload, headers=user_headers)
        print_result("POST /health/profile", hp_res)

        menu_res = requests.get(f"{BASE_URL}/menu/intelligent", headers=user_headers)
        print_result("GET /menu/intelligent", menu_res)
        
        if menu_res.status_code == 200 and len(menu_res.json()) > 0:
            food_item = menu_res.json()[0]
            order_payload = {"items": [food_item]}
            order_res = requests.post(f"{BASE_URL}/menu/order", json=order_payload, headers=user_headers)
            print_result("POST /menu/order", order_res)
            
        hist_res = requests.get(f"{BASE_URL}/menu/history", headers=user_headers)
        print_result("GET /menu/history", hist_res)
        
        chat_req = requests.post(f"{BASE_URL}/chatbot/query", json={"query": "What should I eat for lunch?"}, headers=user_headers)
        print_result("POST /chatbot/query", chat_req)

    print("\n====================================")
    print("  VERIFICATION COMPLETE")
    print("====================================\n")

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print("Test script failed:")
        print(traceback.format_exc())

