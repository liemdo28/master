$ErrorActionPreference = 'Continue'
try {
    # GET login page
    $g = Invoke-WebRequest -Uri 'https://dashboard.bakudanramen.com/login' -UseBasicParsing -TimeoutSec 15
    Write-Host "GET /login status: $($g.StatusCode)"

    # Extract CSRF token
    $match = [regex]::Match($g.Content, 'name="csrf" value="([^"]+)"')
    $csrf = $match.Groups[1].Value
    Write-Host "CSRF token: $csrf (length: $($csrf.Length))"

    if ($csrf -ne '') {
        # POST with real credentials (use -MaximumRedirection 0 to capture raw response)
        $body = "email=admin@bakudanramen.com&password=test123456&csrf=$csrf&remember_me=1"
        Write-Host "POST body: email=admin@bakudanramen.com&password=***&csrf=$csrf&remember_me=1"

        try {
            $p = Invoke-WebRequest -Uri 'https://dashboard.bakudanramen.com/login' -Method POST `
                -Body $body `
                -ContentType 'application/x-www-form-urlencoded' `
                -UseBasicParsing -TimeoutSec 15 `
                -MaximumRedirection 0
            Write-Host "POST /login status: $($p.StatusCode)"
            Write-Host "POST content (first 200): $($p.Content.Substring(0, [Math]::Min(200, $p.Content.Length)))"
        } catch [System.Management.Automation.MethodInvocationException] {
            $ex = $_.Exception.InnerException
            Write-Host "POST exception type: $($ex.GetType().FullName)"
            Write-Host "POST exception message: $($ex.Message)"
            if ($ex.GetType().Name -eq 'WebException') {
                $resp = $ex.Response
                if ($resp) {
                    Write-Host "HTTP Status: $([int]$resp.StatusCode)"
                    $loc = $resp.Headers['Location']
                    if ($loc) { Write-Host "Location: $loc" }
                    $sr = $resp.GetResponseStream()
                    $sr.Position = 0
                    $reader = New-Object System.IO.StreamReader($sr)
                    $body = $reader.ReadToEnd()
                    $reader.Close()
                    Write-Host "Response body: $body"
                }
            }
        }
    } else {
        Write-Host "ERROR: No CSRF token found in login page"
    }
} catch {
    Write-Host "OUTER ERROR: $($_.Exception.Message)"
    Write-Host "Stack: $($_.ScriptStackTrace)"
}
