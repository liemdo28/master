@echo off
chcp 65001 >nul 2>&1
title WhatsApp AI Gateway Launcher

echo.
echo ============================================
echo    WhatsApp AI Gateway Launcher v2.0
echo ============================================
echo.

:: Change to project directory
cd /d "%~dp0"

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install from https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js found: 
node -v
echo.

:: Clear old process on dashboard port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3210') do (
    if not "%%a"=="0" (
        echo [WARN] Stopping old gateway PID %%a on port 3210...
        taskkill /PID %%a /F >nul 2>&1
    )
)
timeout /t 2 /nobreak >nul
netstat -ano | findstr :3210 >nul 2>&1
if %errorlevel% equ 0 (
    echo [ERROR] Port 3210 is still in use. Start aborted.
    netstat -ano | findstr :3210
    echo.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] node_modules not found. Running npm install...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] npm install failed.
        echo.
        pause
        exit /b 1
    )
    echo.
)

:: Check if npm start works (just verify dependencies)
call npm run --silent 2>&1 | findstr /C:"missing" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Some dependencies may be missing. Running npm install...
    call npm install
)

echo [OK] Starting WhatsApp AI Gateway...
echo.
echo ============================================
echo    Dashboard will open at:
echo    http://localhost:3210
echo ============================================
echo.
echo Starting server...

:: Open browser
start http://localhost:3210

:: Run the app - keep window open
npm start

:: If we get here, app exited
echo.
echo [INFO] App stopped. Close this window or press any key to exit.
pause >nul
