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

:: --- Big Data Infra (Docker) ---
echo [0/4] Starting Big Data infra (PostgreSQL + MinIO + Qdrant)...
docker info >nul 2>&1
if %errorlevel%==0 (
  cd /d %~dp0infra\bigdata
  docker-compose up -d >nul 2>&1
  echo [0/4] Big Data infra started
  cd /d %~dp0
) else (
  echo [0/4] Docker not ready — skipping Big Data infra
)

:: --- Start all services via PM2 ---
echo [1/4] Starting all services via PM2 ecosystem...
cd /d %~dp0
pm2 start ecosystem.config.js 2>nul
pm2 save 2>nul

timeout /t 5 /nobreak >nul

echo [2/4] Verifying processes...
pm2 list

timeout /t 2 /nobreak >nul

:: --- Get Tailscale IP ---
echo [3/4] Detecting network...
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
