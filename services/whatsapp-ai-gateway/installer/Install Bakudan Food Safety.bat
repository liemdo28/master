@echo off
echo Bakudan Food Safety -- Windows Installer
echo.
echo This installer requires Administrator privileges.
echo If UAC prompts you, click Yes.
echo.

:: Re-launch as admin if needed
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
  exit /b
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause
