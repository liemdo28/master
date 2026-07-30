$ErrorActionPreference = 'Continue'
try {
    # Step 1: GET login page
    $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $g = Invoke-WebRequest -Uri 'https://dashboard.bakudanramen.com/login' -UseBasicParsing -WebSession $s -TimeoutSec 15
    Write-Host "Step 1 GET /login: $($g.StatusCode)"

    # Step 2: Extract CSRF
    $match = [regex]::Match($g.Content, 'name="csrf" value="([^"]+)"')
    $csrf = $match.Groups[1].Value
    Write-Host "CSRF: $csrf"

    if ($csrf -ne '') {
        # Step 3: POST login (follow redirects to see where it ends up)
        $body = @{
            email       = 'admin@bakudanramen.com'
            password    = $env:ADMIN_LOGIN_PASSWORD
            csrf        = $csrf
            remember_me = '1'
        }
        try {
            $p = Invoke-WebRequest -Uri 'https://dashboard.bakudanramen.com/login' -Method POST `
                -Body $body `
                -ContentType 'application/x-www-form-urlencoded' `
                -WebSession $s -TimeoutSec 15
            Write-Host "Step 2 POST /login: $($p.StatusCode)"
            Write-Host "Final URL: $($p.BaseResponse.ResponseUri)"

            # Step 4: Check if we're back at login (failed auth)
            if ($p.BaseResponse.ResponseUri -match 'login') {
                Write-Host "RESULT: Redirected back to login - bad credentials or auth failed"
            } else {
                Write-Host "RESULT: Landed on $($p.BaseResponse.ResponseUri)"
                # Step 5: Check if the final page has error content
                if ($p.Content -match 'Something went wrong|Exception|error') {
                    Write-Host "ERROR FOUND in final page content!"
                    Write-Host "Content preview:"
                    Write-Host $p.Content.Substring(0, 500)
                }
            }
        } catch {
            $ex = $_.Exception
            Write-Host "POST exception: $($ex.Message)"
            if ($ex.InnerException) {
                $wex = $ex.InnerException
                if ($wex.GetType().Name -eq 'WebException') {
                    $resp = $wex.Response
                    if ($resp) {
                        Write-Host "Final HTTP: $([int]$resp.StatusCode)"
                        Write-Host "Final URL: $($resp.ResponseUri)"
                        $sr = $resp.GetResponseStream()
                        $sr.Position = 0
                        $rdr = New-Object System.IO.StreamReader($sr)
                        $body = $rdr.ReadToEnd()
                        $rdr.Close()
                        if ($body.Length -lt 1000) {
                            Write-Host "Final body: $body"
                        } else {
                            Write-Host "Final body (first 500): $($body.Substring(0, 500))"
                        }
                    }
                }
            }
        }
    }
} catch {
    Write-Host "OUTER: $($_.Exception.Message)"
}
