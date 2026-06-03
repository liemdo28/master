# WhatsApp AI Gateway — Windows packaging script
# Creates a clean distributable zip — excludes secrets, session data, and node_modules
$ErrorActionPreference = "Stop"

$version = (Get-Content package.json | ConvertFrom-Json).version
$out = "whatsapp-ai-gateway-v${version}.zip"

Write-Host "Packing v${version} -> ${out}" -ForegroundColor Cyan

# Remove old zip if exists
if (Test-Path $out) { Remove-Item $out }

# Define exclusions
$excludePatterns = @(
    '.git',
    'node_modules',
    'data\session',
    'data\gateway.db',
    'data\gateway.db-shm',
    'data\gateway.db-wal',
    'logs',
    'screenshots',
    '.env',
    '.wwebjs_auth',
    '.wwebjs_cache',
    '*.zip'
)

# Get all files, filter exclusions
$files = Get-ChildItem -Path . -Recurse -File | Where-Object {
    $relativePath = $_.FullName.Substring((Get-Location).Path.Length + 1)
    $excluded = $false
    foreach ($pattern in $excludePatterns) {
        if ($relativePath -like "${pattern}*" -or $relativePath -like "*\${pattern}*" -or $relativePath -eq $pattern) {
            $excluded = $true
            break
        }
    }
    -not $excluded
}

# Create zip
$tempDir = Join-Path $env:TEMP "wa-gateway-pack-$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir | Out-Null

foreach ($file in $files) {
    $relativePath = $file.FullName.Substring((Get-Location).Path.Length + 1)
    $destPath = Join-Path $tempDir $relativePath
    $destDir = Split-Path $destPath -Parent
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item $file.FullName -Destination $destPath
}

Compress-Archive -Path "$tempDir\*" -DestinationPath $out -Force
Remove-Item $tempDir -Recurse -Force

Write-Host "Done: ${out}" -ForegroundColor Green
Write-Host ""
Write-Host "Verifying exclusions..." -ForegroundColor Yellow

# Verify
$zipEntries = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $out))
$violations = $zipEntries.Entries | Where-Object {
    $_.FullName -match '(^\.env$|node_modules/|session/|\.wwebjs_auth/)'
}
$zipEntries.Dispose()

if ($violations.Count -eq 0) {
    Write-Host "  OK: No secrets, session, or node_modules in zip" -ForegroundColor Green
} else {
    Write-Host "  FAIL: Found excluded files in zip:" -ForegroundColor Red
    $violations | ForEach-Object { Write-Host "    - $($_.FullName)" -ForegroundColor Red }
    exit 1
}

Write-Host ""
Write-Host "Recipient install steps:" -ForegroundColor Cyan
Write-Host "  1. Expand-Archive ${out} -DestinationPath .\whatsapp-ai-gateway"
Write-Host "  2. cd whatsapp-ai-gateway && npm install"
Write-Host "  3. Copy .env.example to .env and edit"
Write-Host "  4. npm start"
