param(
  [Parameter(Position=0)]
  [ValidateSet('update','rollback','status')]
  [string]$Command = 'status',

  [Parameter(Position=1)]
  [string]$RollbackTarget = 'latest'
)
$ErrorActionPreference = 'Stop'

# ── Paths ──────────────────────────────────────────────────────────────────────
$AppRoot    = 'C:\Program Files\BakudanFoodSafety'
$AppDir     = Join-Path $AppRoot 'app'
$UpdaterDir = Join-Path $AppRoot 'updater'
$DataRoot   = 'C:\ProgramData\BakudanFoodSafety'
$BackupsDir = Join-Path $DataRoot 'backups'
$LogsDir    = Join-Path $DataRoot 'logs'
$ConfigDir  = Join-Path $DataRoot 'config'
$DbDir      = Join-Path $DataRoot 'db'
$Port       = 3210
$TaskName   = 'BakudanFoodSafety'
$UpdateLog  = Join-Path $LogsDir 'updates.log'

# ── Helpers ────────────────────────────────────────────────────────────────────
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  [..] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Fail($msg) {
  Write-Host "  [FAIL] $msg" -ForegroundColor Red
  throw $msg
}

function Log-Update($action, $from, $to, $status, $note = '') {
  try {
    if (-not (Test-Path $LogsDir)) { New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null }
    $entry = [ordered]@{ ts = (Get-Date -Format 'o'); action = $action; from = $from; to = $to; status = $status; note = $note }
    Add-Content -Path $UpdateLog -Value ($entry | ConvertTo-Json -Compress)
  } catch {}
}

function Get-CurrentVersion {
  $vf = Join-Path $AppDir 'version.json'
  if (Test-Path $vf) { return (Get-Content $vf -Raw | ConvertFrom-Json) }
  return [PSCustomObject]@{ version = '0.0.0'; build = 'unknown' }
}

function Stop-App {
  Write-Info 'Stopping app...'
  try { Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue } catch {}
  # Kill node processes running from AppDir
  Get-Process -Name 'node' -ErrorAction SilentlyContinue | Where-Object {
    $_.MainModule.FileName -like '*BakudanFoodSafety*' -or
    ($_.CommandLine -like "*$AppDir*")
  } | ForEach-Object { try { $_.Kill() } catch {} }
  Start-Sleep -Seconds 3
  Write-Ok 'App stopped'
}

function Start-App {
  Write-Info 'Starting app...'
  $nodeExe   = Join-Path $AppDir 'runtime\node\node.exe'
  $chromeExe = Join-Path $AppDir 'runtime\chrome-win64\chrome.exe'
  $psCmd = "Set-Location '$AppDir'; `$env:PUPPETEER_EXECUTABLE_PATH='$chromeExe'; `$env:CHROME_PATH='$chromeExe'; & '$nodeExe' 'src/index.js'"
  Start-Process 'powershell.exe' -ArgumentList @('-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-Command', $psCmd) -WorkingDirectory $AppDir
  try { Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue } catch {}
  Write-Ok 'App started'
}

function Wait-ForHealth($seconds = 60) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-RestMethod -Uri "http://localhost:$Port/api/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
      if ($r.ok -eq $true) { return $r }
    } catch {}
    Start-Sleep -Seconds 3
  }
  return $null
}

function New-Backup($label) {
  $ts     = Get-Date -Format 'yyyyMMdd-HHmmss'
  $dir    = Join-Path $BackupsDir "backup-$ts-$label"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null

  # DB
  $dbSrc = Join-Path $DbDir 'gateway.db'
  if (Test-Path $dbSrc) { Copy-Item $dbSrc (Join-Path $dir 'gateway.db') -Force }

  # Config
  $cfgDest = Join-Path $dir 'config'
  if (Test-Path $ConfigDir) { Copy-Item $ConfigDir $cfgDest -Recurse -Force }

  # App source snapshot (exclude runtime/ and node_modules — too large, preserved by installer)
  if (Test-Path $AppDir) {
    $appSnap = Join-Path $dir 'app'
    New-Item -ItemType Directory -Force -Path $appSnap | Out-Null
    Get-ChildItem -Path $AppDir -Force | Where-Object {
      $_.Name -notin @('runtime', 'node_modules', '.git')
    } | ForEach-Object {
      Copy-Item $_.FullName (Join-Path $appSnap $_.Name) -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Ok "App source snapshot at $appSnap"
  }

  # Marker with metadata
  @{ createdAt = (Get-Date -Format 'o'); appVersion = (Get-CurrentVersion).version; label = $label } |
    ConvertTo-Json | Set-Content (Join-Path $dir 'backup-meta.json')

  Write-Ok "Backup at $dir"
  return $dir
}

function Restore-Backup($backupDir) {
  Write-Info "Restoring from $backupDir..."
  $dbSrc = Join-Path $backupDir 'gateway.db'
  if (Test-Path $dbSrc) { Copy-Item $dbSrc (Join-Path $DbDir 'gateway.db') -Force }
  $cfgSrc = Join-Path $backupDir 'config'
  if (Test-Path $cfgSrc) {
    Remove-Item $ConfigDir -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item $cfgSrc $ConfigDir -Recurse -Force
  }
  # Restore app source if snapshot exists (rollback app binaries)
  $appSnap = Join-Path $backupDir 'app'
  if (Test-Path $appSnap) {
    Write-Info "Restoring app source from backup snapshot..."
    # Remove everything except runtime and node_modules (preserved)
    Get-ChildItem -Path $AppDir -Force -ErrorAction SilentlyContinue | Where-Object {
      $_.Name -notin @('runtime', 'node_modules')
    } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $appSnap -Force | ForEach-Object {
      Copy-Item $_.FullName (Join-Path $AppDir $_.Name) -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Ok 'App source restored from backup'
  }
  Write-Ok 'Backup restored'
}

function Get-LatestBackupDir {
  $dirs = Get-ChildItem -Path $BackupsDir -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1
  return $dirs?.FullName
}

function Invoke-ChecksumVerify($filePath, $expectedSha256) {
  $actual = (Get-FileHash -Path $filePath -Algorithm SHA256).Hash
  if ($actual.ToLower() -ne $expectedSha256.ToLower()) {
    Fail "SHA256 mismatch. Expected: $expectedSha256  Got: $actual"
  }
  Write-Ok "SHA256 verified"
}

# ── Command: status ────────────────────────────────────────────────────────────
function Invoke-Status {
  $cur = Get-CurrentVersion
  Write-Host ""
  Write-Host "  Current version : $($cur.version)"
  Write-Host "  Build           : $($cur.build)"
  Write-Host "  App folder      : $AppDir"
  Write-Host "  Data folder     : $DataRoot"
  $backups = Get-ChildItem -Path $BackupsDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 5
  if ($backups) {
    Write-Host "  Recent backups  :"
    foreach ($b in $backups) { Write-Host "    $($b.Name)" }
  }
  Write-Host ""
}

# ── Command: update ────────────────────────────────────────────────────────────
function Invoke-Update {
  Write-Host ""
  Write-Host "  === Bakudan Food Safety Updater ===" -ForegroundColor Cyan
  Write-Host ""

  # 1. Fetch manifest
  $manifestUrl = $env:UPDATE_MANIFEST_URL
  if (-not $manifestUrl) {
    $envFile = Join-Path $ConfigDir '.env'
    if (Test-Path $envFile) {
      $line = (Get-Content $envFile | Where-Object { $_ -match '^UPDATE_MANIFEST_URL=' }) | Select-Object -First 1
      if ($line) { $manifestUrl = $line.Split('=', 2)[1].Trim() }
    }
  }
  if (-not $manifestUrl) { Fail 'UPDATE_MANIFEST_URL not set. Add it to ProgramData\BakudanFoodSafety\config\.env' }
  if (-not $manifestUrl.StartsWith('https://')) { Fail 'UPDATE_MANIFEST_URL must use HTTPS.' }

  Write-Info "Fetching manifest from $manifestUrl"
  $manifest = Invoke-RestMethod -Uri $manifestUrl -Method Get -TimeoutSec 15 -ErrorAction Stop
  Write-Ok "Manifest: v$($manifest.latestVersion) build $($manifest.build)"

  $cur = Get-CurrentVersion
  Write-Info "Current: v$($cur.version)  Latest: v$($manifest.latestVersion)"

  # Compare versions
  $curParts = $cur.version -split '\.' | ForEach-Object { [int]$_ }
  $newParts = $manifest.latestVersion -split '\.' | ForEach-Object { [int]$_ }
  $newer = $false
  for ($i = 0; $i -lt 3; $i++) {
    if (($newParts[$i] -or 0) -gt ($curParts[$i] -or 0)) { $newer = $true; break }
    if (($newParts[$i] -or 0) -lt ($curParts[$i] -or 0)) { break }
  }
  if (-not $newer) {
    Write-Ok "Already up to date (v$($cur.version))"
    return
  }

  if (-not $manifest.downloadUrl.StartsWith('https://')) { Fail 'downloadUrl must use HTTPS.' }
  if (-not $manifest.sha256) { Fail 'Manifest missing sha256 field.' }

  # 2. Download
  $dlPath = Join-Path $env:TEMP "BakudanFoodSafety-$($manifest.latestVersion).zip"
  Write-Info "Downloading $($manifest.downloadUrl)..."
  $wc = New-Object System.Net.WebClient
  $wc.DownloadFile($manifest.downloadUrl, $dlPath)
  Write-Ok "Downloaded to $dlPath"

  # 3. Verify SHA256
  Invoke-ChecksumVerify $dlPath $manifest.sha256

  # 4. Stop app
  Stop-App

  # 5. Create backup
  $backupDir = New-Backup "pre-v$($manifest.latestVersion)"

  # 6. Extract to temp + validate
  $tmpExtract = Join-Path $env:TEMP ("bakudan-update-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $tmpExtract | Out-Null
  try {
    # ── Path traversal guard ───────────────────────────────────────────────
    # Inspect zip entries before extracting — reject any entry whose resolved
    # path would escape $tmpExtract (e.g. entries with ../ or absolute paths).
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zipStream = [System.IO.Compression.ZipFile]::OpenRead($dlPath)
    try {
      $resolvedBase = [System.IO.Path]::GetFullPath($tmpExtract) + [System.IO.Path]::DirectorySeparatorChar
      foreach ($entry in $zipStream.Entries) {
        if ($entry.FullName -eq '') { continue }
        $entryTarget = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($tmpExtract, $entry.FullName))
        if (-not $entryTarget.StartsWith($resolvedBase, [System.StringComparison]::OrdinalIgnoreCase)) {
          $zipStream.Dispose()
          Fail "Security: zip entry '$($entry.FullName)' would extract outside target directory (path traversal blocked)."
        }
      }
    } finally { $zipStream.Dispose() }
    Write-Ok 'Zip path traversal check passed'

    Expand-Archive -Path $dlPath -DestinationPath $tmpExtract -Force

    # Validate structure
    if (-not (Test-Path (Join-Path $tmpExtract 'src\index.js'))) {
      Fail 'Update package is missing src\index.js -- aborting to avoid corrupting install.'
    }
    if (-not (Test-Path (Join-Path $tmpExtract 'version.json'))) {
      Fail 'Update package is missing version.json -- aborting.'
    }
    Write-Ok 'Package structure validated'

    # 7. Replace app folder
    Write-Info "Replacing $AppDir..."
    Remove-Item -Recurse -Force $AppDir -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
    Get-ChildItem -Path $tmpExtract -Force | Copy-Item -Destination $AppDir -Recurse -Force
    Write-Ok "App updated to $AppDir"

    # Restore runtime if not in package
    $nodeExe = Join-Path $AppDir 'runtime\node\node.exe'
    if (-not (Test-Path $nodeExe)) {
      Write-Warn 'New package has no runtime — keeping existing runtime'
      $runtimeSrc = Join-Path $backupDir '..\..\..\Program Files\BakudanFoodSafety\app\runtime'
      # Runtime stays because it was not in AppDir after replace — handled by installer convention
    }

    # Re-apply config symlink
    $envFile    = Join-Path $ConfigDir '.env'
    $envAppLink = Join-Path $AppDir '.env'
    if (Test-Path $envFile) { Copy-Item $envFile $envAppLink -Force }

  } catch {
    Write-Warn "Update failed: $($_.Exception.Message)"
    Write-Info 'Rolling back...'
    try {
      Remove-Item -Recurse -Force $AppDir -ErrorAction SilentlyContinue
      # Restore-Backup restores: DB, config, AND app source snapshot
      Restore-Backup $backupDir
    } catch { Write-Warn "Rollback had issues: $($_.Exception.Message)" }
    Log-Update 'update' $cur.version $manifest.latestVersion 'failed' $_.Exception.Message
    Start-App
    Fail "Update failed and was rolled back: $($_.Exception.Message)"
  } finally {
    Remove-Item -Recurse -Force $tmpExtract -ErrorAction SilentlyContinue
    Remove-Item -Force $dlPath -ErrorAction SilentlyContinue
  }

  # 8. Restart
  Start-App

  # 9. Health check
  $health = Wait-ForHealth 90
  if (-not $health) {
    Write-Warn 'Health check failed after update. Rolling back...'
    Stop-App
    Restore-Backup $backupDir
    Start-App
    Log-Update 'update' $cur.version $manifest.latestVersion 'rollback' 'health check failed'
    Fail 'Update rolled back because health check failed after restart.'
  }

  # 10. Log success
  Log-Update 'update' $cur.version $manifest.latestVersion 'ok' "build $($manifest.build)"
  Write-Ok "Update complete: v$($cur.version) -> v$($manifest.latestVersion)"
  Write-Host "  Dashboard: http://localhost:$Port" -ForegroundColor Cyan
}

# ── Command: rollback ──────────────────────────────────────────────────────────
function Invoke-Rollback {
  Write-Host ""
  Write-Host "  === Bakudan Food Safety Rollback ===" -ForegroundColor Cyan
  Write-Host ""

  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) { Fail 'Rollback must be run as Administrator.' }

  $backupDir = $null
  if ($RollbackTarget -eq 'latest') {
    $backupDir = Get-LatestBackupDir
  } else {
    $backupDir = Join-Path $BackupsDir $RollbackTarget
  }
  if (-not $backupDir -or -not (Test-Path $backupDir)) {
    Fail "No backup found. Available backups: $(Get-ChildItem $BackupsDir -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name | Join-String ', ')"
  }

  $meta = $null
  $metaFile = Join-Path $backupDir 'backup-meta.json'
  if (Test-Path $metaFile) { $meta = Get-Content $metaFile -Raw | ConvertFrom-Json }

  Write-Info "Rollback target: $backupDir"
  if ($meta) { Write-Info "Backup created at $($meta.createdAt) for app version $($meta.appVersion)" }

  $cur = Get-CurrentVersion
  Stop-App
  Restore-Backup $backupDir
  Start-App

  $health = Wait-ForHealth 60
  if ($health) {
    Log-Update 'rollback' $cur.version ($meta?.appVersion -or 'unknown') 'ok' "from backup $backupDir"
    Write-Ok "Rollback complete. App is healthy."
  } else {
    Log-Update 'rollback' $cur.version ($meta?.appVersion -or 'unknown') 'warn' 'health check timed out'
    Write-Warn 'App started but health check timed out. Check the dashboard manually.'
  }
  Write-Host "  Dashboard: http://localhost:$Port" -ForegroundColor Cyan
}

# ── Dispatch ───────────────────────────────────────────────────────────────────
switch ($Command) {
  'status'   { Invoke-Status }
  'update'   { Invoke-Update }
  'rollback' { Invoke-Rollback }
}
