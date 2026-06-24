@echo off
REM Phase 27F — Verify latest n8n backup
set BACKUP_DIR=E:\Project\Master\mi-core\backups\n8n

REM Find most recent backup folder
for /f "delims=" %%A in ('dir /b /ad /o-d "%BACKUP_DIR%" 2^>nul') do (
  set LATEST=%%A
  goto :found
)
echo [verify] ERROR: No backup found in %BACKUP_DIR%
exit /b 1

:found
set BACKUP_PATH=%BACKUP_DIR%\%LATEST%
echo [verify] Checking backup: %BACKUP_PATH%

if exist "%BACKUP_PATH%\workflows.json" (
  echo [verify] workflows.json: EXISTS
  for %%F in ("%BACKUP_PATH%\workflows.json") do echo [verify] Size: %%~zF bytes
) else (
  echo [verify] ERROR: workflows.json MISSING
)

if exist "%BACKUP_PATH%\credentials-metadata.json" (
  echo [verify] credentials-metadata.json: EXISTS
) else (
  echo [verify] WARNING: credentials-metadata.json MISSING
)

if exist "%BACKUP_PATH%\backup-manifest.json" (
  echo [verify] backup-manifest.json: EXISTS
  type "%BACKUP_PATH%\backup-manifest.json"
) else (
  echo [verify] ERROR: backup-manifest.json MISSING
)

echo [verify] DONE
