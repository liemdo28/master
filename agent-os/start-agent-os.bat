@echo off
title Agent OS - Startup
cd /d E:\Project\Master\agent-os

:: Start Control Plane (agent-os server)
start "Agent OS Control" /min cmd /c "cd /d E:\Project\Master\agent-os\agent-control && node_modules\.bin\ts-node --transpile-only src\server.ts"

:: Wait for server
timeout /t 3 /nobreak >nul

:: Resurrect pm2 processes (antigravity-gateway + agent-worker)
pm2 resurrect

echo Agent OS started.
echo   Control Plane : http://localhost:3700
echo   Chat UI       : http://localhost:3700/chat.html
echo   Gateway       : http://localhost:3456
echo   Admin Keys    : http://localhost:3456/admin/keys
