@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM Mi Automation Fabric — Start n8n via PM2
REM Usage: start-n8n.bat
REM ─────────────────────────────────────────────────────────────────────────────

echo [Mi] Starting mi-n8n via PM2...
pm2 start mi-n8n 2>&1
echo [Mi] Waiting 5 seconds for n8n to bind port...
timeout /t 5 /nobreak >nul
echo [Mi] Checking port 5678...
netstat -ano | findstr ":5678" 2>&1
if errorlevel 1 (
    echo [Mi] WARNING: Port 5678 not yet bound. n8n may still be starting.
    echo [Mi] Check again with: check-n8n-runtime.bat
) else (
    echo [Mi] n8n appears to be running on port 5678.
)
