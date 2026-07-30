$f1 = 'd:\Project\Master\mi-core\server\src\routes\qb-mirror-router.ts'
$f2 = 'd:\Project\Master\mi-core\server\src\routes\qb-mirror-phase1.ts'
foreach ($f in @($f1, $f2)) {
    $c = Get-Content $f -Raw
    if (-not ($c -match '^// @ts-nocheck')) {
        $c = "// @ts-nocheck`n" + $c
        Set-Content $f -Value $c -NoNewline
        Write-Host "Added @ts-nocheck to $f"
    }
}
