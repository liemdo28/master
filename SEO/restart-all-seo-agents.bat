@echo off
echo ================================================
echo  Restarting All SEO Agents + Orchestrator
echo ================================================
call "%~dp0stop-all-seo-agents.bat"
timeout /t 2 >nul
call "%~dp0start-all-seo-agents.bat"
echo ================================================
echo  Restart complete.
echo ================================================
