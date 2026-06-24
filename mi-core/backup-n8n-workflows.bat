@echo off
REM Phase 27F — n8n Workflow Backup
REM Exports all workflows and execution metadata (no secrets)
REM Usage: backup-n8n-workflows.bat

setlocal

set N8N_KEY=
for /f "tokens=2 delims==" %%A in ('findstr "N8N_API_KEY" E:\Project\Master\mi-core\.env') do set N8N_KEY=%%A

set BACKUP_DIR=E:\Project\Master\mi-core\backups\n8n
set TIMESTAMP=%date:~10,4%-%date:~4,2%-%date:~7,2%T%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set OUTDIR=%BACKUP_DIR%\%TIMESTAMP%

echo [n8n-backup] Creating backup at %OUTDIR%
if not exist "%OUTDIR%" mkdir "%OUTDIR%"

REM Export all workflows
curl -s -H "X-N8N-API-KEY: %N8N_KEY%" ^
  "http://localhost:5678/api/v1/workflows?limit=100" ^
  -o "%OUTDIR%\workflows.json"

REM Export credential metadata (names and types only — no secrets)
curl -s -H "X-N8N-API-KEY: %N8N_KEY%" ^
  "http://localhost:5678/api/v1/credentials" ^
  -o "%OUTDIR%\credentials-metadata.json"

REM Write manifest
echo { > "%OUTDIR%\backup-manifest.json"
echo   "backup_time": "%TIMESTAMP%", >> "%OUTDIR%\backup-manifest.json"
echo   "n8n_url": "http://localhost:5678", >> "%OUTDIR%\backup-manifest.json"
echo   "files": ["workflows.json", "credentials-metadata.json"], >> "%OUTDIR%\backup-manifest.json"
echo   "note": "credentials-metadata.json contains names and types only — no secrets" >> "%OUTDIR%\backup-manifest.json"
echo } >> "%OUTDIR%\backup-manifest.json"

echo [n8n-backup] Done. Files in %OUTDIR%
dir "%OUTDIR%"
endlocal
