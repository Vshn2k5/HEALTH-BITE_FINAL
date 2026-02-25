@echo off
echo Requesting Admin Privileges to update Firewall...
:: Check for admin rights and restart if needed
net session >nul 2>&1
if %errorLevel% == 0 (
    goto :admin
) else (
    echo.
    echo Please grant Administrator permissions to allow remote access.
    powershell -Command "Start-Process '%~0' -Verb RunAs"
    exit /b
)

:admin
echo.
echo ====================================================
echo      ENABLING REMOTE ACCESS (PHONE SUPPORT)
echo ====================================================
echo.
echo [1/2] Adding Firewall Rule for Port 8000...
netsh advfirewall firewall delete rule name="HealthBite Web Server" >nul 2>&1
netsh advfirewall firewall add rule name="HealthBite Web Server" dir=in action=allow protocol=TCP localport=8000
echo Match Rule Added.
echo.

echo [2/2] Retrieving your Local IP Address...
echo.
echo Connect your phone to the SAME Wifi network and open:
echo.
echo ----------------------------------------------------
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    echo      http://%%a:8000
)
echo.
echo ----------------------------------------------------
echo.
echo Press any key to start the server...
pause >nul

call start_app.bat
