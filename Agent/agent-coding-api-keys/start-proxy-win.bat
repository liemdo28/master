@echo off
title AI Provider Proxy
cd /d "%~dp0"
echo Starting AI Provider Proxy in hidden/background mode...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-proxy-background.ps1"
echo Done. Check E:\Project\Master\artifact-registry\logs\api-proxy.log
