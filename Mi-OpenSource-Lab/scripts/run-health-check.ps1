$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$required = @(
  'README.md',
  'PROJECT_INDEX.md',
  'OPEN_SOURCE_AUDIT.md',
  'INTEGRATION_DECISION_MATRIX.md',
  'reports/PHASE_1_AUDIT_REPORT.md',
  'reports/PHASE_2_LAB_INSTALL_REPORT.md',
  'reports/PHASE_3_MI_MAPPING_REPORT.md',
  'docs/MI_OPEN_SOURCE_ADAPTER_ARCHITECTURE.md',
  'reports/PHASE_5_POC_WORKFLOW_STUDIO.md',
  'reports/PHASE_6_POC_VIDEO_AGENT.md',
  'reports/PHASE_7_POC_VOICE_ENGINE.md',
  'reports/PHASE_8_POC_WEBLLM.md',
  'reports/PHASE_9_OBSCURA_BROWSER_LAB.md',
  'reports/PHASE_10_MAP3D_DIGITAL_TWIN_LAB.md',
  'reports/PHASE_11_SECURITY_LICENSE_REVIEW.md',
  'reports/FINAL_RECOMMENDATION.md',
  'pocs/food_safety_submission_v1.json',
  'pocs/manager_training_video/video_plan.json',
  'pocs/map3d-store-demo/store-map-data.json'
)

$missing = @()
foreach ($rel in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $rel))) { $missing += $rel }
}

if ($missing.Count -gt 0) {
  $missing | ForEach-Object { Write-Host "MISSING: $_" }
  exit 1
}

Write-Host "Mi Open-Source Extension Lab health check PASS."
