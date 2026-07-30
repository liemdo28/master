param(
  [string]$GatewayRoot = "E:\Project\Master\whatsapp-ai-gateway",
  [string]$DashboardPort = "3211",
  [string]$MiCoreUrl = "http://localhost:4001",
  [string]$MiCoreApiKey = "",
  [string]$CeoWhatsappIds = "+84931773657",
  [switch]$ResetWhatsappSession,
  [switch]$StartGateway
)

$ErrorActionPreference = "Stop"

function Set-EnvLine {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  $line = "$Key=$Value"
  if (!(Test-Path -LiteralPath $Path)) {
    New-Item -ItemType File -Path $Path -Force | Out-Null
  }

  $content = Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue
  $pattern = "^\s*$([Regex]::Escape($Key))="
  if ($content | Where-Object { $_ -match $pattern }) {
    $content = $content | ForEach-Object {
      if ($_ -match $pattern) { $line } else { $_ }
    }
  } else {
    $content += $line
  }
  Set-Content -LiteralPath $Path -Value $content -Encoding UTF8
}

if (!(Test-Path -LiteralPath $GatewayRoot)) {
  throw "Gateway root not found: $GatewayRoot"
}

$envPath = Join-Path $GatewayRoot ".env"
$backupPath = Join-Path $GatewayRoot (".env.backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
if (Test-Path -LiteralPath $envPath) {
  Copy-Item -LiteralPath $envPath -Destination $backupPath -Force
  Write-Host "Backed up .env to $backupPath"
}

Set-EnvLine -Path $envPath -Key "DASHBOARD_PORT" -Value $DashboardPort
Set-EnvLine -Path $envPath -Key "MI_CORE_URL" -Value $MiCoreUrl
Set-EnvLine -Path $envPath -Key "MI_CEO_WHATSAPP_IDS" -Value $CeoWhatsappIds
Set-EnvLine -Path $envPath -Key "MI_ALLOW_SELF_CHAT" -Value "false"
if ($MiCoreApiKey) {
  Set-EnvLine -Path $envPath -Key "MI_CORE_API_KEY" -Value $MiCoreApiKey
}

foreach ($port in @($DashboardPort, "3210")) {
  $connections = Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    Write-Host "Stopping process $($connection.OwningProcess) on port $port"
    Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

if ($ResetWhatsappSession) {
  $sessionRoot = Join-Path $GatewayRoot "data\whatsapp"
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  if (Test-Path -LiteralPath $sessionRoot) {
    $backupSession = Join-Path $GatewayRoot "data\backup\whatsapp-session-before-chatbot-login-$stamp"
    New-Item -ItemType Directory -Path (Split-Path $backupSession) -Force | Out-Null
    Move-Item -LiteralPath $sessionRoot -Destination $backupSession -Force
    Write-Host "Moved existing WhatsApp session to $backupSession"
  }

  $legacySessionPaths = @(
    (Join-Path $GatewayRoot ".wwebjs_auth"),
    (Join-Path $GatewayRoot ".wwebjs_cache"),
    (Join-Path $GatewayRoot "data\session"),
    (Join-Path $GatewayRoot "LocalAuth")
  )
  foreach ($legacyPath in $legacySessionPaths) {
    if (Test-Path -LiteralPath $legacyPath) {
      $safeName = (Split-Path $legacyPath -Leaf)
      $backupLegacy = Join-Path $GatewayRoot "data\backup\legacy-$safeName-before-chatbot-login-$stamp"
      New-Item -ItemType Directory -Path (Split-Path $backupLegacy) -Force | Out-Null
      Move-Item -LiteralPath $legacyPath -Destination $backupLegacy -Force
      Write-Host "Moved legacy WhatsApp auth/cache to $backupLegacy"
    }
  }
}

if ($StartGateway) {
  $logs = Join-Path $GatewayRoot "logs"
  New-Item -ItemType Directory -Path $logs -Force | Out-Null
  $out = Join-Path $logs "gateway-$DashboardPort.out.log"
  $err = Join-Path $logs "gateway-$DashboardPort.err.log"
  $proc = Start-Process -FilePath "node" -ArgumentList "src/index.js" -WorkingDirectory $GatewayRoot -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
  Write-Host "Started gateway PID $($proc.Id)"
  Write-Host "Dashboard: http://localhost:$DashboardPort"
  Write-Host "If ResetWhatsappSession was used, open the dashboard/console and scan the QR with the chatbot WhatsApp account."
}

Write-Host "Mi primary router configured."
Write-Host "CEO allowlist: $CeoWhatsappIds"
Write-Host "Mi-Core URL: $MiCoreUrl"
