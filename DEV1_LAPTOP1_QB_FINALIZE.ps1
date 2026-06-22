param(
  [string]$MiCoreUrl = "http://100.118.102.113:4001",
  [string]$AgentDir = "C:\Users\hoang\Downloads\source\setup-all\Bakudan\integration-system\desktop-app",
  [string]$TaskName = "ToastPOSManager-Background"
)

$ErrorActionPreference = "Stop"

function Section($Name) {
  Write-Host ""
  Write-Host "==== $Name ====" -ForegroundColor Cyan
}

function IsAdmin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Section "Laptop1 QB finalize"
Write-Host "Mi-Core URL: $MiCoreUrl"
Write-Host "Agent dir:   $AgentDir"
Write-Host "Task name:   $TaskName"

if (!(Test-Path -LiteralPath $AgentDir)) {
  throw "AgentDir not found: $AgentDir"
}

$Python = Join-Path $AgentDir ".venv\Scripts\python.exe"
if (!(Test-Path -LiteralPath $Python)) {
  $Python = "python.exe"
}

Section "1. Test Mi-Core TCP/API"
$PingUrl = "$MiCoreUrl/api/qb-agent/ping"
try {
  $Ping = Invoke-RestMethod -Uri $PingUrl -Method Get -TimeoutSec 15
  Write-Host "Mi-Core ping OK:" -ForegroundColor Green
  $Ping | ConvertTo-Json -Depth 5
} catch {
  Write-Host "Mi-Core ping FAILED. Do not flush outbox yet." -ForegroundColor Red
  throw $_
}

Section "2. Send manual heartbeat"
$HeartbeatBody = @{
  machine_id = "qb-laptop-01"
  store_code = "raw_stockton"
  status = "QB_READY"
  qb_open = $true
  qb_company = "Raw Japanese Bistro and Sushi Bar"
  app_version = "dev1-finalize"
  meta = @{
    company_id = "raw-stockton"
    company_file = "C:\QB Data\Raw Stockton\rawstockton.qbw"
    source = "DEV1_LAPTOP1_QB_FINALIZE.ps1"
  }
} | ConvertTo-Json -Depth 5

$Heartbeat = Invoke-RestMethod -Uri "$MiCoreUrl/api/qb-agent/heartbeat" -Method Post -ContentType "application/json" -Body $HeartbeatBody -TimeoutSec 15
Write-Host "Heartbeat POST OK:" -ForegroundColor Green
$Heartbeat | ConvertTo-Json -Depth 5

Section "3. Flush reporting outbox"
Push-Location $AgentDir
try {
  & $Python -c "from services.reporting_outbox import get_outbox; print(get_outbox().flush())"
  if ($LASTEXITCODE -ne 0) {
    throw "Outbox flush returned exit code $LASTEXITCODE"
  }
  Write-Host "Outbox flush command completed." -ForegroundColor Green
} finally {
  Pop-Location
}

Section "4. Restart agent manually"
Write-Host "If the agent is already running, restart it from the correct folder after outbox flush."
Write-Host "Command:"
Write-Host "cd `"$AgentDir`""
Write-Host "`"$Python`" background_agent.py"

Section "5. Fix scheduled task if running as Administrator"
if (IsAdmin) {
  $Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($Task) {
    $Action = New-ScheduledTaskAction -Execute $Python -Argument "background_agent.py" -WorkingDirectory $AgentDir
    Set-ScheduledTask -TaskName $TaskName -Action $Action | Out-Null
    Write-Host "Scheduled task updated to correct agent path." -ForegroundColor Green
    Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName,State
  } else {
    Write-Host "Scheduled task not found: $TaskName" -ForegroundColor Yellow
  }
} else {
  Write-Host "Not running as Administrator. Scheduled task fix skipped." -ForegroundColor Yellow
  Write-Host "Run PowerShell as Administrator and rerun this script to update $TaskName."
}

Section "6. Final quick check"
Invoke-RestMethod -Uri "$MiCoreUrl/api/qb-agent/machines" -Method Get -TimeoutSec 15 | ConvertTo-Json -Depth 8

Write-Host ""
Write-Host "DONE. Send Dev2 the output from sections 1, 2, 3, and 6." -ForegroundColor Green
