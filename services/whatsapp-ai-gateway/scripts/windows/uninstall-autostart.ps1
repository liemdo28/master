$TaskName = 'WhatsApp AI Gateway'
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Output "removed task: $TaskName"
} else {
  Write-Output "task not installed: $TaskName"
}
