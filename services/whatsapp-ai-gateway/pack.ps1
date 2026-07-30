# WhatsApp AI Gateway — Windows packaging script
# Creates a clean distributable zip — excludes secrets, session data, and node_modules
$ErrorActionPreference = "Stop"

$version = (Get-Content package.json | ConvertFrom-Json).version
$out = "whatsapp-ai-gateway-v${version}.zip"

Write-Host "Packing v${version} -> ${out}" -ForegroundColor Cyan

# Remove old zip if exists
if (Test-Path $out) { Remove-Item $out }

# Define exclusions
function Test-PackExcluded {
    param([string]$RelativePath)
    $p = $RelativePath -replace '/', '\'
    if ($p.StartsWith('.\')) { $p = $p.Substring(2) }
    $name = [System.IO.Path]::GetFileName($p)
    $segments = @($p -split '\\' | Where-Object { $_ -ne '' })
    return (
        $p -eq '.env' -or
        $p -like '*.zip' -or
        $p -like '.git\*' -or
        $p -eq 'node_modules' -or
        $p -like 'node_modules\*' -or
        $p -eq 'secrets' -or
        $p -like 'secrets\*' -or
        $p -eq '.wwebjs_auth' -or
        $p -like '.wwebjs_auth\*' -or
        $p -eq '.wwebjs_cache' -or
        $p -like '.wwebjs_cache\*' -or
        $p -eq 'logs' -or
        $p -like 'logs\*' -or
        $p -eq 'installer' -or
        $p -like 'installer\*' -or
        $p -eq 'screenshots' -or
        $p -like 'screenshots\*' -or
        $segments -contains 'screenshots' -or
        $p -eq 'data\uploads' -or
        $p -like 'data\uploads\*' -or
        $p -eq 'data\runtime' -or
        $p -like 'data\runtime\*' -or
        $p -eq 'data\template-ocr-smoke' -or
        $p -like 'data\template-ocr-smoke\*' -or
        $p -eq 'data\whatsapp' -or
        $p -like 'data\whatsapp\*' -or
        $p -like 'data\session*' -or
        $p -like 'data\session*\*' -or
        $p -like 'data\backup\*.json' -or
        $p -like 'data\backup\*.db*' -or
        $p -like 'data\backup\*.malformed*' -or
        $p -like 'data\*.db' -or
        $p -like 'data\*.db-wal' -or
        $p -like 'data\*.db-shm' -or
        $p -like 'data\*.journal' -or
        $segments -contains 'Cache' -or
        $segments -contains 'Local Storage' -or
        $segments -contains 'IndexedDB' -or
        $name -like 'Login Data*' -or
        $name -like 'Cookies*' -or
        $name -eq 'Local State' -or
        $name -eq 'Preferences' -or
        $name -eq 'Secure Preferences' -or
        $name -like 'History*' -or
        $name -like 'Favicons*' -or
        $name -eq 's.trim()).includes(chatId)' -or
        $name -eq '{const' -or
        $name -eq 'test.txt' -or
        $name -eq 'temp_md1.txt' -or
        $name -eq 'make_docs.py' -or
        $name -eq 'make_docs2.py' -or
        $name -eq 'write_docs.py' -or
        $name -eq 'write_docs.js' -or
        $name -eq 'write_both.py' -or
        $name -eq 'LOCK' -or
        $name -eq 'LOG' -or
        $name -eq 'LOG.old'
    )
}

# Get all files, filter exclusions
$files = Get-ChildItem -Path . -Recurse -File | Where-Object {
    $relativePath = $_.FullName.Substring((Get-Location).Path.Length + 1)
    -not (Test-PackExcluded $relativePath)
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
$violations = @($zipEntries.Entries | Where-Object {
    Test-PackExcluded $_.FullName
})
$zipEntries.Dispose()

if ($violations.Count -eq 0) {
    Write-Host "  OK: No secrets, runtime artifacts, backup configs, or node_modules in zip" -ForegroundColor Green
} else {
    Write-Host "  FAIL: Found excluded files in zip:" -ForegroundColor Red
    $violations | ForEach-Object { Write-Host "    - $($_.FullName)" -ForegroundColor Red }
    exit 1
}

# Copy to installer/source/ with standard name so installer can find it
$installerSourceDir = Join-Path $PSScriptRoot 'installer\source'
if (-not (Test-Path $installerSourceDir)) {
    New-Item -ItemType Directory -Force -Path $installerSourceDir | Out-Null
}
$installerZip = Join-Path $installerSourceDir 'BakudanFoodSafety-app.zip'
Copy-Item (Resolve-Path $out) $installerZip -Force
Write-Host "  Copied to installer\source\BakudanFoodSafety-app.zip" -ForegroundColor Green

Write-Host ""
Write-Host "Recipient install steps:" -ForegroundColor Cyan
Write-Host "  1. Use installer\install.ps1 (one-click installer)"
Write-Host "  OR manual:"
Write-Host "  1. Expand-Archive ${out} -DestinationPath .\whatsapp-ai-gateway"
Write-Host "  2. cd whatsapp-ai-gateway && npm install"
Write-Host "  3. Copy .env.example to .env and edit"
Write-Host "  4. npm start"
