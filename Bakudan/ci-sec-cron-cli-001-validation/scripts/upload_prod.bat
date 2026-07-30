@echo off
REM ============================================================
REM Upload changed files to production via WinSCP or lftp
REM ============================================================
REM INSTRUCTIONS:
REM 1. Fill in SFTP_HOST, SFTP_USER, SFTP_PASS below
REM 2. Install WinSCP from https://winscp.net or use lftp
REM ============================================================

set SFTP_HOST=dashboard.bakudanramen.com
set SFTP_USER=liemdo0208
set SFTP_PASS=YOUR_PASSWORD_HERE
set REMOTE_PATH=/home/liemdo0208/dashboard.bakudanramen.com

setlocal enabledelayedexpansion

echo ================================================
echo Uploading 3 changed files to production...
echo ================================================

set "LOCAL_ROOT=d:\Project\Master\Bakudan\dashboard.bakudanramen.com"
set "FILES=models\Penalty.php;controllers\DashboardController.php;views\dashboard\overview.php"

for %%F in (%FILES%) do (
    set "FILE=%%F"
    set "LOCAL_PATH=!LOCAL_ROOT!\%%F"
    set "REMOTE_FILE=!REMOTE_PATH!\%%F"
    
    echo.
    echo Uploading: %%F
    echo   Local:  !LOCAL_PATH!
    echo   Remote: !REMOTE_FILE!
    
    if exist "!LOCAL_PATH!" (
        echo   Size: %%~zF bytes - OK
    ) else (
        echo   ERROR: File not found!
    )
)

echo.
echo ================================================
echo FILES READY FOR UPLOAD
echo ================================================
echo.
echo To upload using WinSCP command line:
echo   open sftp://%SFTP_USER%:%SFTP_PASS%@%SFTP_HOST%/
echo   cd %REMOTE_PATH%
echo   put "!LOCAL_ROOT!\models\Penalty.php" models/Penalty.php
echo   put "!LOCAL_ROOT!\controllers\DashboardController.php" controllers/DashboardController.php
echo   put "!LOCAL_ROOT!\views\dashboard\overview.php" views/dashboard/overview.php
echo   exit
echo.
echo Download WinSCP: https://winscp.net/eng/downloads.php
echo.
pause
