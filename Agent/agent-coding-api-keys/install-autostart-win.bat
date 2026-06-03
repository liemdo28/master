@echo off
title Install AI Proxy Auto-start
cd /d "%~dp0"

set PROXY_PATH=%~dp0proxy.js

REM Find node path
for /f "tokens=*" %%i in ('where node 2^>nul') do set NODE_PATH=%%i

if "%NODE_PATH%"=="" (
    echo Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

REM Create Task Scheduler task — runs at login, restarts if fails
schtasks /delete /tn "AI-Proxy" /f >nul 2>&1
schtasks /create /tn "AI-Proxy" ^
  /tr "\"%NODE_PATH%\" \"%PROXY_PATH%\"" ^
  /sc onlogon ^
  /ru "%USERNAME%" ^
  /rl limited ^
  /f

if %errorlevel% equ 0 (
    echo.
    echo AI Proxy se tu khoi dong khi dang nhap Windows
    echo.
    echo Quan ly:
    echo   Tat : schtasks /end /tn "AI-Proxy"
    echo   Bat : schtasks /run /tn "AI-Proxy"
    echo   Xoa : schtasks /delete /tn "AI-Proxy" /f
) else (
    echo Loi khi tao task. Thu chay PowerShell as Admin.
)
pause
