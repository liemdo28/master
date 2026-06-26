@echo off
echo ================================================
echo  Uninstalling SEO Windows Startup Tasks
echo ================================================

schtasks /delete /tn "SEO-MiCore" /f >nul 2>&1
schtasks /delete /tn "SEO-Agent-4011" /f >nul 2>&1
schtasks /delete /tn "SEO-Agent-4012" /f >nul 2>&1
schtasks /delete /tn "SEO-Agent-4013" /f >nul 2>&1
schtasks /delete /tn "SEO-Agent-4014" /f >nul 2>&1
schtasks /delete /tn "SEO-Agent-4015" /f >nul 2>&1
schtasks /delete /tn "SEO-Agent-4016" /f >nul 2>&1
schtasks /delete /tn "SEO-Agent-4017" /f >nul 2>&1
schtasks /delete /tn "SEO-Orchestrator" /f >nul 2>&1

set "STARTUP_VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\start-seo-agents-hidden.vbs"
if exist "%STARTUP_VBS%" del /f /q "%STARTUP_VBS%" >nul 2>&1

echo All SEO startup tasks and Startup fallback removed.
