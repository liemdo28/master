param(
    [int]$Port = 3456
)

$ErrorActionPreference = "Stop"

$ProjectRoot = "E:\Project\Master"
$GatewayDir = Join-Path $ProjectRoot "Agent\agent-coding-api-keys"
$LogDir = Join-Path $ProjectRoot "artifact-registry\logs"
$ExecutionDir = Join-Path $ProjectRoot "artifact-registry\executions"
$LogFile = Join-Path $LogDir "api-proxy.log"
$PidFile = Join-Path $ExecutionDir "api-proxy.pid"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
New-Item -ItemType Directory -Force -Path $ExecutionDir | Out-Null

function Write-ProxyLog {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffK"
    "[$timestamp] $Message" | Out-File -FilePath $LogFile -Append -Encoding utf8
}

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    Write-ProxyLog "Port $Port is already listening on PID $($listener.OwningProcess). No new process started."
    if ($owner) {
        Write-ProxyLog "Existing command line: $($owner.CommandLine)"
    }
    Set-Content -Path $PidFile -Value $listener.OwningProcess -Encoding ascii
    Write-Output "API proxy already running on port $Port, PID $($listener.OwningProcess)."
    exit 0
}

if (-not (Test-Path (Join-Path $GatewayDir "package.json"))) {
    Write-ProxyLog "Gateway directory is invalid: $GatewayDir"
    throw "Gateway directory is invalid: $GatewayDir"
}

Write-ProxyLog "Starting API proxy hidden on port $Port from $GatewayDir"

$command = @"
`$env:PORT='$Port'
Set-Location '$GatewayDir'
npm start *>> '$LogFile'
"@

$process = Start-Process -FilePath "powershell" `
    -WindowStyle Hidden `
    -PassThru `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $command)

Set-Content -Path $PidFile -Value $process.Id -Encoding ascii
Write-ProxyLog "Started hidden API proxy launcher PID $($process.Id)"
Write-Output "Started API proxy hidden launcher PID $($process.Id)."
