@echo off
title Smart Canteen Server
echo ====================================================
echo      HEALTHBITE - SMART CANTEEN SYSTEM
echo ====================================================
echo.
echo [1/2] Starting Backend Server...
cd /d "%~dp0"
:: Start the backend in a new minimized window so it stays running
start /min cmd /k "cd backend && python app.py"

echo Backend is launching in the background...
echo.
echo [2/2] Opening Application...
:: Wait a few seconds for backend to initialize
timeout /t 3 >nul
start "" "http://localhost:8000"

echo.
echo ====================================================
echo      SYSTEM IS RUNNING!
echo      You can close this window, but do NOT close
echo      the minimized backend window.
echo ====================================================
pause
