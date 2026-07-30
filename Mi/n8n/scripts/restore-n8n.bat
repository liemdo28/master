@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM Mi Automation Fabric — Restore Script
REM Restores workflows, config from a backup folder
REM Usage: restore-n8n.bat <backup-folder-name>
REM Example: restore-n8n.bat 2026-06-24_084500
REM ─────────────────────────────────────────────────────────────────────────────

setlocal enabledelayedexpansion

set "BASE=E:\Project\Master\Mi\n8n"
set "BACKUP=%BASE%\backups\%1"

if "%~1"=="" (
    echo [Mi][Restore] ERROR: No backup folder name provided.
    echo Usage: restore-n8n.bat ^<backup-folder-name^>
    echo Available backups:
    dir /B "%BASE%\backups" 2>nul
    exit /B 1
)

if not exist "%BACKUP%" (
    echo [Mi][Restore] ERROR: Backup folder not found: %BACKUP%
    exit /B 1
)

echo [Mi][Restore] Restoring from: %BACKUP%
echo [Mi][Restore] WARNING: This will overwrite current workflows and config.
echo [Mi][Restore] Press Ctrl+C to abort, or any key to continue...
pause

REM 1. Restore workflows
if exist "%BACKUP%\workflows" (
    echo [Mi][Restore] Restoring workflows...
    xcopy /E /I /Y "%BACKUP%\workflows\*" "%BASE%\workflows\" >nul 2>&1
)

REM 2. Restore config
if exist "%BACKUP%\config" (
    echo [Mi][Restore] Restoring config...
    xcopy /E /I /Y "%BACKUP%\config\*" "%BASE%\config\" >nul 2>&1
)

REM 3. Restore data (contract logs — append, don't overwrite)
if exist "%BACKUP%\data" (
    echo [Mi][Restore] Restoring data (append)...
    copy "%BACKUP%\data\*.jsonl" "%BASE%\data\" >nul 2>&1
)

REM 4. Restore reports
if exist "%BACKUP%\reports" (
    echo [Mi][Restore] Restoring reports...
    xcopy /E /I /Y "%BACKUP%\reports\*" "%BASE%\reports\" >nul 2>&1
)

REM 5. Restore credentials metadata
if exist "%BACKUP%\credentials" (
    echo [Mi][Restore] Restoring credentials metadata...
    copy "%BACKUP%\credentials\*.md" "%BASE%\credentials\" >nul 2>&1
    copy "%BACKUP%\credentials\*.json" "%BASE%\credentials\" >nul 2>&1
)

REM 6. Restart n8n
echo [Mi][Restore] Restarting mi-n8n...
pm2 restart mi-n8n >nul 2>&1

echo [Mi][Restore] Restore complete. Verify with: check-n8n-runtime.bat
endlocal
