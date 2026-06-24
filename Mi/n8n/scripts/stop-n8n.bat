@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM Mi Automation Fabric — Stop n8n via PM2
REM Usage: stop-n8n.bat
REM ─────────────────────────────────────────────────────────────────────────────

echo [Mi] Stopping mi-n8n via PM2...
pm2 stop mi-n8n 2>&1
echo [Mi] n8n stopped.
echo [Mi] To start again: start-n8n.bat
