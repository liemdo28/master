$SRC = "D:\Project\Master"
$EXPORT_NAME = "MI_COMPANY_OS_SOURCE_AUDIT_V2_$(Get-Date -Format 'yyyyMMdd_HHmm')"
$EXPORT_DIR = "E:\Project\Exports\$EXPORT_NAME"
$ZIP_PATH = "E:\Project\Exports\$EXPORT_NAME.zip"

# Exclude dirs
$EXCLUDE_DIRS = @(
  'node_modules','.git','logs','tmp','temp','__pycache__','venv','.venv',
  '.local-agent-global','.local-agent','session','snapshots','credentials',
  'secrets','tokens','playwright_browser','chromium-1223','chrome-win64',
  'dist','backup','Cache','Cache_Data','worktrees','.claude','build','.next',
  '.cache','Other'
)

# Exclude extensions
$EXCLUDE_EXTS = @('.pem','.key','.p12','.log','.dll','.exe','.db','.db-wal',
  '.db-shm','.sqlite-wal','.sqlite-shm','.zip','.png','.jpg','.jpeg','.gif',
  '.ico','.mp4','.mov','.avi','.woff','.woff2','.ttf','.eot')

# Exclude exact filenames
$EXCLUDE_NAMES = @('dump.pm2','.env','node.exe','client_secret*','*.db',
  'sqldb*','credentials.json','token.json','token*.json')

New-Item -ItemType Directory -Path $EXPORT_DIR -Force | Out-Null

$files = Get-ChildItem -Path $SRC -Recurse -File
$included = 0
$skipped = 0

foreach ($f in $files) {
  $relPath = $f.FullName.Substring($SRC.Length + 1)
  $parts = $relPath.Split([char]92)
  
  $skip = $false
  foreach ($p in $parts) {
    if ($EXCLUDE_DIRS -contains $p) { $skip = $true; break }
    if ($p -match '^whatsapp-session' -or $p -match '^session-' -or 
        $p -match '^\.env' -or $p -match '^client_secret') { $skip = $true; break }
  }
  if ($skip) { $skipped++; continue }
  
  $ext = $f.Extension.ToLower()
  if ($EXCLUDE_EXTS -contains $ext) { $skipped++; continue }
  
  $fname = $f.Name.ToLower()
  if ($fname -match '^client_secret' -or $fname -match '^credentials' -or
      $fname -match '^token' -or $fname -eq '.env' -or
      $fname -match '\.db$' -or $fname -eq 'dump.pm2') { $skipped++; continue }
  
  $dest = Join-Path $EXPORT_DIR $relPath
  $destDir = Split-Path $dest -Parent
  if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  Copy-Item $f.FullName $dest -Force
  $included++
}

Write-Host "Files included: $included"
Write-Host "Files skipped: $skipped"
Write-Host "Creating ZIP..."
Add-Type -Assembly System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($EXPORT_DIR, $ZIP_PATH)
$size = [math]::Round((Get-Item $ZIP_PATH).Length / 1MB, 1)
Write-Host "ZIP created: $ZIP_PATH"
Write-Host "ZIP size: $size MB"
