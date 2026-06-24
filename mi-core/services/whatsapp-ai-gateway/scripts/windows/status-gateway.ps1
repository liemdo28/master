$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$PidFile = Join-Path $ProjectRoot 'data\runtime\gateway.pid'
$Port = 3210
$pidValue = if (Test-Path $PidFile) { Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1 } else { $null }
$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$running = [bool]$conn
Write-Output "Gateway status: $(if($running){'RUNNING'}else{'STOPPED'})"
Write-Output "PID file: $pidValue"
Write-Output "Port $Port PID: $($conn.OwningProcess)"
try {
  $health = Invoke-RestMethod -Uri "http://localhost:$Port/api/health" -TimeoutSec 5
  Write-Output "Health: ok"
  Write-Output "WhatsApp: $($health.whatsapp_status)"
  Write-Output "Build ID: $($health.build_id)"
  Write-Output "Template Count: $($health.template_item_count)"
} catch {
  Write-Output "Health: failed - $($_.Exception.Message)"
}
