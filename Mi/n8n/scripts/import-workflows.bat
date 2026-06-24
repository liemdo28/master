@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM Mi Automation Fabric — Import Workflows to n8n
REM Requires n8n to be healthy on :5678
REM Usage: import-workflows.bat [domain]
REM Example: import-workflows.bat seo
REM Without domain: imports ALL workflows from workflows/ directory
REM ─────────────────────────────────────────────────────────────────────────────

setlocal enabledelayedexpansion
set "BASE=E:\Project\Master\Mi\n8n"
set "N8N_URL=http://localhost:5678"
set "N8N_USER=mi-admin"
set "N8N_PASS=mi-n8n-secure-2025"
set "DOMAIN=%~1"
set "COUNT=0"

echo [Mi][Import] Checking n8n health...
curl -s -o nul -w "%%{http_code}" -u "%N8N_USER%:%N8N_PASS%" "%N8N_URL%/api/v1/workflows" 2>nul > "%BASE%\reports\_health.txt"
set /p HTTP_CODE=<"%BASE%\reports\_health.txt"
del "%BASE%\reports\_health.txt" 2>nul

if not "%HTTP_CODE%"=="200" (
    echo [Mi][Import] ERROR: n8n not responding (HTTP %HTTP_CODE%). Is n8n running on port 5678?
    echo [Mi][Import] Fix: pm2 restart mi-n8n ^&^& check-n8n-runtime.bat
    exit /B 1
)

if "%DOMAIN%"=="" (
    echo [Mi][Import] Importing ALL workflows...
    for /r "%BASE%\workflows" %%f in (*.json) do (
        echo [Mi][Import] Importing: %%~nxf
        curl -s -X POST -u "%N8N_USER%:%N8N_PASS%" -H "Content-Type: application/json" -d @"%%f" "%N8N_URL%/api/v1/workflows" >nul 2>&1
        set /a COUNT+=1
    )
) else (
    echo [Mi][Import] Importing workflows for domain: %DOMAIN%
    if exist "%BASE%\workflows\%DOMAIN%" (
        for %%f in ("%BASE%\workflows\%DOMAIN%\*.json") do (
            echo [Mi][Import] Importing: %%~nxf
            curl -s -X POST -u "%N8N_USER%:%N8N_PASS%" -H "Content-Type: application/json" -d @"%%f" "%N8N_URL%/api/v1/workflows" >nul 2>&1
            set /a COUNT+=1
        )
    ) else (
        echo [Mi][Import] ERROR: Domain folder not found: %BASE%\workflows\%DOMAIN%
        exit /B 1
    )
)

echo [Mi][Import] Done. Imported %COUNT% workflows.
endlocal
