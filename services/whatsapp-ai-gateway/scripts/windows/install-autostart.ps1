$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$TaskName = 'WhatsApp AI Gateway'
$Script = Join-Path $ProjectRoot 'scripts\windows\start-gateway-hidden.ps1'
$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-ExecutionPolicy Bypass -File `"$Script`""
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Trigger.Delay = 'PT30S'
$Settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description 'Starts WhatsApp AI Gateway hidden at user logon' -Force | Out-Null
Write-Output "installed task: $TaskName"
