param(
  [string]$GatewayDir = "E:\Project\Master\whatsapp-ai-gateway",
  [switch]$ConfirmLaptop1
)

$ErrorActionPreference = "Stop"

if (!$ConfirmLaptop1) {
  throw "Refusing to change runtime mode without -ConfirmLaptop1. Run this only on Laptop1."
}

$envPath = Join-Path $GatewayDir ".env"
if (!(Test-Path -LiteralPath $envPath)) {
  throw "Gateway .env not found: $envPath"
}

function Set-EnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  $lines = Get-Content -LiteralPath $Path
  $pattern = "^\s*#?\s*$([regex]::Escape($Key))\s*="
  $found = $false
  $updated = foreach ($line in $lines) {
    if ($line -match $pattern) {
      $found = $true
      "$Key=$Value"
    } else {
      $line
    }
  }
  if (!$found) {
    $updated += "$Key=$Value"
  }
  Set-Content -LiteralPath $Path -Value $updated -Encoding UTF8
}

Set-EnvValue -Path $envPath -Key "LAPTOP1_TEAM_ONLY_MODE" -Value "true"
Set-EnvValue -Path $envPath -Key "MI_DIRECT_CHAT_ENABLED" -Value "false"

Push-Location $GatewayDir
try {
  pm2 restart whatsapp-ai-gateway --update-env
  Start-Sleep -Seconds 10
  curl.exe --silent --max-time 10 http://127.0.0.1:3211/api/health
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Laptop1 team-only mode enabled."
Write-Host "Expected: group/team workflows continue; CEO private Mi chat is silent on Laptop1."
