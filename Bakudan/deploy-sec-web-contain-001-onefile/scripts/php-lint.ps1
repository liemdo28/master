param(
    [string[]]$Paths = @(
        "config\safety-guard.php",
        "config\database.php",
        "index.php",
        "migrate.php",
        "preview_db_health.php"
    )
)

$ErrorActionPreference = "Stop"

$php = "C:\xampp\php\php.exe"
if (-not (Test-Path -LiteralPath $php)) {
    Write-Error "PHP binary not found: $php"
}

$failed = $false
foreach ($path in $Paths) {
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Host "PATH_NOT_FOUND $path" -ForegroundColor Red
        $failed = $true
        continue
    }

    & $php -l $path
    if ($LASTEXITCODE -ne 0) {
        $failed = $true
    }
}

if ($failed) {
    exit 1
}

Write-Host "PHP_LINT_PASS" -ForegroundColor Green
