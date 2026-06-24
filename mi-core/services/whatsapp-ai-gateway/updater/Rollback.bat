@echo off
echo Bakudan Food Safety -- Rollback Last Update
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0bakudan-updater.ps1" rollback latest
pause
