@echo off
title API Key Manager
cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

echo Starting API Key Manager...
node api-key-manager.js
pause
