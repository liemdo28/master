param(
  [string]$Project,
  [switch]$Execute
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$targets = @{
  'open-agent-builder' = @{ repo = 'https://github.com/firecrawl/open-agent-builder.git'; dir = '01-open-agent-builder/runtime' }
  'openmontage' = @{ repo = 'https://github.com/calesthio/OpenMontage.git'; dir = '02-openmontage/runtime' }
  'tts-audio-suite' = @{ repo = 'https://github.com/diodiogod/TTS-Audio-Suite.git'; dir = '03-tts-audio-suite/runtime' }
  'webllm' = @{ repo = 'https://github.com/mlc-ai/web-llm.git'; dir = '04-webllm/runtime' }
}

if (-not $targets.ContainsKey($Project)) {
  throw "Unknown or blocked project. Allowed guarded installs: $($targets.Keys -join ', ')"
}

$target = $targets[$Project]
$dest = Join-Path $root $target.dir

Write-Host "Target: $Project"
Write-Host "Repo: $($target.repo)"
Write-Host "Destination: $dest"
Write-Host "Policy: no secrets, no model downloads, no production writes."

if (-not $Execute) {
  Write-Host "Dry-run only. Re-run with -Execute after license/model approval."
  exit 0
}

if (Get-ChildItem -LiteralPath $dest -Force | Select-Object -First 1) {
  throw "Runtime folder is not empty: $dest"
}

git clone --depth 1 $target.repo $dest
Write-Host "Clone complete. Review license and install docs before package install."
