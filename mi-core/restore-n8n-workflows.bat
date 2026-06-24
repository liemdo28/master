@echo off
REM Phase 27F — Restore n8n workflows from backup
REM Usage: restore-n8n-workflows.bat [BACKUP_TIMESTAMP]
REM Example: restore-n8n-workflows.bat 2026-06-24T090000
REM If no argument, uses latest backup

setlocal

set N8N_KEY=
for /f "tokens=2 delims==" %%A in ('findstr "N8N_API_KEY" E:\Project\Master\mi-core\.env') do set N8N_KEY=%%A

set BACKUP_DIR=E:\Project\Master\mi-core\backups\n8n

if "%1"=="" (
  REM Use latest backup
  for /f "delims=" %%A in ('dir /b /ad /o-d "%BACKUP_DIR%" 2^>nul') do (
    set BACKUP_TS=%%A
    goto :resolve
  )
  echo [restore] ERROR: No backups found
  exit /b 1
) else (
  set BACKUP_TS=%1
)

:resolve
set BACKUP_PATH=%BACKUP_DIR%\%BACKUP_TS%
echo [restore] Restoring from: %BACKUP_PATH%

if not exist "%BACKUP_PATH%\workflows.json" (
  echo [restore] ERROR: workflows.json not found at %BACKUP_PATH%
  exit /b 1
)

REM MANUAL STEP: Workflows must be reimported via n8n UI
REM  1. Open http://localhost:5678
REM  2. Settings > Import workflow
REM  3. Select workflows.json
echo.
echo [restore] MANUAL STEP REQUIRED:
echo   n8n does not support workflow import via v1 API.
echo   To restore:
echo   1. Open http://localhost:5678
echo   2. Go to Workflows ^> Import from file
echo   3. Select: %BACKUP_PATH%\workflows.json
echo.
echo [restore] Backup manifest:
type "%BACKUP_PATH%\backup-manifest.json"
endlocal
