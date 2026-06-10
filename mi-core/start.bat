@echo off
title Mi Ultimate — Startup
color 0A

echo.
echo  ███╗   ███╗██╗
echo  ████╗ ████║██║
echo  ██╔████╔██║██║
echo  ██║╚██╔╝██║██║
echo  ██║ ╚═╝ ██║██║
echo  ╚═╝     ╚═╝╚═╝  Executive Assistant
echo.

:: --- Python AI Service ---
echo [1/3] Starting Python AI Service (port 4002)...
start "Mi AI Service" cmd /c "cd /d %~dp0ai-service && python -m uvicorn main:app --host 0.0.0.0 --port 4002 --reload 2>&1 | tee ../logs/ai-service.log"

timeout /t 2 /nobreak >nul

:: --- Agent Engine Bridge ---
echo [2/4] Starting Agent Engine Bridge (port 4003)...
start "Mi Agent Engine" cmd /c "cd /d %~dp0 && node agent-engine/bridge.mjs 2>&1 | tee logs/agent-engine.log"

timeout /t 2 /nobreak >nul

:: --- Node Server (Remote Access ON) ---
echo [3/4] Starting Mi Server (port 4001, remote enabled)...
cd /d %~dp0server
if not exist node_modules (
  echo Installing Node dependencies...
  call npm install
)
start "Mi Server" cmd /c "cd /d %~dp0server && set MOBILE_ACCESS=1 && set HOST=0.0.0.0 && npm run dev 2>&1 | tee ../logs/server.log"

timeout /t 3 /nobreak >nul

:: --- Get Tailscale IP ---
echo [4/4] Detecting network...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "tailscale"') do (
  set TAILSCALE_IP=%%a
)
for /f "tokens=1" %%a in ("%TAILSCALE_IP%") do set TAILSCALE_IP=%%a

echo.
echo ============================================================
echo  Mi is ONLINE
echo ============================================================
echo.
echo  PC Access:
echo    Desktop Chat : http://localhost:4001
echo    Mobile UI    : http://localhost:4001/mobile.html
echo    Approval Gate: http://localhost:4001/approval.html
echo    API Health   : http://localhost:4001/api/health
echo.
if defined TAILSCALE_IP (
echo  Mobile Access (Tailscale):
echo    Chat   : http://%TAILSCALE_IP%:4001
echo    Mobile : http://%TAILSCALE_IP%:4001/mobile.html
echo.
)
echo  AI Service   : http://localhost:4002
echo  Agent Engine : http://localhost:4003
echo  Ollama Models: http://localhost:11434
echo.
echo  Logs: mi-core/logs/
echo ============================================================
echo.

:: Open UI
start http://localhost:4001

pause
