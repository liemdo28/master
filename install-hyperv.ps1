$ErrorActionPreference = 'Stop'

$logPath = Join-Path $env:TEMP 'install-hyperv.log'
Start-Transcript -Path $logPath -Append | Out-Null

try {
    $principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'This script must be run as Administrator.'
    }

    Write-Host 'Installing Hyper-V optional features...' -ForegroundColor Cyan
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All -NoRestart

    Write-Host 'Ensuring Windows starts the hypervisor...' -ForegroundColor Cyan
    bcdedit /set hypervisorlaunchtype auto

    Write-Host ''
    Write-Host 'Hyper-V install command finished.' -ForegroundColor Green
    Write-Host 'Restart Windows to complete the installation.' -ForegroundColor Yellow
    Write-Host "Log: $logPath"
}
catch {
    Write-Host ''
    Write-Host "Hyper-V install failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Log: $logPath"
    exit 1
}
finally {
    Stop-Transcript | Out-Null
}
