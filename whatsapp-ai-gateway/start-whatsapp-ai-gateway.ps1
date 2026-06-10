# WhatsApp AI Gateway - PowerShell Launcher v2.0
# Double-click to start the gateway

$ErrorActionPreference = "Continue"
$ProjectRoot = $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   WhatsApp AI Gateway Launcher v2.0" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $ProjectRoot

# Check Node.js
try {
    $nodeVersion = & node -v 2>&1
    if ($LASTEXITCODE -ne 0) { throw }
    Write-Host "[OK] Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js not found. Please install from https://nodejs.org" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check and clear port 3210
$portInUse = Get-NetTCPConnection -LocalPort 3210 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host ""
    Write-Host "[WARN] Port 3210 is already in use. Stopping old gateway instance..." -ForegroundColor Yellow
    Write-Host ""
    $pids = Get-NetTCPConnection -LocalPort 3210 -ErrorAction SilentlyContinue |
        Where-Object { $_.OwningProcess -and $_.OwningProcess -ne 0 } |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        Write-Host "  Killing PID ${pid}: $($proc.ProcessName)" -ForegroundColor Yellow
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

$portStillInUse = Get-NetTCPConnection -LocalPort 3210 -ErrorAction SilentlyContinue
if ($portStillInUse) {
    Write-Host ""
    Write-Host "[ERROR] Port 3210 is still in use. Start aborted." -ForegroundColor Red
    netstat -ano | findstr :3210
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[OK] Port 3210 is free" -ForegroundColor Green

# Check node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "[INFO] node_modules not found. Running npm install..." -ForegroundColor Yellow
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "[ERROR] npm install failed." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host ""
Write-Host "[OK] Dependencies ready" -ForegroundColor Green
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   Dashboard will open at:" -ForegroundColor Cyan
Write-Host "   http://localhost:3210" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting WhatsApp AI Gateway..." -ForegroundColor Green

# Open browser
Start-Process http://localhost:3210

# Run the app
& npm start

# If we get here, app exited
Write-Host ""
Write-Host "[INFO] App stopped." -ForegroundColor Yellow
Read-Host "Press Enter to exit"
