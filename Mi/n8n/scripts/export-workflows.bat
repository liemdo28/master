@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM Mi Automation Fabric — Export Workflows from n8n
REM Requires n8n to be healthy on :5678
REM Usage: export-workflows.bat
REM Output: Mi/n8n/reports/n8n-exported-<timestamp>.json
REM ─────────────────────────────────────────────────────────────────────────────

setlocal
set "N8N_URL=http://localhost:5678"
set "N8N_USER=mi-admin"
set "N8N_PASS=mi-n8n-secure-2025"
set "OUTDIR=E:\Project\Master\Mi\n8n\reports"
set "TIMESTAMP=%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%%time:~3,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"

echo [Mi][Export] Checking n8n health...
curl -s -o nul -w "%%{http_code}" -u "%N8N_USER%:%N8N_PASS%" "%N8N_URL%/api/v1/workflows" 2>nul > "%OUTDIR%\_health.txt"
set /p HTTP_CODE=<"%OUTDIR%\_health.txt"
del "%OUTDIR%\_health.txt" 2>nul

if not "%HTTP_CODE%"=="200" (
    echo [Mi][Export] ERROR: n8n not responding (HTTP %HTTP_CODE%). Is n8n running on port 5678?
    echo [Mi][Export] Fix: pm2 restart mi-n8n ^&^& check-n8n-runtime.bat
    exit /B 1
)

echo [Mi][Export] Exporting workflows...
curl -s -u "%N8N_USER%:%N8N_PASS%" "%N8N_URL%/api/v1/workflows" > "%OUTDIR%\n8n-exported-%TIMESTAMP%.json"
echo [Mi][Export] Done. Output: reports/n8n-exported-%TIMESTAMP%.json
endlocal
