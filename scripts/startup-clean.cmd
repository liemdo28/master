@echo off
REM Mi-Core Windows Startup Cleanup
REM Kills any rogue Node processes holding mi-core ports before PM2 resurrects.
REM Registered via Task Scheduler — runs at logon BEFORE pm2-windows-startup.

echo [%DATE% %TIME%] Mi-Core startup cleanup starting >> "%USERPROFILE%\AppData\Local\mi-core-startup.log"

REM Clear port 4001 (mi-core)
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr ":4001 " ^| findstr "LISTENING"') DO (
  echo [%DATE% %TIME%] Clearing port 4001 PID %%P >> "%USERPROFILE%\AppData\Local\mi-core-startup.log"
  taskkill /PID %%P /F >nul 2>&1
)

REM Clear port 3211 (whatsapp-ai-gateway)
FOR /F "tokens=5" %%P IN ('netstat -ano ^| findstr ":3211 " ^| findstr "LISTENING"') DO (
  echo [%DATE% %TIME%] Clearing port 3211 PID %%P >> "%USERPROFILE%\AppData\Local\mi-core-startup.log"
  taskkill /PID %%P /F >nul 2>&1
)

REM Wait 2s for ports to release
timeout /t 2 /nobreak >nul

echo [%DATE% %TIME%] Ports cleared — PM2 can now start cleanly >> "%USERPROFILE%\AppData\Local\mi-core-startup.log"
