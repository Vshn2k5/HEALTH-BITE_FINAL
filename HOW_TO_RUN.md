# How to Run HealthBite Smart Canteen

Welcome! This system is composed of a FastAPI Python Backend and a pure HTML/JS Frontend that are served together. 

Before running the application for the first time, you just need to install the required Python libraries.

## 🛠️ First-Time Setup (Required)

1. Open a terminal or command prompt.
2. Navigate to the `backend` folder:
   ```cmd
   cd backend
   ```
3. Install the dependencies for the server:
   ```cmd
   pip install -r requirements.txt
   ```

---

## 🚀 Running the Application

There are three different ways to run the Smart Canteen depending on your preference.

### Method 1: The Quick Start Script (Easiest)
From the main project folder (`e:\smart canteen - Copy\smart canteen - Copy`), simply double-click the **`start_app.bat`** file.
- It will automatically launch the backend server in a hidden minimized window.
- It will automatically open your default web browser to the correct page: `http://localhost:8000`.

### Method 2: The Silent Starter
From the main project folder, double-click the **`start_silent.vbs`** file.
- It behaves just like Method 1, except it hides the command prompt window entirely so your screen stays clean.

### Method 3: Manual Terminal Command
If you are a developer and want to see the live server logs:
1. Open a terminal and navigate to the `backend` folder.
2. Run the server using Python:
   ```cmd
   python app.py
   ```
3. Once you see `Uvicorn running on http://0.0.0.0:8000` in the terminal, open your web browser and go to: **[http://localhost:8000](http://localhost:8000)**

---

## 🔑 Default Accounts

If you need to log in to test the application, here are the default accounts created by the system:

### Admin Account (For the Dashboard)
- **Email:** `admin@canteen.local`
- **Password:** `Admin@123` *(Case Sensitive! Note the capital 'A')*
- **Role:** Select **Admin** on the login tab.

### User Account (For the Dashboard)
- **Email:** `user@canteen.local`
- **Password:** `User@123`
- **Role:** Select **User** on the login tab.

### Standard User Account (For the Shopping Menu)
- **Email:** You can register a new account directly from the frontend page, or log in with any test user you previously created!
