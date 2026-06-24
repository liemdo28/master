@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM Mi Automation Fabric — Backup Script
REM Backs up workflows, config, logs, reports, data (contract logs), credentials metadata
REM Usage: backup-n8n.bat
REM Output: Mi/n8n/backups/<YYYY-MM-DD_HHMMSS>/
REM ─────────────────────────────────────────────────────────────────────────────

setlocal enabledelayedexpansion

set "BASE=E:\Project\Master\Mi\n8n"
set "TIMESTAMP=%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "BACKUP=%BASE%\backups\%TIMESTAMP%"

echo [Mi][Backup] Starting backup to %BACKUP%
mkdir "%BACKUP%" 2>nul

REM 1. Workflows
echo [Mi][Backup] Copying workflows...
mkdir "%BACKUP%\workflows" 2>nul
xcopy /E /I /Q "%BASE%\workflows\*" "%BACKUP%\workflows\" >nul 2>&1

REM 2. Config
echo [Mi][Backup] Copying config...
mkdir "%BACKUP%\config" 2>nul
xcopy /E /I /Q "%BASE%\config\*" "%BACKUP%\config\" >nul 2>&1

REM 3. Data (contract logs — .jsonl files)
echo [Mi][Backup] Copying data...
mkdir "%BACKUP%\data" 2>nul
xcopy /E /I /Q "%BASE%\data\*" "%BACKUP%\data\" >nul 2>&1

REM 4. Reports
echo [Mi][Backup] Copying reports...
mkdir "%BACKUP%\reports" 2>nul
xcopy /E /I /Q "%BASE%\reports\*" "%BACKUP%\reports\" >nul 2>&1

REM 5. Credentials (metadata only — NO secrets)
echo [Mi][Backup] Copying credentials metadata...
mkdir "%BACKUP%\credentials" 2>nul
copy "%BASE%\credentials\*.md" "%BACKUP%\credentials\" >nul 2>&1
copy "%BASE%\credentials\*.json" "%BACKUP%\credentials\" >nul 2>&1

REM 6. PM2 logs (last 1000 lines)
echo [Mi][Backup] Capturing PM2 logs...
mkdir "%BACKUP%\logs" 2>nul
pm2 logs mi-n8n --lines 1000 --nostream --raw > "%BACKUP%\logs\n8n-pm2.log" 2>&1

REM 7. Mi-Core contract logs (if accessible)
if exist "E:\Project\Master\mi-core\.local-agent-global\logs\n8n-out.log" (
    copy "E:\Project\Master\mi-core\.local-agent-global\logs\n8n-out.log" "%BACKUP%\logs\mi-core-n8n-out.log" >nul 2>&1
    copy "E:\Project\Master\mi-core\.local-agent-global\logs\n8n-error.log" "%BACKUP%\logs\mi-core-n8n-error.log" >nul 2>&1
)

REM 8. Backup manifest
echo { > "%BACKUP%\manifest.json"
echo   "backup_timestamp": "%TIMESTAMP%", >> "%BACKUP%\manifest.json"
echo   "workflow_count": 0, >> "%BACKUP%\manifest.json"
echo   "source": "mi-n8n-backup" >> "%BACKUP%\manifest.json"
echo } >> "%BACKUP%\manifest.json"

REM Count workflows
set "COUNT=0"
for %%f in ("%BASE%\workflows\*.json") do set /a COUNT+=1
for /r "%BASE%\workflows" %%f in (*.json) do set /a COUNT+=1
echo [Mi][Backup] Backup complete. Workflows: %COUNT%

REM Clean up backups older than 30 days
echo [Mi][Backup] Cleaning backups older than 30 days...
forfiles /p "%BASE%\backups" /d -30 /c "cmd /c if @isdir==TRUE rmdir /s /q @path" >nul 2>&1

echo [Mi][Backup] Done. Location: %BACKUP%
endlocal
