@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM Mi Automation Fabric — n8n Runtime Health Check
REM Usage: check-n8n-runtime.bat
REM ─────────────────────────────────────────────────────────────────────────────

echo ============================================
echo   Mi Automation Fabric — n8n Runtime Check
echo ============================================
echo.

echo [1] PM2 Status:
pm2 list 2>&1
echo.

echo [2] Port 5678:
netstat -ano | findstr ":5678" 2>&1
if errorlevel 1 echo   (no process listening on port 5678)
echo.

echo [3] n8n version:
n8n --version 2>&1
echo.

echo [4] n8n healthz:
curl -s -m 5 http://localhost:5678/healthz 2>&1
if errorlevel 1 echo   (n8n healthz not responding)
echo.

echo [5] Mi-Core contract endpoints:
echo   GET /api/mi/workflows/status
curl -s -m 5 http://localhost:4001/api/mi/workflows/status 2>&1
echo.
echo.

echo [6] Mi-Core automation dashboard:
echo   GET /api/mi/automation/dashboard
curl -s -m 5 http://localhost:4001/api/mi/automation/dashboard 2>&1
echo.
echo.

echo [7] PM2 n8n logs (last 20 lines):
pm2 logs mi-n8n --lines 20 --nostream 2>&1
echo.

echo ============================================
echo   Check complete.
echo ============================================
