@echo off
chcp 65001 >nul 2>&1
title Install WhatsApp AI Gateway

echo.
echo ============================================
echo   WhatsApp AI Gateway Windows Installer
echo ============================================
echo.
echo This installer will install the gateway to:
echo   %USERPROFILE%\Bakudan\whatsapp-ai-gateway
echo.
echo It will check Node.js, install dependencies,
echo create shortcuts, install auto-start, start
echo the gateway, and open the dashboard.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
set EXITCODE=%ERRORLEVEL%

echo.
if not "%EXITCODE%"=="0" (
  echo Installer stopped with an error.
  echo Please read the message above and run this file again after fixing it.
) else (
  echo Installer completed.
)
echo.
pause
exit /b %EXITCODE%
