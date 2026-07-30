$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$LogDir = Join-Path $ProjectRoot 'logs\runtime'
$Log = Join-Path $LogDir 'watchdog.log'
$StartScript = Join-Path $ProjectRoot 'scripts\windows\start-gateway-hidden.ps1'
$Port = 3210
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
while ($true) {
  $ok = $false
  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
      $health = Invoke-RestMethod -Uri "http://localhost:$Port/api/health" -TimeoutSec 5
      $ok = [bool]$health.ok
    }
  } catch { $ok = $false }
  if (-not $ok) {
    Add-Content -Path $Log -Value "$(Get-Date -Format s) restarting gateway"
    powershell.exe -ExecutionPolicy Bypass -File $StartScript | Add-Content -Path $Log
  } else {
    Add-Content -Path $Log -Value "$(Get-Date -Format s) ok"
  }
  Start-Sleep -Seconds 60
}
