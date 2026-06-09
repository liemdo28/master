<#
  watchdog.ps1
  Runs node src/index.js and restarts it automatically if it exits.
  Designed to be launched by the BakudanFoodSafety Scheduled Task.
  Runs silently — no console window.
#>
$ErrorActionPreference = 'Continue'

$AppDir    = Split-Path $PSScriptRoot -Parent
$NodeExe   = Join-Path $AppDir 'runtime\node\node.exe'
$ChromeExe = Join-Path $AppDir 'runtime\chrome-win64\chrome.exe'
$LogsDir   = 'C:\ProgramData\BakudanFoodSafety\logs'
$WatchLog  = Join-Path $LogsDir 'watchdog.log'
$EnvFile   = 'C:\ProgramData\BakudanFoodSafety\config\.env'

function Write-WatchLog($msg) {
  try {
    if (-not (Test-Path $LogsDir)) { New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null }
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [watchdog] $msg"
    Add-Content -Path $WatchLog -Value $line
  } catch {}
}

# Load .env into environment
if (Test-Path $EnvFile) {
  Get-Content $EnvFile | Where-Object { $_ -match '^[A-Z_]+=.' -and $_ -notmatch '^#' } | ForEach-Object {
    $parts = $_ -split '=', 2
    if ($parts.Count -eq 2) {
      [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), 'Process')
    }
  }
}

$env:PUPPETEER_EXECUTABLE_PATH = $ChromeExe
$env:CHROME_PATH               = $ChromeExe

Write-WatchLog "Watchdog started. AppDir=$AppDir"

$restartDelay = 5   # seconds between restarts
$crashCount   = 0

while ($true) {
  # Guard: prevent multiple node instances
  $existing = Get-Process -Name 'node' -ErrorAction SilentlyContinue | Where-Object {
    $_.MainModule.FileName -eq $NodeExe -or ($_.CommandLine -like "*$AppDir*src/index.js*")
  }
  if ($existing) {
    Write-WatchLog "Node already running (PID $($existing[0].Id)) — watchdog idle"
    Start-Sleep -Seconds 30
    continue
  }

  Write-WatchLog "Starting node (restart #$crashCount)"

  try {
    $proc = Start-Process `
      -FilePath $NodeExe `
      -ArgumentList 'src/index.js' `
      -WorkingDirectory $AppDir `
      -NoNewWindow `
      -PassThru

    Write-WatchLog "Node started PID $($proc.Id)"
    $proc.WaitForExit()
    $exitCode = $proc.ExitCode
    $crashCount++
    Write-WatchLog "Node exited (code=$exitCode, crash #$crashCount) — restarting in ${restartDelay}s"

    # Trim watchdog log to last 500 lines
    try {
      $lines = Get-Content $WatchLog -ErrorAction SilentlyContinue
      if ($lines.Count -gt 500) { $lines[-500..-1] | Set-Content $WatchLog }
    } catch {}

  } catch {
    Write-WatchLog "Failed to start node: $($_.Exception.Message)"
    $crashCount++
  }

  Start-Sleep -Seconds $restartDelay
}
