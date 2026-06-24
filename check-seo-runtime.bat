@echo off
echo ======================================================
echo  SEO Runtime Check — Phase 7
echo  Verifies all services are online.
echo ======================================================
echo.

echo PASS=0
echo FAIL=0

echo [1] Checking Mi-Core (port 4001)...
 curl -s -o nul -w %{http_code}" http://localhost:4001/api/seo/agents | findstr "200" >nul 2>&1; if %errorlevel%==0 (echo   PASS: Mi-Core online) else (echo   FAIL: Mi-Core offline & set /a FAIL+=1) & set /a PASS+=1

echo [2] Checking seo-local-maps-agent (port 4011)...
 curl -s -o nul -w %{http_code}" http://localhost:4011/health | findstr "200" >nul 2>&1; if %errorlevel%==0 (echo   PASS: 4011 online) else (echo   FAIL: 4011 offline & set /a FAIL+=1) & set /a PASS+=1)

echo [3] Checking seo-technical-agent (port 4012)...
 curl -s -o nul -w %{http_code}" http://localhost:4012/health | findstr "200" >nul 2>&1; if %errorlevel%==0 (echo   PASS: 4012 online) else (echo   FAIL: 4012 offline & set /a FAIL+=1) & set /a PASS+=1)

echo [4] Checking seo-website-agent (port 4013)...
 curl -s -o nul -w %{http_code}" http://localhost:4013/health | findstr "200" >nul 2>&1; if %errorlevel%==0 (echo   PASS: 4013 online) else (echo   FAIL: 4013 offline & set /a FAIL+=1) & set /a PASS+=1)

echo [5] Checking seo-schema-agent (port 4014)...
 curl -s -o nul -w %{http_code}" http://localhost:4014/health | findstr "200" >nul 2>&1; if %errorlevel%==0 (echo   PASS: 4014 online) else (echo   FAIL: 4014 offline & set /a FAIL+=1) & set /a PASS+=1

echo [6] Checking seo-content-agent (port 4015)...
 curl -s -o nul -w %{http_code}" http://localhost:4015/health | findstr "200" >nul 2>&1; if %errorlevel%==0 (echo   PASS: 4015 online) else (echo   FAIL: 4015 offline & set /a FAIL+=1) & set /a PASS+=1)

echo [7] Checking seo-citation-agent (port 4016)...
 curl -s -o nul -w %{http_code}" http://localhost:4016/health | findstr "200" >nul 2>&1; if %errorlevel%==0 (echo   PASS: 4016 online) else (echo   FAIL: 4016 offline & set /a FAIL+=1) & set /a PASS+=1

echo [8] Checking seo-analytics-agent (port 4017)...
 curl -s -o nul -w %{http_code}" http://localhost:4017/health | findstr "200" >nul 2>&1; if %errorlevel%==0 (echo   PASS: 4017 online) else (echo   FAIL: 4017 offline & set /a FAIL+=1) & set /a PASS+=1)

echo [9] Checking orchestrator (port 4020)...
 curl -s -o nul -w %{http_code}" http://localhost:4020/health | findstr "200" >nul 2>&1; if %errorlevel%==0 (echo   PASS: 4020 online) else (echo   FAIL: 4020 offline & set /a FAIL+=1) & set /a PASS+=1)

echo [10] Checking dashboard endpoint...
 curl -s http://localhost:4001/api/seo/dashboard >nul 2>&1; if %errorlevel%==0 (echo   PASS: Dashboard endpoint reachable) else (echo   FAIL: Dashboard unreachable & set /a FAIL+=1) & set /a PASS+=1)

echo [11] Checking orchestrator status endpoint...
 curl -s http://localhost:4020/status >nul 2>&1; if %errorlevel%==0 (echo   PASS: Orchestrator status reachable) else (echo   FAIL: Orchestrator status unreachable & set /a FAIL+=1) & set /a PASS+=1)

echo .
echo ======================================================
echo  Runtime Check Complete
echo  Pass: %PASS%  Fail: %FAIL%
echo ======================================================