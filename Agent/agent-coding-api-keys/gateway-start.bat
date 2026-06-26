@echo off
title Antigravity Gateway

:check
REM If gateway is already responding on port 3456, wait and re-check
curl -sf http://127.0.0.1:3456/health >nul 2>&1
if %errorlevel% == 0 (
  echo [%date% %time%] Gateway already running on :3456, monitoring...
  timeout /t 30 /nobreak >nul
  goto check
)

:restart
echo [%date% %time%] Starting Antigravity Gateway on port 3456...
cd /d "E:\Project\Master\Agent\agent-coding-api-keys"
node dist/server.js
echo [%date% %time%] Gateway stopped (exit: %errorlevel%). Restarting in 5s...
timeout /t 5 /nobreak >nul
goto check
