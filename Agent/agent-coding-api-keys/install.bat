@echo off
setlocal enabledelayedexpansion
title Antigravity Gateway — Installer
color 0A

echo.
echo  ============================================================
echo   Antigravity Universal AI Gateway — One-Click Installer
echo  ============================================================
echo.

set "INSTALL_DIR=%~dp0"
set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"
cd /d "%INSTALL_DIR%"
echo  [1/6] Thu muc: %INSTALL_DIR%

:: ── Kiem tra Node.js ─────────────────────────────────────────────────────────
echo  [2/6] Kiem tra Node.js ...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [LOI] Node.js chua duoc cai dat!
    echo  Vui long tai va cai Node.js 20+ tu: https://nodejs.org
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo         Node.js %NODE_VER% - OK

for /f "tokens=1 delims=." %%m in ("%NODE_VER:v=%") do set NODE_MAJOR=%%m
if %NODE_MAJOR% LSS 20 (
    echo  [LOI] Can Node.js 20 tro len, hien tai %NODE_VER%
    pause
    exit /b 1
)

:: ── Cai dat thu vien ─────────────────────────────────────────────────────────
echo  [3/6] npm install ...
call npm install --prefer-offline
if errorlevel 1 (
    echo  [LOI] npm install that bai!
    pause
    exit /b 1
)
echo         Dependencies da san sang.

:: ── Build TypeScript ─────────────────────────────────────────────────────────
echo  [4/6] Build TypeScript ...
call npm run build
if errorlevel 1 (
    echo  [LOI] Build that bai!
    pause
    exit /b 1
)
echo         Build thanh cong.

:: ── Tao thu muc logs (data/ da co san trong package) ─────────────────────────
if not exist "logs" mkdir logs

:: ── KHONG ghi de neu keys.json da ton tai ────────────────────────────────────
if exist "keys.json" (
    echo         keys.json da ton tai - giu nguyen, khong ghi de.
) else (
    echo  [!] Khong tim thay keys.json.
    echo      Them keys.json vao thu muc nay truoc khi chay gateway.
    pause
)

:: ── KHONG ghi de .env.gateway neu da ton tai ─────────────────────────────────
if not exist ".env.gateway" (
    if exist ".env.example" copy ".env.example" ".env.gateway" >nul
)

:: ── Cai PM2 va khoi dong ─────────────────────────────────────────────────────
echo  [5/6] Cai dat PM2 ...
call npm list -g pm2 >nul 2>&1
if errorlevel 1 (
    call npm install -g pm2
)
echo         PM2 da san sang.

echo  [6/6] Khoi dong Gateway ...

:: Dung process cu neu dang chay
call pm2 stop antigravity-gateway >nul 2>&1
call pm2 delete antigravity-gateway >nul 2>&1

call pm2 start ecosystem.config.js
if errorlevel 1 goto :direct_start

call pm2 save

:: Auto-start khi Windows boot
schtasks /query /tn "AntigravityGateway" >nul 2>&1
if errorlevel 1 (
    schtasks /create /tn "AntigravityGateway" /tr "\"cmd\" /c \"cd /d \"%INSTALL_DIR%\" && pm2 resurrect\"" /sc ONLOGON /ru "%USERNAME%" /delay 0000:30 /f >nul 2>&1
    echo         Auto-start da duoc thiet lap.
)

goto :done

:direct_start
start "Antigravity Gateway" /min cmd /c "node dist/server.js >> logs/gateway.log 2>&1"

:done
echo.
echo  ============================================================
echo   Hoan thanh! Gateway dang chay tai:
echo.
echo     Dashboard : http://127.0.0.1:3456
echo     API Base  : http://127.0.0.1:3456/v1
echo.
echo   Cline / Claude Code:
echo     ANTHROPIC_BASE_URL=http://127.0.0.1:3456
echo  ============================================================
echo.
timeout /t 2 /nobreak >nul
start http://127.0.0.1:3456
pause
