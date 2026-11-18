@echo off
title SpyderXDR - Sysmon Installation
cd /d "C:\Users\Vishaal\Desktop\SpyderXDR-updated"

echo ========================================
echo   SpyderXDR Sysmon Installation
echo ========================================
echo.

echo Step 1: Stopping Sysmon service...
net stop Sysmon64 2>nul
sc stop Sysmon64 2>nul
timeout /t 3 /nobreak >nul
echo   Done
echo.

echo Step 2: Uninstalling old Sysmon...
C:\Windows\Sysmon64.exe -u -AcceptEula
timeout /t 3 /nobreak >nul
echo   Done
echo.

echo Step 3: Installing Sysmon with config...
C:\Windows\Sysmon64.exe -i sysmon-config.xml -AcceptEula
timeout /t 5 /nobreak >nul
echo   Done
echo.

echo Step 4: Verification
echo.
sc query Sysmon64 | find "RUNNING" >nul
if %errorlevel% equ 0 (
    echo [PASS] Sysmon64 service is RUNNING
) else (
    echo [FAIL] Sysmon64 service is NOT running
)

sc query SysmonDrv 2>nul | find "RUNNING" >nul
if %errorlevel% equ 0 (
    echo [PASS] Sysmon kernel driver is RUNNING
) else (
    echo [FAIL] Sysmon kernel driver is NOT loaded
)

echo.
echo Step 5: Checking for real Sysmon events...
wevtutil qe "Microsoft-Windows-Sysmon/Operational" /c:5 /rd:true /f:text 2>nul | findstr /i "EventID" | findstr /v "16384 16394"
if %errorlevel% equ 0 (
    echo [PASS] Real Sysmon security events detected!
) else (
    echo [INFO] No real Sysmon events yet - wait a moment and check again
)

echo.
echo ========================================
echo   Installation complete!
echo   You can close this window.
echo ========================================
pause
