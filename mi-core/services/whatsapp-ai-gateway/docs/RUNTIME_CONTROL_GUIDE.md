# Runtime Control Guide

Date: 2026-06-05

## Double-click Controls

Folder:

`shortcuts/`

Files:

- `Start Gateway Hidden.bat`
- `Stop Gateway.bat`
- `Open Dashboard.bat`
- `Gateway Status.bat`
- `Install Auto Start.bat`
- `Uninstall Auto Start.bat`

## Manual Commands

Start hidden:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows/start-gateway-hidden.ps1
```

Stop:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows/stop-gateway.ps1
```

Status:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows/status-gateway.ps1
```

Install autostart:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows/install-autostart.ps1
```

Uninstall autostart:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows/uninstall-autostart.ps1
```

## Dashboard Controls

Open:

```text
http://localhost:3210
```

The Admin Control Center includes a `Runtime Control` panel with:

- Status
- Start Hidden
- Stop
- Install Auto Start
- Uninstall Auto Start

API status endpoint:

```text
GET /api/runtime/control/status
```
