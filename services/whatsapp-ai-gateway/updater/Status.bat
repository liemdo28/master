@echo off
echo Bakudan Food Safety -- Status
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0bakudan-updater.ps1" status
pause
