@echo off
title Mi-Core Remote — Central Command
color 0A
cd /d D:\Project\Master\mi-core

echo.
echo  ========================================
echo   Mi-Core — REMOTE ACCESS MODE
echo  ========================================
echo.

:: Check for duplicate process
tasklist /FI "WINDOWTITLE eq Mi-Core Remote*" 2>NUL | find /I "cmd.exe" >NUL
if NOT ERRORLEVEL 1 (
  echo [Mi] Already running. Exiting duplicate instance.
  timeout /t 3
  exit /b
)

:: Start Ollama in background (if not already running)
tasklist | find /I "ollama.exe" >NUL 2>&1
if ERRORLEVEL 1 (
  echo [1/5] Starting Ollama...
  start /B "" ollama serve
  timeout /t 3 /nobreak > NUL
) else (
  echo [1/5] Ollama already running — OK
)

:: Start Python AI service
echo [2/5] Starting Python AI service (port 4002)...
if exist ai-service\main.py (
  start /B "" cmd /c "cd ai-service && python -m uvicorn main:app --host 127.0.0.1 --port 4002 >> ..\logs\ai-service.log 2>&1"
  timeout /t 2 /nobreak > NUL
) else (
  echo       [SKIP] ai-service\main.py not found
)

:: Start Agent Engine Bridge
echo [3/5] Starting Agent Engine Bridge (port 4003)...
if exist agent-engine\bridge.mjs (
  start /B "" cmd /c "cd agent-engine && node bridge.mjs >> ..\logs\agent-engine.log 2>&1"
  timeout /t 2 /nobreak > NUL
) else (
  echo       [SKIP] agent-engine\bridge.mjs not found
)

:: Ensure logs dir
if not exist logs mkdir logs

:: Start Mi-Core server — REMOTE MODE (0.0.0.0)
echo [4/5] Starting Mi-Core server on 0.0.0.0:4001...
set MOBILE_ACCESS=1
set HOST=0.0.0.0
set MI_PORT=4001
set GLOBAL_DIR=D:\Project\Master\.local-agent-global

cd server
start /B "" cmd /c "node dist\index.js >> ..\logs\mi-core.log 2>&1"
cd ..
timeout /t 4 /nobreak > NUL

:: Check port 4001
echo [5/5] Checking Mi-Core port 4001...
netstat -an | find "0.0.0.0:4001" | find "LISTENING" >NUL 2>&1
if ERRORLEVEL 1 (
  echo       [WARN] Port 4001 not yet listening — server may still be starting
) else (
  echo       [OK] Port 4001 is LISTENING
)

:: Print URLs
echo.
echo  ========================================
echo   Mi-Core is RUNNING — Remote Access ON
echo  ========================================
echo.
echo   Local:      http://127.0.0.1:4001
echo.

:: Get LAN IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4.*192\."') do (
  set LANIP=%%a
  goto :foundlan
)
:foundlan
if defined LANIP (
  set LANIP=%LANIP: =%
  echo   LAN:        http://%LANIP%:4001
  echo   Mobile:     http://%LANIP%:4001/mobile.html
)

:: Get Tailscale IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4.*100\."') do (
  set TSIP=%%a
  goto :foundts
)
:foundts
if defined TSIP (
  set TSIP=%TSIP: =%
  echo.
  echo   Tailscale:  http://%TSIP%:4001
  echo   TS Mobile:  http://%TSIP%:4001/mobile.html  ^<-- use this on iPhone
  echo.
  echo   ^[Tailscale preferred — safer than LAN^]
)

echo.
echo   LiveBoard:  http://127.0.0.1:4001/liveboard.html
echo   Health:     http://127.0.0.1:4001/api/remote/health
echo.
echo  ========================================
echo.

:: Open browser locally
start "" "http://127.0.0.1:4001/liveboard.html"

echo  Logs: D:\Project\Master\mi-core\logs\
echo  Press Ctrl+C to stop (or close this window)
echo.

:: Keep window open to show crash logs
:loop
timeout /t 60 /nobreak > NUL
goto loop
