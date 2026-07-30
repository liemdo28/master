<#
  build-release.ps1
  Packages the app source for a GitHub Release.

  Usage:
    powershell -ExecutionPolicy Bypass -File scripts\build-release.ps1
    powershell -ExecutionPolicy Bypass -File scripts\build-release.ps1 -Version 1.0.1

  Output:
    releases\BakudanFoodSafety-<version>.zip
    releases\update-manifest.json
    (prints SHA256 to copy into manifest)
#>
param(
  [string]$Version = '',
  [string]$Channel = 'stable'
)

$ErrorActionPreference = 'Stop'
$Root      = Split-Path $PSScriptRoot -Parent
$OutDir    = Join-Path $Root 'releases'
$TmpDir    = Join-Path $env:TEMP ("bakudan-build-" + [guid]::NewGuid().ToString('N'))

# Read version from version.json if not supplied
$vf = Join-Path $Root 'version.json'
$verObj = Get-Content $vf -Raw | ConvertFrom-Json
if (-not $Version) { $Version = $verObj.version }
$Build = (Get-Date -Format 'yyyy.MM.dd') + '.001'

$ZipName = "BakudanFoodSafety-$Version.zip"
$ZipPath = Join-Path $OutDir $ZipName

Write-Host ""
Write-Host "  === Bakudan Release Builder ===" -ForegroundColor Cyan
Write-Host "  Version : $Version"
Write-Host "  Build   : $Build"
Write-Host "  Output  : $ZipPath"
Write-Host ""

# Create output dir
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

try {
  # Copy source — exclude data, logs, node_modules, .git, releases, runtime
  $exclude = @('data', 'logs', 'node_modules', '.git', 'releases', '__pycache__',
               'installer\runtime', '.env')

  Get-ChildItem -Path $Root -Force | Where-Object {
    $_.Name -notin $exclude
  } | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $TmpDir $_.Name) -Recurse -Force -ErrorAction SilentlyContinue
  }

  # Update version.json build stamp inside package
  $pkgVf = Join-Path $TmpDir 'version.json'
  $pkgVer = Get-Content $pkgVf -Raw | ConvertFrom-Json
  $pkgVer.build = $Build
  $pkgVer | ConvertTo-Json | Set-Content $pkgVf

  # Remove any existing zip
  if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

  # Zip
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory($TmpDir, $ZipPath)
  Write-Host "  [OK] Package created: $ZipPath" -ForegroundColor Green

  # SHA256
  $hash = (Get-FileHash -Path $ZipPath -Algorithm SHA256).Hash.ToLower()
  $size = (Get-Item $ZipPath).Length
  Write-Host "  [OK] SHA256 : $hash" -ForegroundColor Green
  Write-Host "  [OK] Size   : $([math]::Round($size/1MB, 1)) MB" -ForegroundColor Green

  # Write update-manifest.json to releases/
  $manifestPath = Join-Path $OutDir 'update-manifest.json'
  $manifest = [ordered]@{
    latestVersion      = $Version
    build              = $Build
    channel            = $Channel
    downloadUrl        = "https://github.com/liemdo28/bakudan-releases/releases/download/v$Version/$ZipName"
    sha256             = $hash
    releaseNotes       = @("Release $Version")
    requiredMigration  = $false
    minSupportedVersion = '1.0.0'
    fileSize           = $size
  }
  $manifest | ConvertTo-Json | Set-Content $manifestPath
  Write-Host "  [OK] Manifest : $manifestPath" -ForegroundColor Green

  Write-Host ""
  Write-Host "  Next steps:" -ForegroundColor Yellow
  Write-Host "  1. Edit releases\update-manifest.json (add real release notes)" -ForegroundColor Yellow
  Write-Host "  2. Create GitHub release: v$Version" -ForegroundColor Yellow
  Write-Host "  3. Upload $ZipName as release asset" -ForegroundColor Yellow
  Write-Host "  4. Upload update-manifest.json to repo root (push to main)" -ForegroundColor Yellow
  Write-Host "  5. Dashboard Check for Updates will detect v$Version" -ForegroundColor Yellow
  Write-Host ""

} finally {
  Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
}
