<#
.SYNOPSIS
    Read-only git status report for projects under E:\Project\Master and F:\Projects.
#>

$MASTER = "E:\Project\Master"
$PORTABLE = "F:\Projects"
$TS = Get-Date -Format "yyyyMMdd-HHmmss"
$OUT = Join-Path $MASTER "GIT_STATUS_REPORT_$TS.md"

$Report = New-Object System.Text.StringBuilder
function Add-Line {
    param([string]$Line)
    [void]$Report.AppendLine($Line)
}

$Projects = @(
    @{ Path = "$MASTER\agent-coding"; Label = "E: agent-coding" },
    @{ Path = "$MASTER\Bakudan\bakudanramen.com-current"; Label = "E: Bakudan Website" },
    @{ Path = "$MASTER\Bakudan\dashboard.bakudanramen.com"; Label = "E: Bakudan Dashboard" },
    @{ Path = "$MASTER\Bakudan\growth-dashboard"; Label = "E: Growth Dashboard" },
    @{ Path = "$MASTER\Bakudan\packing-list"; Label = "E: Packing List" },
    @{ Path = "$MASTER\Bakudan\mobile_taskflow"; Label = "E: Mobile TaskFlow" },
    @{ Path = "$MASTER\Bakudan\review-automation-system"; Label = "E: Review Automation" },
    @{ Path = "$MASTER\Bakudan\integration-system"; Label = "E: Integration System" },
    @{ Path = "$MASTER\QA\qa-system"; Label = "E: QA System" },
    @{ Path = "$MASTER\RawSushi\RawWebsite"; Label = "E: Raw Sushi Website" },
    @{ Path = "$MASTER\Other\LinkTreeHL"; Label = "E: LinkTree HL" },
    @{ Path = "$PORTABLE\agent-coding"; Label = "F: agent-coding" },
    @{ Path = "$PORTABLE\bakudanramen.com"; Label = "F: bakudanramen.com (WP)" },
    @{ Path = "$PORTABLE\dashboard.bakudanramen.com"; Label = "F: dashboard (main)" },
    @{ Path = "$PORTABLE\integration-toasttab-qb"; Label = "F: integration-toasttab-qb" },
    @{ Path = "$PORTABLE\rawsushibar"; Label = "F: rawsushibar" },
    @{ Path = "$PORTABLE\packinglist-price"; Label = "F: packinglist-price" },
    @{ Path = "$PORTABLE\phuyen-2026"; Label = "F: phuyen-2026" }
)

$Summary = @{
    Clean = 0
    Dirty = 0
    NoGit = 0
    Unpushed = 0
}

Add-Line "# Git Status Report"
Add-Line ""
Add-Line "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Add-Line ""

foreach ($Project in $Projects) {
    $ProjectPath = $Project.Path
    $Label = $Project.Label
    Write-Host "Checking: $Label ..." -NoNewline

    Add-Line "## $Label"
    Add-Line ""
    Add-Line "Path: ``$ProjectPath``"

    if (-not (Test-Path $ProjectPath)) {
        Write-Host " path missing" -ForegroundColor DarkGray
        Add-Line "Status: path missing"
        Add-Line ""
        $Summary.NoGit++
        continue
    }

    if (-not (Test-Path (Join-Path $ProjectPath ".git"))) {
        Write-Host " no git" -ForegroundColor DarkGray
        Add-Line "Status: no .git directory"
        Add-Line ""
        $Summary.NoGit++
        continue
    }

    $Remote = & git -C $ProjectPath remote get-url origin 2>$null
    if (-not $Remote) {
        $Remote = & git -C $ProjectPath remote get-url dreamhost 2>$null
    }
    if (-not $Remote) {
        $Remote = "-"
    }

    $Branch = & git -C $ProjectPath rev-parse --abbrev-ref HEAD 2>$null
    if (-not $Branch) {
        $Branch = "unknown"
    }

    $Status = @(& git -C $ProjectPath status --porcelain 2>$null)
    $LastCommit = & git -C $ProjectPath log --oneline -1 2>$null
    if (-not $LastCommit) {
        $LastCommit = "-"
    }

    $Unpushed = @(& git -C $ProjectPath log "@{u}..HEAD" --oneline 2>$null)
    $IsDirty = $Status.Count -gt 0
    $HasUnpushed = $Unpushed.Count -gt 0

    if ($IsDirty -or $HasUnpushed) {
        Write-Host " dirty" -ForegroundColor Yellow
    } else {
        Write-Host " clean" -ForegroundColor Green
    }

    Add-Line "Branch: $Branch"
    Add-Line "Remote: $Remote"
    Add-Line "Last commit: $LastCommit"
    Add-Line "Dirty: $IsDirty"
    Add-Line "Unpushed commits: $($Unpushed.Count)"
    Add-Line ""

    if ($IsDirty) {
        Add-Line "Uncommitted changes:"
        Add-Line '```'
        $Status | Select-Object -First 30 | ForEach-Object { Add-Line $_ }
        if ($Status.Count -gt 30) {
            Add-Line "... and $($Status.Count - 30) more"
        }
        Add-Line '```'
        Add-Line ""
        $Summary.Dirty++
    }

    if ($HasUnpushed) {
        Add-Line "Unpushed commits:"
        Add-Line '```'
        $Unpushed | ForEach-Object { Add-Line $_ }
        Add-Line '```'
        Add-Line ""
        $Summary.Unpushed++
    }

    if (-not $IsDirty -and -not $HasUnpushed) {
        $Summary.Clean++
    }
}

Add-Line "## Summary"
Add-Line ""
Add-Line "Clean and pushed: $($Summary.Clean)"
Add-Line "Dirty: $($Summary.Dirty)"
Add-Line "Has unpushed commits: $($Summary.Unpushed)"
Add-Line "No git or missing: $($Summary.NoGit)"

$Report.ToString() | Out-File -FilePath $OUT -Encoding UTF8

Write-Host ""
Write-Host "Report: $OUT" -ForegroundColor Cyan
Write-Host "Clean: $($Summary.Clean)" -ForegroundColor Green
Write-Host "Dirty: $($Summary.Dirty)"
Write-Host "Unpushed: $($Summary.Unpushed)"
Write-Host "No git: $($Summary.NoGit)"
