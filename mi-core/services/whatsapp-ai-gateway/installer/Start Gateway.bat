@echo off
chcp 65001 >nul 2>&1
title Bakudan Food Safety — Start
set "APP_DIR=C:\Program Files\BakudanFoodSafety\app"
set "WATCHDOG=%APP_DIR%\scripts\watchdog.ps1"

:: Check if already running
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if %ERRORLEVEL%==0 (
  echo App is already running.
  start "" "http://localhost:3210"
  goto :end
)

if exist "%WATCHDOG%" (
  powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%WATCHDOG%"
) else (
  schtasks /Run /TN "BakudanFoodSafety" >nul 2>&1
  if %ERRORLEVEL% NEQ 0 (
    echo Could not start via Scheduled Task. Starting directly...
    powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "Set-Location '%APP_DIR%'; & '%APP_DIR%\runtime\node\node.exe' 'src/index.js'"
  )
)

timeout /t 5 /nobreak >nul
start "" "http://localhost:3210"

:end
echo Done.
