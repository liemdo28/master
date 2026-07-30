@echo off
chcp 65001 >nul 2>&1
title WhatsApp AI Gateway Status
set "INSTALL_DIR=%USERPROFILE%\Bakudan\whatsapp-ai-gateway"
if not exist "%INSTALL_DIR%\scripts\windows\status-gateway.ps1" (
  echo WhatsApp AI Gateway is not installed at:
  echo   %INSTALL_DIR%
  echo.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%INSTALL_DIR%\scripts\windows\status-gateway.ps1"
pause
