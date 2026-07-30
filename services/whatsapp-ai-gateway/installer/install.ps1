param(
  [switch]$Silent
)
$ErrorActionPreference = 'Stop'

# ── Paths ─────────────────────────────────────────────────────────────────────
$AppRoot       = 'C:\Program Files\BakudanFoodSafety'
$AppDir        = Join-Path $AppRoot 'app'
$UpdaterDir    = Join-Path $AppRoot 'updater'
$DataRoot      = 'C:\ProgramData\BakudanFoodSafety'
$DataDir       = Join-Path $DataRoot 'data'
$DbDir         = Join-Path $DataRoot 'db'
$UploadsDir    = Join-Path $DataRoot 'uploads'
$LogsDir       = Join-Path $DataRoot 'logs'
$ConfigDir     = Join-Path $DataRoot 'config'
$BackupsDir    = Join-Path $DataRoot 'backups'
$WhatsAppDir   = Join-Path $DataRoot 'whatsapp'
$AuthDir       = Join-Path $WhatsAppDir 'auth'
$CacheDir      = Join-Path $WhatsAppDir 'cache'

$Port          = 3210
$TaskName      = 'BakudanFoodSafety'
$SourceDir     = Join-Path $PSScriptRoot 'source'
$DefaultUpdateManifestUrl = 'https://raw.githubusercontent.com/liemdo28/bakudan-releases/main/update-manifest.json'
# Accept BakudanFoodSafety-app.zip first, then fall back to any *.zip in source/
$SourceZip = Join-Path $SourceDir 'BakudanFoodSafety-app.zip'
if (-not (Test-Path $SourceZip)) {
  $found = Get-ChildItem -Path $SourceDir -Filter '*.zip' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
  if ($found) { $SourceZip = $found.FullName }
}
$RuntimeDir    = Join-Path $PSScriptRoot 'runtime'
$NodeZip       = Join-Path $RuntimeDir 'node-v24.14.1-win-x64.zip'
$ChromeDir     = Join-Path $RuntimeDir 'chrome-win64'
$DashboardUrl  = "http://localhost:$Port"

# ── Helpers ───────────────────────────────────────────────────────────────────
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  [..] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Fail($msg) {
  Write-Host ""
  Write-Host "  [FAIL] $msg" -ForegroundColor Red
  Write-Host ""
  throw $msg
}

function Invoke-Step($label, [scriptblock]$block) {
  Write-Host ""
  Write-Host "  -- $label" -ForegroundColor White
  & $block
}

function New-Shortcut($name, $target, $workDir) {
  $wsh = New-Object -ComObject WScript.Shell
  foreach ($loc in @(
    [Environment]::GetFolderPath('Desktop'),
    (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\Bakudan Food Safety')
  )) {
    try {
      New-Item -ItemType Directory -Force -Path $loc | Out-Null
      $lnk = $wsh.CreateShortcut((Join-Path $loc "$name.lnk"))
      $lnk.TargetPath       = $target
      $lnk.WorkingDirectory = $workDir
      $lnk.Save()
    } catch { Write-Warn "Shortcut '$name' in '$loc': $($_.Exception.Message)" }
  }
}

function Wait-ForHealth($seconds) {
  Write-Info "Waiting up to ${seconds}s for health..."
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-RestMethod -Uri "$DashboardUrl/api/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
      if ($r.ok -eq $true) { return $r }
    } catch {}
    Start-Sleep -Seconds 3
  }
  return $null
}

function Set-EnvLine($content, $key, $value) {
  $line = "$key=$value"
  if ($content -match "(?m)^$([regex]::Escape($key))=") {
    return ($content -replace "(?m)^$([regex]::Escape($key))=.*", $line)
  }
  return ($content.TrimEnd() + "`r`n$line`r`n")
}

function Preserve-LegacyWhatsAppSession($existingAppDir) {
  if (-not (Test-Path $existingAppDir)) { return }
  $sessionSources = @(
    @{ Source = (Join-Path $existingAppDir '.wwebjs_auth'); Target = $AuthDir },
    @{ Source = (Join-Path $existingAppDir '.wwebjs_cache'); Target = $CacheDir },
    @{ Source = (Join-Path $existingAppDir 'data\session'); Target = $AuthDir },
    @{ Source = (Join-Path $DataRoot '.wwebjs_auth'); Target = $AuthDir },
    @{ Source = (Join-Path $DataRoot '.wwebjs_cache'); Target = $CacheDir }
  )
  foreach ($item in $sessionSources) {
    if ((Test-Path $item.Source) -and -not (Test-Path $item.Target)) {
      try {
        New-Item -ItemType Directory -Force -Path $item.Target | Out-Null
        Copy-Item -Path (Join-Path $item.Source '*') -Destination $item.Target -Recurse -Force -ErrorAction Stop
        Write-Ok "Preserved WhatsApp session from $($item.Source)"
      } catch {
        Write-Warn "Could not preserve WhatsApp session from $($item.Source): $($_.Exception.Message)"
      }
    }
  }
}

# ── Main ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   Bakudan Food Safety -- Windows Installer"   -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  App folder  : $AppDir"
Write-Host "  Data folder : $DataRoot"
Write-Host ""

try {
  Invoke-Step 'Checking Windows + Administrator' {
    if ([Environment]::OSVersion.Platform -ne 'Win32NT') { Fail 'This installer only supports Windows.' }
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) { Fail 'Please run as Administrator (right-click -> Run as administrator).' }
    Write-Ok 'Windows + Administrator'
  }

  Invoke-Step 'Checking bundled runtime' {
    if (-not (Test-Path $NodeZip)) { Fail "Bundled Node.js not found: $NodeZip" }
    if (-not (Test-Path (Join-Path $ChromeDir 'chrome.exe'))) { Fail "Bundled Chrome not found in: $ChromeDir" }
    Write-Ok 'Node.js + Chrome bundled'
  }

  Invoke-Step 'Checking source package' {
    if (-not (Test-Path $SourceZip)) { Fail "App source not found: $SourceZip" }
    Write-Ok "Source: $SourceZip"
  }

  Invoke-Step 'Creating data folders (ProgramData -- never deleted on update)' {
    foreach ($d in @($DataRoot, $DataDir, $DbDir, $UploadsDir, $LogsDir, $ConfigDir, $BackupsDir, $WhatsAppDir, $AuthDir, $CacheDir)) {
      New-Item -ItemType Directory -Force -Path $d | Out-Null
    }
    Write-Ok "Data ready under $DataRoot"
  }

  Invoke-Step 'Installing app to Program Files' {
    if (Test-Path $AppDir) {
      if (-not $Silent) {
        $ans = Read-Host '  App folder exists. Overwrite (update)? [Y/N]'
        if ($ans -notmatch '^(Y|y)$') { Fail 'Install cancelled.' }
      }
      $sc = Join-Path $AppDir 'scripts\windows\stop-gateway.ps1'
      if (Test-Path $sc) { try { powershell.exe -NoProfile -ExecutionPolicy Bypass -File $sc 2>$null | Out-Null } catch {} }
      Preserve-LegacyWhatsAppSession $AppDir
      Remove-Item -Recurse -Force $AppDir -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
    $tmp = Join-Path $env:TEMP ("bakudan-install-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    try {
      Expand-Archive -Path $SourceZip -DestinationPath $tmp -Force
      Get-ChildItem -Path $tmp -Force | Copy-Item -Destination $AppDir -Recurse -Force
    } finally {
      Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
    }
    Write-Ok "App at $AppDir"
  }

  Invoke-Step 'Installing runtime (Node.js + Chrome)' {
    $nodeDestDir = Join-Path $AppDir 'runtime\node'
    if (-not (Test-Path (Join-Path $nodeDestDir 'node.exe'))) {
      New-Item -ItemType Directory -Force -Path $nodeDestDir | Out-Null
      $tmp = Join-Path $env:TEMP ("node-" + [guid]::NewGuid().ToString('N'))
      Expand-Archive -Path $NodeZip -DestinationPath $tmp -Force
      $inner = Get-ChildItem -Path $tmp -Directory | Select-Object -First 1
      if ($inner) { Copy-Item (Join-Path $inner.FullName '*') $nodeDestDir -Recurse -Force }
      Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
    }
    $chromeDestDir = Join-Path $AppDir 'runtime\chrome-win64'
    if (-not (Test-Path (Join-Path $chromeDestDir 'chrome.exe'))) {
      Copy-Item -Path $ChromeDir -Destination (Join-Path $AppDir 'runtime') -Recurse -Force
    }
    $nodeVer = & (Join-Path $nodeDestDir 'node.exe') -v 2>&1
    Write-Ok "Node.js $nodeVer + Chrome ready"
  }

  Invoke-Step 'Configuring environment' {
    $envFile     = Join-Path $ConfigDir '.env'
    $envExample  = Join-Path $AppDir '.env.example'
    $envAppLink  = Join-Path $AppDir '.env'
    if (-not (Test-Path $envFile)) {
      if (Test-Path $envExample) {
        Copy-Item $envExample $envFile -Force
      } else {
        Set-Content -Path $envFile -Value @"
DASHBOARD_PORT=3210
DATA_DIR=$DataDir
DB_PATH=$DbDir\gateway.db
UPLOADS_DIR=$UploadsDir
LOG_DIR=$LogsDir
"@
      }
    }
    # Always ensure app folder has .env pointing to ProgramData paths
    $envContent = Get-Content $envFile -Raw
    $envContent = Set-EnvLine $envContent 'DATA_DIR' $DataDir
    $envContent = Set-EnvLine $envContent 'DB_PATH' "$DbDir\gateway.db"
    $envContent = Set-EnvLine $envContent 'UPLOADS_DIR' $UploadsDir
    $envContent = Set-EnvLine $envContent 'LOG_DIR' $LogsDir
    $envContent = Set-EnvLine $envContent 'STARTUP_MODE' 'normal'
    $envContent = Set-EnvLine $envContent 'WHATSAPP_SESSION_ROOT' $WhatsAppDir
    $envContent = Set-EnvLine $envContent 'SESSION_DIR' $AuthDir
    $envContent = Set-EnvLine $envContent 'WWEBJS_CACHE_DIR' $CacheDir
    $envContent = Set-EnvLine $envContent 'WHATSAPP_CLIENT_ID' 'bakudan-food-safety'
    $envContent = Set-EnvLine $envContent 'WHATSAPP_HEADLESS' 'false'
    $envContent = Set-EnvLine $envContent 'WHATSAPP_AUTH_TIMEOUT_MS' '120000'
    $envContent = Set-EnvLine $envContent 'WHATSAPP_QR_MAX_RETRIES' '0'
    $envContent = Set-EnvLine $envContent 'WHATSAPP_TAKEOVER_ON_CONFLICT' 'true'
    $envContent = Set-EnvLine $envContent 'WWEBJS_REMOTE_WEB_CACHE' 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html'
    # Inject mi-core update source if not already set. New laptops can pull
    # future app updates from this manifest instead of receiving copied source.
    if ($envContent -notmatch '(?m)^UPDATE_SOURCE=') {
      $envContent += "`r`n# Auto-Updater`r`nUPDATE_SOURCE=mi-core`r`n"
    }
    if ($envContent -notmatch '(?m)^MI_CORE_UPDATE_MANIFEST_URL=') {
      $envContent += "MI_CORE_UPDATE_MANIFEST_URL=$DefaultUpdateManifestUrl`r`n"
    }
    if ($envContent -notmatch '(?m)^UPDATE_MANIFEST_URL=') {
      $envContent += "UPDATE_MANIFEST_URL=$DefaultUpdateManifestUrl`r`n"
    }
    if ($envContent -notmatch '(?m)^UPDATE_CHECK_INTERVAL_HOURS=') {
      $envContent += "UPDATE_CHECK_INTERVAL_HOURS=6`r`n"
    }
    Set-Content -Path $envFile -Value $envContent
    Copy-Item $envFile $envAppLink -Force
    Write-Ok "Config at $envFile"
    Write-Ok "mi-core update manifest: $DefaultUpdateManifestUrl"
  }

  Invoke-Step 'Verifying bundled node_modules' {
    $nm = Join-Path $AppDir 'node_modules'
    if (-not (Test-Path (Join-Path $nm 'express'))) { Fail 'node_modules missing -- use the production installer package.' }
    $sqlite = Get-ChildItem -Path (Join-Path $nm 'sqlite3') -Filter 'node_sqlite3.node' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $sqlite) { Fail 'sqlite3 native module missing -- use the production installer package.' }
    Write-Ok 'Dependencies verified'
  }

  Invoke-Step 'Copying updater' {
    $updaterSrc = Join-Path $PSScriptRoot '..\updater'
    if (Test-Path $updaterSrc) {
      New-Item -ItemType Directory -Force -Path $UpdaterDir | Out-Null
      Copy-Item (Join-Path $updaterSrc '*') $UpdaterDir -Recurse -Force
      Write-Ok "Updater at $UpdaterDir"
    } else {
      Write-Warn 'Updater folder not found -- skipping'
    }
  }

  Invoke-Step 'Creating shortcuts (Desktop + Start Menu)' {
    $nodeExe   = Join-Path $AppDir 'runtime\node\node.exe'
    $chromeExe = Join-Path $AppDir 'runtime\chrome-win64\chrome.exe'

    $startBat = Join-Path $AppDir 'Start Gateway.bat'
    $stopBat  = Join-Path $AppDir 'Stop Gateway.bat'
    $dashBat  = Join-Path $AppDir 'Open Dashboard.bat'

    Set-Content -Path $startBat -Value "@echo off`r`ncd /d `"$AppDir`"`r`nset PUPPETEER_EXECUTABLE_PATH=$chromeExe`r`nset CHROME_PATH=$chromeExe`r`n`"$nodeExe`" src\index.js`r`npause"
    Set-Content -Path $stopBat  -Value "@echo off`r`nfor /f `"tokens=5`" %%a in ('netstat -aon ^| find `":$Port`"') do taskkill /F /PID %%a 2>nul`r`necho Gateway stopped."
    Set-Content -Path $dashBat  -Value "@echo off`r`nstart http://localhost:$Port"

    New-Shortcut 'Start Bakudan Gateway'   $startBat $AppDir
    New-Shortcut 'Stop Bakudan Gateway'    $stopBat  $AppDir
    New-Shortcut 'Open Bakudan Dashboard'  $dashBat  $AppDir

    $updateBat = Join-Path $UpdaterDir 'Update App.bat'
    if (Test-Path $UpdaterDir) {
      if (-not (Test-Path $updateBat)) {
        Set-Content -Path $updateBat -Value "@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$UpdaterDir\bakudan-updater.ps1`" update`r`npause"
      }
      New-Shortcut 'Update Bakudan App' $updateBat $UpdaterDir
    }
    Write-Ok 'Shortcuts created'
  }

  Invoke-Step 'Installing Windows auto-start scheduled task' {
    try {
      $nodeExe   = Join-Path $AppDir 'runtime\node\node.exe'
      $chromeExe = Join-Path $AppDir 'runtime\chrome-win64\chrome.exe'
      $watchdog  = Join-Path $AppDir 'scripts\watchdog.ps1'

      # Use watchdog script if available, otherwise run node directly
      if (Test-Path $watchdog) {
        $exe = 'powershell.exe'
        $arg = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watchdog`""
      } else {
        $psCmd = "Set-Location '$AppDir'; `$env:PUPPETEER_EXECUTABLE_PATH='$chromeExe'; `$env:CHROME_PATH='$chromeExe'; & '$nodeExe' 'src/index.js'"
        $exe = 'powershell.exe'
        $arg = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"$psCmd`""
      }

      $action = New-ScheduledTaskAction -Execute $exe -Argument $arg -WorkingDirectory $AppDir

      # AtStartup (boot) + AtLogon — fires whichever comes first
      $triggerBoot  = New-ScheduledTaskTrigger -AtStartup
      $triggerBoot.Delay = 'PT45S'   # wait 45s for network/services
      $triggerLogon = New-ScheduledTaskTrigger -AtLogOn
      $triggerLogon.Delay = 'PT10S'

      # RunLevel Highest = runs with full admin rights, no UAC popup
      $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

      $settings = New-ScheduledTaskSettingsSet `
        -RestartCount 99 `
        -RestartInterval (New-TimeSpan -Minutes 2) `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
        -MultipleInstances IgnoreNew `
        -StartWhenAvailable

      Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger @($triggerBoot, $triggerLogon) `
        -Principal $principal `
        -Settings $settings `
        -Force | Out-Null

      Write-Ok "Auto-start task '$TaskName' registered (boot + logon, SYSTEM, RestartCount=99)"
    } catch {
      Write-Warn "Auto-start task failed: $($_.Exception.Message)"
      Write-Warn "App will still start manually via shortcut."
    }
  }

  Invoke-Step 'Starting app' {
    $nodeExe   = Join-Path $AppDir 'runtime\node\node.exe'
    $chromeExe = Join-Path $AppDir 'runtime\chrome-win64\chrome.exe'
    $psCmd = "Set-Location '$AppDir'; `$env:PUPPETEER_EXECUTABLE_PATH='$chromeExe'; `$env:CHROME_PATH='$chromeExe'; & '$nodeExe' 'src/index.js'"
    Start-Process 'powershell.exe' -ArgumentList @('-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-Command', $psCmd) -WorkingDirectory $AppDir
    Write-Ok 'App started in background'
  }

  Invoke-Step 'Health check' {
    $health = Wait-ForHealth 120
    if ($health) {
      Write-Ok "Health OK -- version $($health.version), build $($health.build_id)"
    } else {
      Write-Warn 'App did not respond within 120s.'
      Write-Warn "Open manually: $DashboardUrl"
    }
  }

  Invoke-Step 'Opening dashboard' {
    Start-Process $DashboardUrl
    Write-Ok 'Dashboard opened'
  }

  Write-Host ""
  Write-Host "  ============================================" -ForegroundColor Green
  Write-Host "   Install complete!"                          -ForegroundColor Green
  Write-Host "  ============================================" -ForegroundColor Green
  Write-Host ""
  Write-Host "  Dashboard : $DashboardUrl"
  Write-Host "  App       : $AppDir"
  Write-Host "  Data      : $DataRoot"
  Write-Host ""
  Write-Host "  Next steps:"
  Write-Host "  1. If WhatsApp shows QR code -- scan with store phone."
  Write-Host "  2. Place Google credentials at:"
  Write-Host "     $ConfigDir\google-service-account.json"
  Write-Host "  3. Use Desktop shortcuts to start/stop/update."
  Write-Host ""
  exit 0
} catch {
  Write-Host ""
  Write-Host "  [FAIL] $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "  Fix the issue above, then run the installer again."
  Write-Host ""
  exit 1
}
