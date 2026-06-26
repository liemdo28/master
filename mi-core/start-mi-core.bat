@echo off
REM Mi-Core Auto-Start Script
REM Starts Docker Big Data infra + Mi-Core server on Windows login

cd /d "D:\Project\Master\mi-core\infra\bigdata"

REM Wait for Docker Desktop to be ready (up to 60s)
set /a attempts=0
:docker_wait
docker info >nul 2>&1
if %errorlevel%==0 goto docker_ready
set /a attempts+=1
if %attempts% geq 12 goto docker_skip
timeout /t 5 /nobreak >nul
goto docker_wait

:docker_ready
docker-compose up -d
echo [Mi] Big Data infra started

:docker_skip
cd /d "D:\Project\Master\mi-core\server"
start /min cmd /c "npx tsx src/index.ts >> D:\Project\Master\mi-core\logs\server.log 2>&1"
echo [Mi] Server started — http://localhost:4001
