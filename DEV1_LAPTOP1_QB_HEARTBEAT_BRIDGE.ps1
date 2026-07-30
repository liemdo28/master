param(
  [string]$MiCoreUrl = "http://100.118.102.113:4001",
  [switch]$Install,
  [switch]$Uninstall,
  [string]$TaskName = "MiCore-QB-Heartbeat-Bridge"
)

$ErrorActionPreference = "Stop"

$BridgeDir = Join-Path $env:LOCALAPPDATA "MiCore\qb-heartbeat-bridge"
$BridgeScript = Join-Path $BridgeDir "send-qb-heartbeat.ps1"

function Write-BridgeScript {
  New-Item -ItemType Directory -Force -Path $BridgeDir | Out-Null
  @"
`$ErrorActionPreference = "Stop"
`$MiCoreUrl = "$MiCoreUrl"
`$qb = Get-Process -Name QBW -ErrorAction SilentlyContinue | Select-Object -First 1
`$qbOpen = [bool]`$qb
`$body = @{
  machine_id = "qb-laptop-01"
  store_code = "raw-stockton"
  status = if (`$qbOpen) { "QB_READY" } else { "QB_NOT_OPEN" }
  qb_open = `$qbOpen
  qb_company = if (`$qbOpen) { "Raw Japanese Bistro and Sushi Bar" } else { `$null }
  app_version = "heartbeat-bridge"
  uptime_seconds = if (`$qbOpen) { [int]((Get-Date) - `$qb.StartTime).TotalSeconds } else { 0 }
  meta = @{
    company_id = "raw-stockton"
    company_file = "C:\QB Data\Raw Stockton\rawstockton.qbw"
    source = "MiCore-QB-Heartbeat-Bridge"
    qb_process_id = if (`$qbOpen) { `$qb.Id } else { `$null }
  }
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Uri "`$MiCoreUrl/api/qb-agent/heartbeat" -Method Post -ContentType "application/json" -Body `$body -TimeoutSec 20 | ConvertTo-Json -Depth 6
"@ | Set-Content -LiteralPath $BridgeScript -Encoding UTF8
}

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Uninstalled scheduled task: $TaskName" -ForegroundColor Yellow
  exit 0
}

Write-Host "Testing Mi-Core ping: $MiCoreUrl/api/qb-agent/ping" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$MiCoreUrl/api/qb-agent/ping" -Method Get -TimeoutSec 20 | ConvertTo-Json -Depth 5

Write-BridgeScript

Write-Host ""
Write-Host "Sending one QB heartbeat with qb_open based on QBW.EXE..." -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $BridgeScript

if ($Install) {
  Write-Host ""
  Write-Host "Installing per-user scheduled task: $TaskName" -ForegroundColor Cyan
  $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$BridgeScript`""
  $Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
  $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Force | Out-Null
  Write-Host "Installed. It will post qb_open/qb_company to Mi-Core every minute while this user is logged in." -ForegroundColor Green
}

Write-Host ""
Write-Host "Mi-Core machine state:" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$MiCoreUrl/api/qb-agent/machines" -Method Get -TimeoutSec 20 | ConvertTo-Json -Depth 8

Write-Host ""
Write-Host "DONE. Send Dev2 this output." -ForegroundColor Green
