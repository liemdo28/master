$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$jsonFiles = @(
  'pocs/food_safety_submission_v1.json',
  'pocs/manager_training_video/video_plan.json',
  'pocs/map3d-store-demo/store-map-data.json'
)

foreach ($rel in $jsonFiles) {
  $path = Join-Path $root $rel
  Get-Content -LiteralPath $path -Raw | ConvertFrom-Json | Out-Null
  Write-Host "JSON OK: $rel"
}

$html = Join-Path $root 'pocs/webllm-dashboard-demo/dashboard-local-ai-demo.html'
if (-not (Select-String -LiteralPath $html -Pattern 'send whatsapp' -Quiet)) {
  throw 'WebLLM demo missing action deny list.'
}

Write-Host "POC tests PASS."
