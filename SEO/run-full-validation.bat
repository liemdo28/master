@echo off
echo ================================================
echo  SEO System Full Validation
echo ================================================
echo.

echo [1] Running validate-system.js...
cd /d "%~dp0.."
node SEO\shared\base\validate-system.js
echo.

echo [2] Checking Mi-Core SEO endpoints...
curl -s http://localhost:4001/api/seo/agents
echo.
curl -s http://localhost:4001/api/seo/dashboard
echo.
curl -s http://localhost:4001/api/seo/connectors/status
echo.
curl -s http://localhost:4001/api/seo/reports/latest
echo.
curl -s http://localhost:4001/api/seo/issues
echo.
curl -s http://localhost:4001/api/seo/opportunities
echo.
curl -s http://localhost:4001/api/seo/kpis
echo.
curl -s http://localhost:4001/api/seo/locations
echo.

echo [3] Checking agent health...
for %%p in (4011 4012 4013 4014 4015 4016 4017) do (
    echo   Port %%p:
    curl -s http://localhost:%%p/health
    echo.
)

echo [4] Checking orchestrator health...
curl -s http://localhost:4020/health
echo.

echo [5] Running agent audits...
for %%p in (4011 4012 4013 4014 4015 4016 4017) do (
    echo   Audit port %%p:
    curl -s -X POST http://localhost:%%p/run/audit
    echo.
)

echo ================================================
echo  Validation complete.
echo ================================================
