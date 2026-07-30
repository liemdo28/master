$ErrorActionPreference = 'Stop'
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$EnvPath = Join-Path $ProjectRoot '.env'
$Port = 3210
if (Test-Path $EnvPath) {
  $portLine = Get-Content $EnvPath -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*DASHBOARD_PORT\s*=' } | Select-Object -First 1
  if ($portLine -and ($portLine -replace '^\s*DASHBOARD_PORT\s*=\s*', '') -match '^\d+$') {
    $Port = [int]($portLine -replace '^\s*DASHBOARD_PORT\s*=\s*', '')
  }
}
$RuntimeDir = Join-Path $ProjectRoot 'data\runtime'
$LogDir = Join-Path $ProjectRoot 'logs\runtime'
$PidFile = Join-Path $ProjectRoot 'data\runtime\gateway.pid'
$OutLog = Join-Path $ProjectRoot 'logs\runtime\gateway-out.log'
$ErrLog = Join-Path $ProjectRoot 'logs\runtime\gateway-error.log'
$StartLog = Join-Path $ProjectRoot 'logs\runtime\gateway-start.log'
$BundledNode = Join-Path $ProjectRoot 'runtime\node\node.exe'
$BundledChrome = Join-Path $ProjectRoot 'runtime\chrome-win64\chrome.exe'
$NodeExe = if (Test-Path $BundledNode) { $BundledNode } else { 'node.exe' }
$ServerArgs = @('src/index.js')

New-Item -ItemType Directory -Force -Path $RuntimeDir, $LogDir | Out-Null
if (Test-Path $BundledChrome) {
  $env:PUPPETEER_EXECUTABLE_PATH = $BundledChrome
  $env:CHROME_PATH = $BundledChrome
}

function Write-StartLog {
  param([string]$Message)
  $line = "$(Get-Date -Format s) $Message"
  try {
    Add-Content -Path $StartLog -Value $line -ErrorAction Stop
  } catch {
    $alternate = Join-Path $LogDir ("gateway-start-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
    try {
      Add-Content -Path $alternate -Value $line -ErrorAction Stop
    } catch {
      Write-Host "[WARN] Could not write start log: $($_.Exception.Message)"
    }
  }
}

function Set-AtomicFile {
  param(
    [string]$Path,
    [string]$Value
  )
  $dir = Split-Path $Path -Parent
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $temp = Join-Path $dir (".{0}.{1}.tmp" -f ([IO.Path]::GetFileName($Path)), ([guid]::NewGuid().ToString('N')))
  Set-Content -Path $temp -Value $Value -ErrorAction Stop
  Move-Item -LiteralPath $temp -Destination $Path -Force -ErrorAction Stop
}

function Get-PortPid {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) { return $conn.OwningProcess }
  return $null
}

function Test-GatewayOwnedProcess {
  param([int]$ProcessId)
  try {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
    if (-not $proc) { return $false }
    $cmd = [string]$proc.CommandLine
    return ($cmd -like "*$ProjectRoot*" -or $cmd -like '*whatsapp-ai-gateway*' -or $cmd -like '*src/index.js*')
  } catch {
    return $false
  }
}

function Write-RuntimeDiagnostics {
  param([string]$Reason)
  Write-StartLog "diagnostics reason=$Reason"
  Write-Output "diagnostics reason=$Reason"
  Write-Output "tasklist node:"
  tasklist | findstr node
  Write-Output "netstat ${Port}:"
  netstat -ano | findstr $Port
  foreach ($logPath in @($StartLog, $OutLog, $ErrLog)) {
    Write-Output ""
    Write-Output "---- $logPath ----"
    if (Test-Path $logPath) {
      Get-Content $logPath -Tail 80 -ErrorAction SilentlyContinue
    } else {
      Write-Output "(missing)"
    }
  }
}

$portPid = Get-PortPid
if ($portPid) {
  Write-StartLog "port $Port occupied pid=$portPid"
  if (Test-GatewayOwnedProcess -ProcessId $portPid) {
    Write-StartLog "stopping gateway-owned port pid=$portPid"
    Stop-Process -Id $portPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
  } else {
    Write-StartLog "port conflict non-gateway pid=$portPid"
    Write-Output "port=conflict pid=$portPid"
    Write-RuntimeDiagnostics -Reason 'port-conflict'
    exit 4
  }
}

if (Test-Path $PidFile) {
  $oldPid = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($oldPid -and -not (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    Remove-Item $PidFile -Force
    Write-StartLog "removed stale pid=$oldPid"
  }
}

Set-Location $ProjectRoot
$proc = $null
try {
  $proc = Start-Process -FilePath $NodeExe -ArgumentList $ServerArgs -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog -PassThru
} catch {
  Write-StartLog "primary log redirect failed: $($_.Exception.Message)"
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $OutLog = Join-Path $LogDir "gateway-out-$stamp.log"
  $ErrLog = Join-Path $LogDir "gateway-error-$stamp.log"
  $proc = Start-Process -FilePath $NodeExe -ArgumentList $ServerArgs -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog -PassThru
}

Set-AtomicFile -Path $PidFile -Value $proc.Id
Write-StartLog "started pid=$($proc.Id) stdout=$OutLog stderr=$ErrLog"

Start-Sleep -Seconds 2
if (-not (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue)) {
  Write-StartLog "process exited early pid=$($proc.Id)"
  Write-Output "started pid=$($proc.Id) process=exited"
  exit 1
}

$portDeadline = (Get-Date).AddSeconds(120)
do {
  $portPid = Get-PortPid
  if ($portPid) { break }
  if (-not (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue)) {
    Write-StartLog "process exited while waiting for port pid=$($proc.Id)"
    Write-Output "started pid=$($proc.Id) process=exited"
    Write-RuntimeDiagnostics -Reason 'process-exited-before-port'
    exit 1
  }
  Start-Sleep -Seconds 2
} while ((Get-Date) -lt $portDeadline)

if (-not $portPid) {
  Write-StartLog "port $Port did not start listening pid=$($proc.Id)"
  Write-Output "started pid=$($proc.Id) port=failed"
  Write-RuntimeDiagnostics -Reason 'port-timeout'
  exit 2
}

$healthDeadline = (Get-Date).AddSeconds(120)
do {
  try {
    $health = Invoke-RestMethod -Uri "http://localhost:$Port/api/health" -TimeoutSec 10
    if ($health.ok -eq $true) {
      Write-StartLog "health ok whatsapp=$($health.whatsapp_status) build=$($health.build_id)"
      Write-Output "started pid=$($proc.Id) health=ok"
      exit 0
    }
    Write-StartLog "health returned ok=$($health.ok) whatsapp=$($health.whatsapp_status) build=$($health.build_id)"
  } catch {
    Write-StartLog "health retry failed $($_.Exception.Message)"
  }
  Start-Sleep -Seconds 3
} while ((Get-Date) -lt $healthDeadline)

Write-Output "started pid=$($proc.Id) health=failed"
Write-RuntimeDiagnostics -Reason 'health-timeout'
exit 3
