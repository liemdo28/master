<#
.SYNOPSIS
    Two-way diff between E:\Project\Master and F:\Projects

.DESCRIPTION
    Reports: missing files, changed files, missing folders.
    NEVER overwrites anything — read-only comparison only.

.PARAMETER ProjectFilter
    Limit comparison to projects matching this pattern.

.PARAMETER OutputFile
    Path to write the diff report (default: COMPARE_REPORT_<timestamp>.md)

.EXAMPLE
    .\compare-projects.ps1
    .\compare-projects.ps1 -ProjectFilter "agent-coding"
    .\compare-projects.ps1 -OutputFile "C:\tmp\diff.md"
#>

param(
    [string]$ProjectFilter = "*",
    [string]$OutputFile    = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$MASTER   = "E:\Project\Master"
$PORTABLE = "F:\Projects"
$TS       = Get-Date -Format "yyyyMMdd-HHmmss"
if (-not $OutputFile) { $OutputFile = "$MASTER\COMPARE_REPORT_$TS.md" }

# Same project map as sync script
$PROJECT_MAP = [ordered]@{
    "Bakudan\bakudanramen.com-current"    = "bakudanramen.com"
    "Bakudan\dashboard.bakudanramen.com"  = "dashboard.bakudanramen.com"
    "Bakudan\growth-dashboard"            = "growth-dashboard"
    "Bakudan\packing-list"                = "packinglist-price"
    "Bakudan\mobile_taskflow"             = "mobile_taskflow"
    "Bakudan\review-automation-system"    = "review-automation-system"
    "Bakudan\integration-system"          = "integration-system"
    "agent-coding"                        = "agent-coding"
    "agent-coding-api-keys"               = "agent-coding-api-keys"
    "QA\qa-system"                        = "qa-system"
    "QA\qa_runner"                        = "qa_runner"
    "RawSushi\RawWebsite"                 = "rawsushibar"
    "Other\LinkTreeHL"                    = "LinkTreeHL"
}

$IGNORE_DIRS = @(".git","node_modules","vendor","dist","build","__pycache__",
                 ".next","coverage","logs","tmp","temp","cache",".cache",
                 ".wrangler",".pytest_cache","out","target",".gradle","releases")

$Report = [System.Text.StringBuilder]::new()

function Add-Line { param([string]$Line) [void]$Report.AppendLine($Line) }

function Get-FileMap {
    param([string]$Root)
    $map = @{}
    if (-not (Test-Path $Root)) { return $map }
    Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
        # Skip ignored dirs
        $parts = $_.FullName.Substring($Root.Length + 1).Split([IO.Path]::DirectorySeparatorChar)
        foreach ($p in $parts) { if ($IGNORE_DIRS -contains $p) { return } }
        $rel = $_.FullName.Substring($Root.Length + 1)
        $map[$rel] = @{
            Size         = $_.Length
            LastWrite    = $_.LastWriteTime
            FullPath     = $_.FullName
        }
    }
    return $map
}

function Compare-Dirs {
    param([string]$SrcPath, [string]$DstPath, [string]$Name)

    $missing_in_F  = @()
    $missing_in_E  = @()
    $changed       = @()

    $eFiles = Get-FileMap $SrcPath
    $fFiles = Get-FileMap $DstPath

    # Files in E but not F (or different)
    foreach ($rel in $eFiles.Keys) {
        if (-not $fFiles.ContainsKey($rel)) {
            $missing_in_F += $rel
        } elseif ([Math]::Abs(($eFiles[$rel].LastWrite - $fFiles[$rel].LastWrite).TotalSeconds) -gt 2 -and
                  $eFiles[$rel].Size -ne $fFiles[$rel].Size) {
            $changed += @{
                File     = $rel
                E_Size   = $eFiles[$rel].Size
                F_Size   = $fFiles[$rel].Size
                E_Date   = $eFiles[$rel].LastWrite.ToString("yyyy-MM-dd HH:mm")
                F_Date   = $fFiles[$rel].LastWrite.ToString("yyyy-MM-dd HH:mm")
                E_Newer  = $eFiles[$rel].LastWrite -gt $fFiles[$rel].LastWrite
            }
        }
    }

    # Files in F but not E
    foreach ($rel in $fFiles.Keys) {
        if (-not $eFiles.ContainsKey($rel)) {
            $missing_in_E += $rel
        }
    }

    return @{
        MissingInF = $missing_in_F | Sort-Object
        MissingInE = $missing_in_E | Sort-Object
        Changed    = $changed
        ECount     = $eFiles.Count
        FCount     = $fFiles.Count
    }
}

# ── Header ────────────────────────────────────────────────────────────────────
Write-Host "`n  COMPARE E <-> F  (read-only)`n" -ForegroundColor Cyan

Add-Line "# COMPARE REPORT: E vs F"
Add-Line "**Generated:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Add-Line "**Master (E):** ``$MASTER``"
Add-Line "**Portable (F):** ``$PORTABLE``"
Add-Line ""
Add-Line "---"
Add-Line ""

$totalMissingF = 0; $totalMissingE = 0; $totalChanged = 0

foreach ($entry in $PROJECT_MAP.GetEnumerator()) {
    $srcRel  = $entry.Key
    $dstName = $entry.Value
    if ($dstName -notlike $ProjectFilter) { continue }

    $srcAbs = Join-Path $MASTER $srcRel
    $dstAbs = Join-Path $PORTABLE $dstName

    $srcExists = Test-Path $srcAbs
    $dstExists = Test-Path $dstAbs

    Write-Host "  Comparing: $dstName ..." -ForegroundColor Yellow

    Add-Line "## $dstName"
    Add-Line "| | Path |"
    Add-Line "|--|--|"
    Add-Line "| **E (Master)** | ``$srcAbs`` |"
    Add-Line "| **F (Portable)** | ``$dstAbs`` |"
    Add-Line ""

    if (-not $srcExists) {
        Add-Line "⚠️ **E source not found** — project exists only on F or was moved."
        Add-Line ""
        continue
    }
    if (-not $dstExists) {
        Add-Line "❌ **F destination not found** — not yet synced. Run ``sync-master-to-portable.ps1``"
        Add-Line ""
        continue
    }

    $diff = Compare-Dirs -SrcPath $srcAbs -DstPath $dstAbs -Name $dstName

    Add-Line "| Metric | Count |"
    Add-Line "|--------|-------|"
    Add-Line "| Files in E | $($diff.ECount) |"
    Add-Line "| Files in F | $($diff.FCount) |"
    Add-Line "| Missing in F | $($diff.MissingInF.Count) |"
    Add-Line "| Missing in E (F-only files) | $($diff.MissingInE.Count) |"
    Add-Line "| Changed (size+date differ) | $($diff.Changed.Count) |"
    Add-Line ""

    $totalMissingF += $diff.MissingInF.Count
    $totalMissingE += $diff.MissingInE.Count
    $totalChanged  += $diff.Changed.Count

    # Missing in F (first 20)
    if ($diff.MissingInF.Count -gt 0) {
        Add-Line "### Missing in F (E→F needed)"
        Add-Line "``````"
        $diff.MissingInF | Select-Object -First 20 | ForEach-Object { Add-Line $_ }
        if ($diff.MissingInF.Count -gt 20) { Add-Line "... and $($diff.MissingInF.Count - 20) more" }
        Add-Line "``````"
        Add-Line ""
    }

    # Changed files
    if ($diff.Changed.Count -gt 0) {
        Add-Line "### Changed Files"
        Add-Line "| File | E Date | F Date | Newer |"
        Add-Line "|------|--------|--------|-------|"
        $diff.Changed | Select-Object -First 20 | ForEach-Object {
            $newer = if ($_.E_Newer) { "**E**" } else { "**F**" }
            Add-Line "| ``$($_.File)`` | $($_.E_Date) | $($_.F_Date) | $newer |"
        }
        if ($diff.Changed.Count -gt 20) { Add-Line "| ... | $($diff.Changed.Count - 20) more | | |" }
        Add-Line ""
    }

    # F-only files
    if ($diff.MissingInE.Count -gt 0 -and $diff.MissingInE.Count -le 10) {
        Add-Line "### F-only files (not in E)"
        Add-Line "``````"
        $diff.MissingInE | ForEach-Object { Add-Line $_ }
        Add-Line "``````"
        Add-Line ""
    }

    if ($diff.MissingInF.Count -eq 0 -and $diff.Changed.Count -eq 0 -and $diff.MissingInE.Count -eq 0) {
        Add-Line "✅ **IN SYNC** — no differences found."
        Add-Line ""
    }

    Add-Line "---"
    Add-Line ""
}

# ── F-only projects ───────────────────────────────────────────────────────────
Add-Line "## F-Only Projects (Not in E)"
Add-Line ""
$F_ONLY = @("phuyen-2026","authorize-net-backup","Tester-QA","shared-workspace","guidline-record","bakudan-sync")
foreach ($proj in $F_ONLY) {
    $p = Join-Path $PORTABLE $proj
    if (Test-Path $p) {
        Add-Line "- ⚠️ ``$proj`` — exists only on F. **Copy to E manually or run copy-f-only-to-master.ps1**"
    }
}

Add-Line ""
Add-Line "---"
Add-Line ""
Add-Line "## Summary"
Add-Line ""
Add-Line "| Metric | Count |"
Add-Line "|--------|-------|"
Add-Line "| Total missing in F | $totalMissingF |"
Add-Line "| Total F-only files | $totalMissingE |"
Add-Line "| Total changed files | $totalChanged |"
Add-Line ""
Add-Line "> ⚠️ This report is **read-only**. No files were modified."
Add-Line "> Run \`sync-master-to-portable.ps1\` to push E → F."

# Write report
$Report.ToString() | Out-File -FilePath $OutputFile -Encoding UTF8
Write-Host "`n  Report written: $OutputFile" -ForegroundColor Green
Write-Host "  Missing in F:   $totalMissingF files" -ForegroundColor $(if ($totalMissingF -gt 0) {"Yellow"} else {"Green"})
Write-Host "  Changed:        $totalChanged files" -ForegroundColor $(if ($totalChanged -gt 0) {"Yellow"} else {"Green"})
Write-Host ""
