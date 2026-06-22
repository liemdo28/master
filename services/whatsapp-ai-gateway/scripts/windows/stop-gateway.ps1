$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$PidFile = Join-Path $ProjectRoot 'data\runtime\gateway.pid'
$Port = 3210
$ProjectPath = $ProjectRoot.Path
$RuntimePath = Join-Path $ProjectRoot 'runtime'

function Get-PortPid {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) { return $conn.OwningProcess }
  return $null
}

function Stop-Pid {
  param(
    [int]$Id,
    [switch]$Force
  )
  $proc = Get-Process -Id $Id -ErrorAction SilentlyContinue
  if (-not $proc) { return $false }
  Stop-Process -Id $Id -Force:$Force -ErrorAction SilentlyContinue
  Write-Output "stopped pid=$Id"
  return $true
}

function Stop-ProjectChrome {
  $escapedProject = $ProjectPath.Replace('\', '\\')
  $escapedRuntime = $RuntimePath.Replace('\', '\\')
  $chrome = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' OR Name = 'msedge.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and ($_.CommandLine -like "*$ProjectPath*" -or $_.CommandLine -like "*$RuntimePath*" -or $_.CommandLine -like "*$escapedProject*" -or $_.CommandLine -like "*$escapedRuntime*")
  }
  foreach ($proc in $chrome) {
    Stop-Pid -Id ([int]$proc.ProcessId) -Force | Out-Null
    Write-Output "stopped bundled chrome pid=$($proc.ProcessId)"
  }
}

function Stop-ProjectNode {
  $nodes = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and ($_.CommandLine -like "*$ProjectPath*" -or $_.CommandLine -like "*src/index.js*")
  }
  foreach ($proc in $nodes) {
    Stop-Pid -Id ([int]$proc.ProcessId) -Force | Out-Null
    Write-Output "force stopped project node pid=$($proc.ProcessId)"
  }
}

$pids = @()
if (Test-Path $PidFile) { $pids += Get-Content $PidFile -ErrorAction SilentlyContinue }
$portPid = Get-PortPid
if ($portPid) { $pids += $portPid }
$pids = $pids | Where-Object { $_ } | Select-Object -Unique

foreach ($id in $pids) {
  Stop-Pid -Id ([int]$id) -Force | Out-Null
}

Stop-ProjectChrome
Start-Sleep -Seconds 3

$portPid = Get-PortPid
if ($portPid) {
  Stop-ProjectNode
  Start-Sleep -Seconds 1
}

$portPid = Get-PortPid
if ($portPid) {
  Write-Output "port $Port still active pid=$portPid"
  exit 1
}

if (Test-Path $PidFile) {
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}
if (-not $pids) { Write-Output 'gateway not running' }
