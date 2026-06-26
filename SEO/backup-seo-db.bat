@echo off
echo ================================================
echo  SEO Database Backup
echo ================================================

set "BACKUP_DIR=%~dp0backups"
set "DB_FILE=%~dp0shared\database\seo-shared.db"
set TIMESTAMP=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

if exist "%DB_FILE%" (
    copy "%DB_FILE%" "%BACKUP_DIR%\seo-shared-%TIMESTAMP%.db" >nul 2>&1
    echo Backup created: %BACKUP_DIR%\seo-shared-%TIMESTAMP%.db
) else (
    echo WARNING: Database file not found at %DB_FILE%
)

echo.
echo Listing backups:
dir /b "%BACKUP_DIR%\seo-shared-*.db" 2>nul
echo.
echo ================================================
echo  Backup complete.
echo ================================================
