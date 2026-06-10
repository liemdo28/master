@echo off
:: autostart-remove.bat — Remove Mi Ultimate from Windows autostart

set TASK_NAME=Mi Ultimate
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

echo Removing Mi Ultimate autostart...

schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1 && echo [OK] Task Scheduler entry removed.
del /f /q "%STARTUP%\Mi-Ultimate.vbs" >nul 2>&1 && echo [OK] Startup folder entry removed.

echo Done.
pause
