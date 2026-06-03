<#
.SYNOPSIS
    Copy F-only projects → E:\Project\Master (Phase 7 — import missing projects)

.DESCRIPTION
    Copies projects that exist only on F:\Projects into their correct location
    in E:\Project\Master. Used to ensure E stays as the true master source.

.PARAMETER DryRun
    Preview moves without writing.
#>

param([switch]$DryRun)

$MASTER   = "E:\Project\Master"
$PORTABLE = "F:\Projects"

# F-only projects and their destination in E
$IMPORT_MAP = @{
    "phuyen-2026"         = "Other\phuyen-2026"          # Active: Phú Yên travel bot
    "authorize-net-backup"= "Bakudan\authorize-net-backup"  # Backup utility
    "Tester-QA"           = "QA\Tester-QA"               # Internal QA system
    "shared-workspace"    = "Agent\shared-workspace"     # Shared infra
    "guidline-record"     = "Bakudan\_docs\guidline-record" # Dashboard docs
}

$EXCLUDES = @("node_modules","vendor","dist","build","__pycache__","logs","tmp","cache",".cache")

Write-Host "`n  IMPORT F-ONLY PROJECTS → E (MASTER)`n" -ForegroundColor Cyan
Write-Host "  Mode: $(if ($DryRun) {'DRY RUN'} else {'LIVE'})`n" -ForegroundColor $(if ($DryRun) {"Yellow"} else {"Green"})

foreach ($entry in $IMPORT_MAP.GetEnumerator()) {
    $srcName = $entry.Key
    $dstRel  = $entry.Value
    $srcAbs  = Join-Path $PORTABLE $srcName
    $dstAbs  = Join-Path $MASTER $dstRel

    if (-not (Test-Path $srcAbs)) {
        Write-Host "  ·  $srcName — not found on F, skip" -ForegroundColor DarkGray
        continue
    }

    if (Test-Path $dstAbs) {
        Write-Host "  ·  $srcName — already exists in E at $dstRel" -ForegroundColor DarkGray
        continue
    }

    Write-Host "  →  $srcName  →  $dstRel" -ForegroundColor Yellow

    if (-not $DryRun) {
        # Ensure parent dir
        $parent = Split-Path $dstAbs -Parent
        if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }

        $args = @($srcAbs, $dstAbs, "/E", "/DCOPY:DAT", "/COPY:DAT", "/R:1", "/W:2",
                  "/NP", "/NDL", "/NFL", "/XD") + $EXCLUDES
        & robocopy @args | Out-Null

        if ($LASTEXITCODE -le 3) {
            Write-Host "  ✓  Copied to $dstAbs" -ForegroundColor Green
        } else {
            Write-Host "  ✗  Failed (robocopy exit $LASTEXITCODE)" -ForegroundColor Red
        }
    } else {
        Write-Host "     [DRY] Would copy: $srcAbs → $dstAbs" -ForegroundColor Cyan
    }
}

Write-Host "`n  Done. Re-run agent-coding sync script after importing:`n" -ForegroundColor Cyan
Write-Host "    cd E:\Project\Master\agent-coding" -ForegroundColor White
Write-Host "    node scripts/connect-all-projects.mjs`n" -ForegroundColor White
