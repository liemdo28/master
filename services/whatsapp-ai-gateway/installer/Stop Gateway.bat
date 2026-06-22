@echo off
chcp 65001 >nul 2>&1
title Bakudan Food Safety — Stop

:: Stop scheduled task (prevents auto-restart)
schtasks /End /TN "BakudanFoodSafety" >nul 2>&1

:: Kill watchdog
taskkill /F /FI "WINDOWTITLE eq Bakudan*" >nul 2>&1

:: Kill node processes running from app folder
powershell.exe -NoProfile -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*BakudanFoodSafety*' -or $_.CommandLine -like '*src/index.js*' } | ForEach-Object { $_.Kill() }" >nul 2>&1

echo App stopped.
echo To restart: double-click "Start Gateway"
pause
