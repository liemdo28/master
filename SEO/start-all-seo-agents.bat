@echo off
echo ================================================
echo  Starting All SEO Agents + Orchestrator
echo ================================================

echo [1/8] Starting seo-local-maps-agent (port 4011)...
start "seo-local-maps-agent" /D "%~dp0seo-local-maps-agent" cmd /c node index.js

echo [2/8] Starting seo-website-agent (port 4012)...
start "seo-website-agent" /D "%~dp0seo-website-agent" cmd /c node index.js

echo [3/8] Starting seo-technical-agent (port 4013)...
start "seo-technical-agent" /D "%~dp0seo-technical-agent" cmd /c node index.js

echo [4/8] Starting seo-schema-agent (port 4014)...
start "seo-schema-agent" /D "%~dp0seo-schema-agent" cmd /c node index.js

echo [5/8] Starting seo-content-agent (port 4015)...
start "seo-content-agent" /D "%~dp0seo-content-agent" cmd /c node index.js

echo [6/8] Starting seo-citation-agent (port 4016)...
start "seo-citation-agent" /D "%~dp0seo-citation-agent" cmd /c node index.js

echo [7/8] Starting seo-analytics-agent (port 4017)...
start "seo-analytics-agent" /D "%~dp0seo-analytics-agent" cmd /c node index.js

echo [8/8] Starting seo-automation-orchestrator (port 4020)...
start "seo-automation-orchestrator" /D "%~dp0seo-automation-orchestrator" cmd /c node index.js

echo ================================================
echo  All 8 SEO services started.
echo  Health checks: curl http://localhost:4011/health ... 4017/health
echo  Orchestrator:  curl http://localhost:4020/health
echo ================================================
timeout /t 3
