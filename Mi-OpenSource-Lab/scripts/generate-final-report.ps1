$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$report = Join-Path $root 'reports/FINAL_RECOMMENDATION.md'

if (-not (Test-Path -LiteralPath $report)) {
  throw "Missing final recommendation: $report"
}

Get-Content -LiteralPath $report
