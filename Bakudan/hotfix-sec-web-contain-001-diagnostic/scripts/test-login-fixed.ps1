$ErrorActionPreference = 'Continue'
try {
    # GET login page to get fresh CSRF
    $g = Invoke-WebRequest -Uri 'https://dashboard.bakudanramen.com/login' -UseBasicParsing -TimeoutSec 15
    Write-Host "GET /login: $($g.StatusCode)"

    $match = [regex]::Match($g.Content, 'name="csrf" value="([^"]+)"')
    $csrf = $match.Groups[1].Value
    Write-Host "CSRF: $($csrf.Substring(0,8))... (len=$($csrf.Length))"

    if ($csrf -ne '') {
        # POST login with wrong credentials (CSRF must match, credential check is separate)
        $body = "email=test@bakudanramen.com&password=wrongpass&csrf=$csrf"
        try {
            $p = Invoke-WebRequest -Uri 'https://dashboard.bakudanramen.com/login' -Method POST `
                -Body $body -ContentType 'application/x-www-form-urlencoded' `
                -UseBasicParsing -TimeoutSec 15 `
                -MaximumRedirection 0 `
                -ErrorAction SilentlyContinue
            if ($p) {
                Write-Host "POST /login status: $($p.StatusCode)"
            }
        } catch [System.Management.Automation.MethodInvocationException] {
            $ex = $_.Exception.InnerException
            if ($ex -and $ex.GetType().Name -eq 'WebException') {
                $resp = $ex.Response
                if ($resp) {
                    $code = [int]$resp.StatusCode
                    Write-Host "POST /login status: $code"
                    if ($code -ge 300 -and $code -lt 400) {
                        Write-Host "RESULT: Redirect response (normal - bad credentials rejected)"
                    } elseif ($code -ge 500) {
                        Write-Host "RESULT: SERVER ERROR - fix may not have worked"
                    }
                }
            } else {
                Write-Host "Inner exception: $($ex.Message)"
            }
        } catch {
            Write-Host "Other error: $($_.Exception.Message)"
        }
    }

    # Also test auth chain
    $tests = @(
        @{ url = 'https://dashboard.bakudanramen.com/logout'; name = '/logout' },
        @{ url = 'https://dashboard.bakudanramen.com/password-reset'; name = '/password-reset' },
        @{ url = 'https://dashboard.bakudanramen.com/session'; name = '/session' },
        @{ url = 'https://dashboard.bakudanramen.com/me'; name = '/me' }
    )
    foreach ($t in $tests) {
        try {
            $r = Invoke-WebRequest -Uri $t.url -UseBasicParsing -TimeoutSec 10
            Write-Host "[OK] GET $($t.name): HTTP $($r.StatusCode)"
        } catch {
            Write-Host "[FAIL] GET $($t.name): $($_.Exception.Message)"
        }
    }
    Write-Host "DONE"
} catch {
    Write-Host "OUTER: $($_.Exception.Message)"
}
