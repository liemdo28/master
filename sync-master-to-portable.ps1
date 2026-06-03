<#
.SYNOPSIS
    Sync E:\Project\Master  →  F:\Projects  (ONE-WAY, Master is authoritative)

.DESCRIPTION
    Mirrors all active projects from E:\Project\Master to F:\Projects.
    Excludes heavy/generated directories: node_modules, vendor, dist, build, etc.
    Never deletes from F — only adds/updates files.

.PARAMETER DryRun
    Preview what would be synced without making any changes.

.PARAMETER ProjectFilter
    Sync only projects matching this name pattern (wildcard supported).
    Example: -ProjectFilter "bakudan*"

.PARAMETER Force
    Skip confirmation prompt.

.EXAMPLE
    .\sync-master-to-portable.ps1
    .\sync-master-to-portable.ps1 -DryRun
    .\sync-master-to-portable.ps1 -ProjectFilter "agent-coding"
#>

param(
    [switch]$DryRun,
    [string]$ProjectFilter = "*",
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

# ── Config ────────────────────────────────────────────────────────────────────
$MASTER   = "E:\Project\Master"
$PORTABLE = "F:\Projects"
$LOG_FILE = "$MASTER\sync-log-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"

# Directories to EXCLUDE from sync (never copy these)
$EXCLUDES = @(
    "node_modules"
    "vendor"
    "dist"
    "build"
    ".next"
    "coverage"
    "logs"
    "log"
    "tmp"
    "temp"
    "cache"
    ".cache"
    "__pycache__"
    ".pytest_cache"
    "*.pyc"
    ".wrangler"
    ".parcel-cache"
    "out"
    "target"
    ".gradle"
    "releases"   # Flutter build releases
)

# ── Project map: E path → F destination name ─────────────────────────────────
# Format: @{ ERelPath = "F destination folder name" }
$PROJECT_MAP = [ordered]@{
    # Bakudan Group
    "Bakudan\bakudanramen.com-current"    = "bakudanramen.com"
    "Bakudan\dashboard.bakudanramen.com"  = "dashboard.bakudanramen.com"
    "Bakudan\growth-dashboard"            = "growth-dashboard"
    "Bakudan\packing-list"                = "packinglist-price"
    "Bakudan\mobile_taskflow"             = "mobile_taskflow"
    "Bakudan\review-automation-system"    = "review-automation-system"
    "Bakudan\integration-system"          = "integration-system"

    # Agent Group
    "agent-coding"                        = "agent-coding"
    "agent-coding-api-keys"               = "agent-coding-api-keys"

    # QA Group
    "QA\qa-system"                        = "qa-system"
    "QA\qa_runner"                        = "qa_runner"

    # RawSushi
    "RawSushi\RawWebsite"                 = "rawsushibar"

    # Other
    "Other\LinkTreeHL"                    = "LinkTreeHL"
}

# ── Helpers ───────────────────────────────────────────────────────────────────
$Stats = @{ Synced = 0; Skipped = 0; Failed = 0; BytesCopied = 0 }

function Write-Log {
    param([string]$Msg, [string]$Color = "White")
    $ts = Get-Date -Format "HH:mm:ss"
    $line = "[$ts] $Msg"
    Write-Host $line -ForegroundColor $Color
    Add-Content -Path $LOG_FILE -Value $line -Encoding UTF8
}

function Format-Size {
    param([long]$Bytes)
    if ($Bytes -ge 1GB) { return "{0:N1} GB" -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return "{0:N1} MB" -f ($Bytes / 1MB) }
    if ($Bytes -ge 1KB) { return "{0:N1} KB" -f ($Bytes / 1KB) }
    return "$Bytes B"
}

function Build-RobocopyExcludes {
    $dirs  = $EXCLUDES | Where-Object { $_ -notmatch '\*' }
    $files = $EXCLUDES | Where-Object { $_ -match '\*' }
    return @{
        Dirs  = $dirs
        Files = $files
    }
}

function Sync-Project {
    param(
        [string]$SrcPath,
        [string]$DstPath,
        [string]$Name
    )

    if (-not (Test-Path $SrcPath)) {
        Write-Log "  ✗  $Name — source not found: $SrcPath" "Red"
        $Stats.Failed++
        return
    }

    $excl = Build-RobocopyExcludes
    $robocopyArgs = @(
        $SrcPath, $DstPath,
        "/E",           # copy subdirectories including empty ones
        "/DCOPY:DAT",   # copy dir timestamps
        "/COPY:DAT",    # copy data, attributes, timestamps
        "/R:1",         # 1 retry on fail
        "/W:2",         # 2 second wait between retries
        "/NP",          # no progress (cleaner output)
        "/NDL",         # no dir listing
        "/NFL",         # no file listing (use /LOG for details)
        "/XD"           # exclude dirs (must come before dir list)
    ) + $excl.Dirs

    if ($excl.Files.Count -gt 0) {
        $robocopyArgs += "/XF"
        $robocopyArgs += $excl.Files
    }

    if ($DryRun) {
        $robocopyArgs += "/L"   # list only, no copy
        Write-Log "  →  [DRY] $Name" "Cyan"
        Write-Log "       $SrcPath  →  $DstPath" "DarkGray"
        & robocopy @robocopyArgs | Where-Object { $_ -match "^\s+[\*\+\-]" } | ForEach-Object {
            Write-Log "       $_" "DarkGray"
        }
    } else {
        Write-Log "  →  Syncing: $Name" "Yellow"
        Write-Log "       $SrcPath  →  $DstPath" "DarkGray"
        $result = & robocopy @robocopyArgs
        $rc = $LASTEXITCODE

        # Robocopy exit codes: 0=no change, 1=files copied, 2=extra, 3=1+2, 4=mismatches, 8+=errors
        if ($rc -le 3) {
            Write-Log "  ✓  $Name — done (exit $rc)" "Green"
            $Stats.Synced++
        } else {
            Write-Log "  ✗  $Name — robocopy error (exit $rc)" "Red"
            $Stats.Failed++
        }
    }
}

# ── Main ──────────────────────────────────────────────────────────────────────
Write-Log "═══════════════════════════════════════════════════════" "Cyan"
Write-Log "  MASTER → PORTABLE SYNC" "Cyan"
Write-Log "  Master:   $MASTER" "Cyan"
Write-Log "  Portable: $PORTABLE" "Cyan"
Write-Log "  Mode:     $(if ($DryRun) { 'DRY RUN' } else { 'LIVE SYNC' })" "Cyan"
Write-Log "  Filter:   $ProjectFilter" "Cyan"
Write-Log "═══════════════════════════════════════════════════════" "Cyan"

# Verify drives
if (-not (Test-Path $MASTER))   { Write-Log "ERROR: Master path not found: $MASTER" "Red"; exit 1 }
if (-not (Test-Path $PORTABLE)) { Write-Log "ERROR: Portable path not found: $PORTABLE" "Red"; exit 1 }

# Confirm if not forced and not dry run
if (-not $DryRun -and -not $Force) {
    Write-Log ""
    $confirm = Read-Host "  Proceed with LIVE sync E → F? (yes/no)"
    if ($confirm -ne "yes") { Write-Log "Aborted." "Yellow"; exit 0 }
}

Write-Log ""
Write-Log "Syncing $(($PROJECT_MAP.Keys | Where-Object { $_ -like $ProjectFilter }).Count) projects..." "White"
Write-Log ""

foreach ($entry in $PROJECT_MAP.GetEnumerator()) {
    $srcRel  = $entry.Key
    $dstName = $entry.Value

    # Apply filter
    if ($dstName -notlike $ProjectFilter) { continue }

    $srcAbs = Join-Path $MASTER $srcRel
    $dstAbs = Join-Path $PORTABLE $dstName

    Sync-Project -SrcPath $srcAbs -DstPath $dstAbs -Name $dstName
}

# ── Also sync F-only projects back as a warning ───────────────────────────────
Write-Log ""
Write-Log "── Checking F-only projects (not in Master) ───────────" "Yellow"
$F_ONLY = @("phuyen-2026", "authorize-net-backup", "Tester-QA", "shared-workspace", "guidline-record")
foreach ($proj in $F_ONLY) {
    $p = Join-Path $PORTABLE $proj
    if (Test-Path $p) {
        Write-Log "  ⚠  F-only: $proj — NOT in Master. Run copy-f-only-to-master.ps1 to migrate." "Yellow"
    }
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Log ""
Write-Log "═══════════════════════════════════════════════════════" "Cyan"
Write-Log "  SYNC COMPLETE" "Cyan"
Write-Log "  Synced:  $($Stats.Synced)" "Green"
Write-Log "  Skipped: $($Stats.Skipped)" "White"
Write-Log "  Failed:  $($Stats.Failed)" "$(if ($Stats.Failed -gt 0) { 'Red' } else { 'White' })"
Write-Log "  Log:     $LOG_FILE" "DarkGray"
Write-Log "═══════════════════════════════════════════════════════" "Cyan"
