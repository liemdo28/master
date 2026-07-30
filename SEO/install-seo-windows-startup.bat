@echo off
echo ================================================================
echo  Installing SEO Services as Windows Startup
echo ================================================================

echo Creating scheduled tasks for auto-start on user logon...

set "MASTER_ROOT=%~dp0.."
set "SEO_ROOT=%~dp0"

:: Mi-Core
schtasks /create /tn "SEO-MiCore" /tr "cmd /c cd /d ""%MASTER_ROOT%\mi-core"" && node server\dist\index.js" /sc onlogon /f >nul 2>&1
if %errorlevel%==0 echo   [OK] SEO-MiCore scheduled

:: SEO Agents
for %%i in (4011:seo-local-maps-agent 4012:seo-website-agent 4013:seo-technical-agent 4014:seo-schema-agent 4015:seo-content-agent 4016:seo-citation-agent 4017:seo-analytics-agent) do (
    for /f "tokens=1,2 delims=:" %%a in ("%%i") do (
        schtasks /create /tn "SEO-Agent-%%a" /tr "cmd /c cd /d ""%SEO_ROOT%%%b"" && node index.js" /sc onlogon /f >nul 2>&1
        if %errorlevel%==0 echo   [OK] SEO-Agent-%%a scheduled
    )
)

:: Orchestrator
schtasks /create /tn "SEO-Orchestrator" /tr "cmd /c cd /d ""%SEO_ROOT%seo-automation-orchestrator"" && node index.js" /sc onlogon /f >nul 2>&1
if %errorlevel%==0 echo   [OK] SEO-Orchestrator scheduled

:: User Startup fallback when Task Scheduler is blocked by Windows policy.
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if not exist "%STARTUP_DIR%" mkdir "%STARTUP_DIR%" >nul 2>&1
copy /Y "%SEO_ROOT%start-seo-agents-hidden.vbs" "%STARTUP_DIR%\start-seo-agents-hidden.vbs" >nul 2>&1
if exist "%STARTUP_DIR%\start-seo-agents-hidden.vbs" echo   [OK] Startup fallback installed

echo.
echo ================================================================
echo  Installation complete.
echo  Services will auto-start on next user logon via Task Scheduler or Startup fallback.
echo  Run uninstall-seo-windows-startup.bat to remove.
echo ================================================================
