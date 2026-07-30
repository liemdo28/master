@echo off
echo ================================================
echo  Stopping All SEO Agents + Orchestrator
echo ================================================

echo Stopping seo-local-maps-agent (4011)...
taskkill /FI "WINDOWTITLE eq seo-local-maps-agent" /F >nul 2>&1
taskkill /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq seo-local-maps-agent" /F >nul 2>&1

echo Stopping seo-website-agent (4012)...
taskkill /FI "WINDOWTITLE eq seo-website-agent" /F >nul 2>&1

echo Stopping seo-technical-agent (4013)...
taskkill /FI "WINDOWTITLE eq seo-technical-agent" /F >nul 2>&1

echo Stopping seo-schema-agent (4014)...
taskkill /FI "WINDOWTITLE eq seo-schema-agent" /F >nul 2>&1

echo Stopping seo-content-agent (4015)...
taskkill /FI "WINDOWTITLE eq seo-content-agent" /F >nul 2>&1

echo Stopping seo-citation-agent (4016)...
taskkill /FI "WINDOWTITLE eq seo-citation-agent" /F >nul 2>&1

echo Stopping seo-analytics-agent (4017)...
taskkill /FI "WINDOWTITLE eq seo-analytics-agent" /F >nul 2>&1

echo Stopping seo-automation-orchestrator (4020)...
taskkill /FI "WINDOWTITLE eq seo-automation-orchestrator" /F >nul 2>&1

echo ================================================
echo  All SEO services stopped.
echo ================================================
