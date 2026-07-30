@echo off
title Agent OS - Startup
cd /d E:\Project\Master\agent-os

:: Start Control Plane
start "Agent OS Control" /min cmd /c "cd agent-control && node_modules\.bin\ts-node --transpile-only src\server.ts"

:: Wait 3 seconds for server to be up
timeout /t 3 /nobreak >nul

:: Resurrect pm2 worker processes
pm2 resurrect

echo Agent OS started.
