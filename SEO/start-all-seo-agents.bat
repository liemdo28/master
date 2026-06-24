@echo off
echo ================================================
echo  Starting All SEO Agents + Orchestrator
echo ================================================

echo [1/8] Starting seo-local-maps-agent (port 4011)...
start "seo-local-maps-agent" cmd /c "cd /d E:\Project\Master\SEO\seo-local-maps-agent && node index.js"

echo [2/8] Starting seo-technical-agent (port 4012)...
start "seo-technical-agent" cmd /c "cd /d E:\Project\Master\SEO\seo-technical-agent && node index.js"

echo [3/8] Starting seo-website-agent (port 4013)...
start "seo-website-agent" cmd /c "cd /d E:\Project\Master\SEO\seo-website-agent && node index.js"

echo [4/8] Starting seo-schema-agent (port 4014)...
start "seo-schema-agent" cmd /c "cd /d E:\Project\Master\SEO\seo-schema-agent && node index.js"

echo [5/8] Starting seo-content-agent (port 4015)...
start "seo-content-agent" cmd /c "cd /d E:\Project\Master\SEO\seo-content-agent && node index.js"

echo [6/8] Starting seo-citation-agent (port 4016)...
start "seo-citation-agent" cmd /c "cd /d E:\Project\Master\SEO\seo-citation-agent && node index.js"

echo [7/8] Starting seo-analytics-agent (port 4017)...
start "seo-analytics-agent" cmd /c "cd /d E:\Project\Master\SEO\seo-analytics-agent && node index.js"

echo [8/8] Starting seo-automation-orchestrator (port 4020)...
start "seo-automation-orchestrator" cmd /c "cd /d E:\Project\Master\SEO\seo-automation-orchestrator && node index.js"

echo ================================================
echo  All 8 SEO services started.
echo  Health checks: curl http://localhost:4011/health ... 4017/health
echo  Orchestrator:  curl http://localhost:4020/health
echo ================================================
timeout /t 3
