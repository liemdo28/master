# Phase 0 baseline collector for Mi Company OS Master path
# Generates all required baseline evidence files into _audit\MI_MASTER_BASELINE_<ts>\
[CmdletBinding()]
param()
$ErrorActionPreference = 'SilentlyContinue'
$root   = 'd:\Project\Master'
$marker = Join-Path $root '_audit\.current_baseline'
$b      = (Get-Content $marker).Trim()
$out    = Join-Path $root $b
New-Item -ItemType Directory -Force -Path $out | Out-Null
$ts     = Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'

function Save($name, $lines) {
    $p = Join-Path $out $name
    Set-Content -Path $p -Value $lines -Encoding utf8
    Write-Output "  wrote $name ($(@($lines).Count) lines)"
}

Write-Output "[baseline] collecting into $out @ $ts"

# 1. MASTER_TREE_BEFORE.txt (top 3 levels, no node_modules/.git/dist)
Add-Content -Path $out\MASTER_TREE_BEFORE.txt -Value "MI MASTER TREE (depth 3, excluding node_modules/.git/dist/.next) - $ts"
Get-ChildItem -Path $root -Directory | Where-Object { $_.Name -notin @('node_modules','.git') } | ForEach-Object {
    $d1 = $_.FullName
    Add-Content $out\MASTER_TREE_BEFORE.txt "[D] $($_.Name)"
    Get-ChildItem -Path $d1 -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -notin @('node_modules','.git','dist','.next','__pycache__') } | ForEach-Object {
        Add-Content $out\MASTER_TREE_BEFORE.txt ("    [D] " + $_.Name)
        Get-ChildItem -Path $_.FullName -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -notin @('node_modules','.git','dist','.next','__pycache__') } | ForEach-Object {
            Add-Content $out\MASTER_TREE_BEFORE.txt ("        [D] " + $_.Name)
        }
    }
}
Write-Output "  wrote MASTER_TREE_BEFORE.txt"

# 2. GIT_REPOSITORIES.csv
$git = @("path,remote,branch,head_commit,dirty")
Get-ChildItem -Path $root -Recurse -Directory -Filter '.git' -ErrorAction SilentlyContinue | ForEach-Object {
    $repo = $_.Parent.FullName
    $remote = (git -C $repo remote get-url origin 2>$null)
    $branch = (git -C $repo branch --show-current 2>$null)
    $head   = (git -C $repo rev-parse --short HEAD 2>$null)
    $dirty  = if ((git -C $repo status --porcelain 2>$null)) { 'dirty' } else { 'clean' }
    $rel    = $repo.Substring($root.Length).TrimStart('\')
    $git   += "$rel,$remote,$branch,$head,$dirty"
}
Save 'GIT_REPOSITORIES.csv' $git

# 3. ACTIVE_SERVICES.md
$svc = @("# ACTIVE SERVICES SNAPSHOT - $ts","","## PM2")
$svc += "``````"
(pm2 jlist 2>$null | ConvertFrom-Json | ForEach-Object { "{0,-30} {1,-10} pid={2}" -f $_.name, $_.status, $_.pid }) | ForEach-Object { $svc += $_ }

$svc += "``````"
$svc += "## Listening ports of interest (4001=Mi-Core, 3211=WhatsApp, 11434=Ollama)"
$ports = netstat -ano | Select-String 'LISTENING' | Select-String ':4001|:3211|:11434|:5678|:3306'
if (-not $ports) { $svc += "(none of the key Mi ports are currently LISTENING)" }
else { $ports | ForEach-Object { $svc += $_.Line.Trim() } }
$svc += "","## Windows services (Mi/Jarvis/Ollama/Tailscale)"
(Get-Service | Where-Object { $_.Name -match 'Ollama|Tailscale|Jarvis|MiCore|mi-core' -or $_.DisplayName -match 'Ollama|Tailscale' }) | ForEach-Object { $svc += ("- {0,-30} {1}" -f $_.Name, $_.Status) }
Save 'ACTIVE_SERVICES.md' $svc

# 4. PORT_REGISTRY.md
$p = @("# PORT REGISTRY - $ts","","port | proto | state | pid | process")
$listen = netstat -ano | Select-String 'LISTENING'
$listen | ForEach-Object {
    $line = $_.Line.Trim() -split '\s+'
    if ($line.Count -ge 4) { $p += "$($line[1]) | $($line[0]) | $($line[3]) | $($line[-1])" }
}
Save 'PORT_REGISTRY.md' $p

# 5. ENVIRONMENT_INVENTORY.md
$env = @("# ENVIRONMENT FILE INVENTORY - $ts","","path | exists | size")
Get-ChildItem -Path $root -Recurse -File -Include '.env','.env.local','.env.example','*.env' -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.git\\' } |
  ForEach-Object { $env += "$($_.FullName.Substring($root.Length)) | exists | $($_.Length)" }
Save 'ENVIRONMENT_INVENTORY.md' $env

# 6. DATABASE_INVENTORY.md
$db = @("# DATABASE INVENTORY - $ts","","path | size_KB")
Get-ChildItem -Path $root -Recurse -File -Include '*.db','*.sqlite','*.sqlite3' -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.git\\' } |
  ForEach-Object { $db += "$($_.FullName.Substring($root.Length)) | {0:N0}" -f ($_.Length/1KB) }
Save 'DATABASE_INVENTORY.md' $db

# 7. LARGE_FILES_REPORT.md (top 50 > 25MB)
$lf = @("# LARGE FILES REPORT (>25MB, top 50, excl node_modules/.git) - $ts","")
Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.git\\' -and $_.Length -gt 25MB } |
  Sort-Object Length -Descending | Select-Object -First 50 |
  ForEach-Object { $lf += ("{0,8:N1} MB  {1}" -f ($_.Length/1MB), $_.FullName.Substring($root.Length)) }
Save 'LARGE_FILES_REPORT.md' $lf

# 8. TEMP_FILES_REPORT.md
$tmp = @("# TEMP / CACHE / BUILD-ARTIFACT CANDIDATES - $ts","")
Get-ChildItem -Path $root -Recurse -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -in @('__pycache__','logs','cache','.cache','.tmp','tmp','temp','.parcel-cache') -or $_.Name -match 'Traces$|playwright-?' } |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.git\\' } |
  ForEach-Object {
    try { $sz = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum } catch { $sz = 0 }
    $tmp += ("{0,9:N1} MB  {1}" -f ($sz/1MB), $_.FullName.Substring($root.Length))
  }
Save 'TEMP_FILES_REPORT.md' $tmp

# 9. DUPLICATE_CANDIDATES.md
$dup = @("# DUPLICATE CANDIDATE DIRECTORIES - $ts","")
Get-ChildItem -Path $root -Directory | Where-Object { $_.Name -notin @('node_modules','.git') } | ForEach-Object {
    $dup += ("- " + $_.Name)
}
Save 'DUPLICATE_CANDIDATES.md' $dup

# 10. SECURITY_RISK_INITIAL.md
$sec = @("# SECURITY RISK INITIAL SCAN - $ts","",
  "NOTE: This is a surface scan. No file contents were exfiltrated.","",
  "## Committed-secret risk (potential secret patterns tracked by git)")
$tracked = git -C $root ls-files 2>$null | Where-Object { $_ -match '\.env$|client_secret|token\.json|auth-state\.json|session\.json|machine_token|cookies' }
if (-not $tracked) { $sec += "(none matched in tracked files)" } else { $tracked | ForEach-Object { $sec += "- $_" } }
$sec += "","## Untracked .env / secret-like files (NOT committed - good)"
Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '\.env$|client_secret|token\.json|machine_token' -and $_.FullName -notmatch '\\node_modules\\|\\\.git\\' } |
  ForEach-Object { $sec += "- " + $_.FullName.Substring($root.Length) }
Save 'SECURITY_RISK_INITIAL.md' $sec

# 11. STARTUP_AUTOMATION.md
$st = @("# STARTUP / AUTOMATION INVENTORY - $ts","",
  "## ecosystem configs at root","")
Get-ChildItem -Path $root -File | Where-Object { $_.Name -match 'ecosystem' } | ForEach-Object { $st += "- " + $_.Name }
$st += "","## autostart .bat / .ps1 at root"
Get-ChildItem -Path $root -File | Where-Object { $_.Name -match 'autostart|install-hyperv' } | ForEach-Object { $st += "- " + $_.Name }
$st += "","## Windows Task Scheduler tasks (Mi/Jarvis/Ollama)"
(schtasks /query /fo csv 2>$null | Select-String 'Mi|Jarvis|Ollama|master') | ForEach-Object { $st += ("- " + $_.Line) }
Save 'STARTUP_AUTOMATION.md' $st

Write-Output "[baseline] DONE. Files in $out"

