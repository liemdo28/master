@echo off
echo ================================================================
echo  Installing SEO Services as Windows Startup
echo ================================================================

echo Creating scheduled tasks for auto-start on boot...

:: Mi-Core
schtasks /create /tn "SEO-MiCore" /tr "cd /d E:\Project\Master\mi-core && node server\dist\index.js" /sc onstart /ru "%USERNAME%" /rl highest >nul 2>&1
if %errorlevel%==0 echo   [OK] SEO-MiCore scheduled

:: SEO Agents
for %%i in (4011:seo-local-maps-agent 4012:seo-technical-agent 4013:seo-website-agent 4014:seo-schema-agent 4015:seo-content-agent 4016:seo-citation-agent 4017:seo-analytics-agent) do (
    for /f "tokens=1,2 delims=:" %%a in ("%%i") do (
        schtasks /create /tn "SEO-Agent-%%a" /tr "cd /d E:\Project\Master\SEO\%%b && node index.js" /sc onstart /ru "%USERNAME%" /rl highest >nul 2>&1
        if %errorlevel%==0 echo   [OK] SEO-Agent-%%a scheduled
    )
)

:: Orchestrator
schtasks /create /tn "SEO-Orchestrator" /tr "cd /d E:\Project\Master\SEO\seo-automation-orchestrator && node index.js" /sc onstart /ru "%USERNAME%" /rl highest >nul 2>&1
if %errorlevel%==0 echo   [OK] SEO-Orchestrator scheduled

echo.
echo ================================================================
echo  Installation complete.
echo  Services will auto-start on next boot.
echo  Run uninstall-seo-windows-startup.bat to remove.
echo ================================================================
pause
