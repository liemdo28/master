@echo off
:: autostart-install.bat — Register Mi Ultimate to start at Windows logon
:: Run as Administrator for best results (or it will use current user)

setlocal
set TASK_NAME=Mi Ultimate
set BAT_PATH=%~dp0start.bat
set VBS_PATH=%~dp0start-silent.vbs

echo.
echo  Registering Mi Ultimate autostart...
echo  Task: "%TASK_NAME%"
echo  Script: %VBS_PATH%
echo.

:: Delete old task if exists
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

:: Create new task: run at logon, only when user is logged on, no password prompt
schtasks /create ^
  /tn "%TASK_NAME%" ^
  /tr "wscript.exe \"%VBS_PATH%\"" ^
  /sc ONLOGON ^
  /rl HIGHEST ^
  /f ^
  /delay 0000:30

if %errorlevel%==0 (
  echo.
  echo  [OK] Mi Ultimate will start automatically at next login.
  echo.
  echo  To remove autostart run:
  echo    schtasks /delete /tn "Mi Ultimate" /f
  echo.
) else (
  echo.
  echo  [WARN] Task Scheduler failed. Trying Startup folder fallback...

  :: Fallback: create shortcut in Startup folder
  set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
  copy "%VBS_PATH%" "%STARTUP%\Mi-Ultimate.vbs" >nul 2>&1

  if exist "%STARTUP%\Mi-Ultimate.vbs" (
    echo  [OK] Placed in Startup folder: %STARTUP%\Mi-Ultimate.vbs
  ) else (
    echo  [FAIL] Could not install autostart. Run as Administrator and retry.
  )
)

echo.
pause
