@echo off
cd /d "%~dp0.."
echo Starting HealthBite Smart Canteen Backend... >> backend.log
echo Date: %DATE% %TIME% >> backend.log

:: Try uvicorn first (preferred), fall back to python app.py
where uvicorn >nul 2>&1
if %ERRORLEVEL% == 0 (
    uvicorn app:app --host 0.0.0.0 --port 8000 >> backend.log 2>&1
) else (
    python -m uvicorn app:app --host 0.0.0.0 --port 8000 >> backend.log 2>&1
)
