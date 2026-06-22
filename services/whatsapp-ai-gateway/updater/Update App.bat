@echo off
echo Bakudan Food Safety -- Update App
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0bakudan-updater.ps1" update
pause
