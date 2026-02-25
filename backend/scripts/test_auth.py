import requests

BASE_URL = "http://localhost:8000/api"

try:
    print("Testing ADMIN login...")
    admin_login = requests.post(f"{BASE_URL}/auth/login", json={"email": "admin@canteen.local", "password": "Admin@123", "role": "ADMIN"}, timeout=5)
    print("Admin login status:", admin_login.status_code)
    
    if admin_login.status_code == 200:
        token = admin_login.json().get("token")
        print("\nTesting Admin Users API...")
        users_res = requests.get(f"{BASE_URL}/admin/users/", headers={"Authorization": f"Bearer {token}"}, timeout=5)
        print("Admin users list status:", users_res.status_code)

except Exception as e:
    print("Error:", e)
