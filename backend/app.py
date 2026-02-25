"""
HealthBite Smart Canteen - Main Application Entry Point
========================================================
FastAPI backend server that powers the Smart Canteen system.
Serves both the API endpoints and the frontend static files.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import engine, Base
import models  # MUST import models before create_all so all tables are registered
import os

# Create all database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI application
app = FastAPI(
    title="HealthBite Smart Canteen",
    description="AI-Powered Health-Aware Canteen System",
    version="2.0.0"
)

# CORS Middleware - Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Import and Register Routers ---
from auth import router as auth_router
import health
import menu
from chatbot import router as chatbot_router
from analytics import router as analytics_router
from routes import (
    admin_dashboard,
    admin_foods,
    admin_inventory,
    admin_orders,
    admin_users,
    admin_analytics_routes,
    admin_ai,
    admin_reports,
    admin_audit,
)

app.include_router(auth_router)
app.include_router(health.router)
app.include_router(menu.router)
app.include_router(chatbot_router)
app.include_router(analytics_router)

# Admin routes
app.include_router(admin_dashboard.router)
app.include_router(admin_foods.router)
app.include_router(admin_inventory.router)
app.include_router(admin_orders.router)
app.include_router(admin_users.router)
app.include_router(admin_analytics_routes.router)
app.include_router(admin_ai.router)
app.include_router(admin_reports.router)
app.include_router(admin_audit.router)

# Print all registered routes for debugging
print("\n--- REGISTERED ROUTES ---")
for route in app.routes:
    if hasattr(route, "path"):
        print(f"{route.path} [{', '.join(route.methods) if hasattr(route, 'methods') else 'N/A'}]")
print("------------------------\n")

# --- Serve Frontend Static Files ---
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")

# Mount static files (CSS, JS, images, etc.)
app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")


@app.get("/")
async def serve_index():
    """Serve the main login/landing page"""
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/{filename}.html")
async def serve_html(filename: str):
    """Serve any HTML page from the frontend directory"""
    filepath = os.path.join(FRONTEND_DIR, f"{filename}.html")
    if os.path.exists(filepath):
        return FileResponse(filepath)
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/{filename}.css")
async def serve_css(filename: str):
    """Serve CSS files"""
    filepath = os.path.join(FRONTEND_DIR, f"{filename}.css")
    if os.path.exists(filepath):
        return FileResponse(filepath, media_type="text/css")


@app.get("/{filename}.js")
async def serve_js(filename: str):
    """Serve JavaScript files"""
    filepath = os.path.join(FRONTEND_DIR, f"{filename}.js")
    if os.path.exists(filepath):
        return FileResponse(filepath, media_type="application/javascript")


@app.get("/images/{filename}")
async def serve_image(filename: str):
    """Serve image files"""
    filepath = os.path.join(FRONTEND_DIR, "images", filename)
    if os.path.exists(filepath):
        return FileResponse(filepath)


@app.get("/{full_path:path}")
async def serve_nested(full_path: str):
    """Catch-all: serve any file from the frontend directory (supports nested paths)"""
    filepath = os.path.join(FRONTEND_DIR, full_path)
    if os.path.exists(filepath) and os.path.isfile(filepath):
        # Determine media type
        if filepath.endswith(".css"):
            return FileResponse(filepath, media_type="text/css")
        elif filepath.endswith(".js"):
            return FileResponse(filepath, media_type="application/javascript")
        elif filepath.endswith(".html"):
            return FileResponse(filepath, media_type="text/html")
        return FileResponse(filepath)
    # Fallback to index
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


# --- Start Server ---
if __name__ == "__main__":
    import uvicorn
    print("=" * 50)
    print("  HEALTHBITE SMART CANTEEN SERVER")
    print("  Starting on http://0.0.0.0:8000")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)
