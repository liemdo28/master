# Windows Autostart Report

Date: 2026-06-05

## Added

- `scripts/windows/install-autostart.ps1`
- `scripts/windows/uninstall-autostart.ps1`

Task name:

`WhatsApp AI Gateway`

Trigger:

At user logon, delayed 30 seconds.

Action:

`powershell.exe -ExecutionPolicy Bypass -File "E:\Project\Master\whatsapp-ai-gateway\scripts\windows\start-gateway-hidden.ps1"`

Settings include restart on failure.

## Verification

- `node tests/windows/runtime-service-tests.js` PASS.
- `scripts/windows/status-gateway.ps1` reports gateway running on port 3210.
- Runtime control endpoint `/api/runtime/control/status` returns task/script metadata and live process status.
