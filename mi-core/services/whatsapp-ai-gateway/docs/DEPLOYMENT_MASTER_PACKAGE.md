# Deployment Master Package

**Bakudan Food Safety Gateway**  
**Version:** 1.0.0 | **Build:** 2026.06.09.001  
**Last updated:** 2026-06-12

> This document is the single source of truth for deploying, operating, and maintaining the Bakudan Food Safety Gateway. A new engineer can deploy, update, recover, and maintain the platform without reading source code.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Installer](#2-installer)
3. [Auto Updater](#3-auto-updater)
4. [WhatsApp Session](#4-whatsapp-session)
5. [Database](#5-database)
6. [Logs](#6-logs)

---

## 1. System Overview

### Architecture

```
Store Phone (WhatsApp)
        │
        │  Photo of food safety form
        ▼
  WhatsApp Group Chat
        │
        ▼
  WhatsApp Web.js (Node.js)
  session-manager.js
        │
        ├── Food Safety message? ──► OCR pipeline ──► SQLite DB ──► Google Sheets
        ├── /agent prefix?       ──► Agent-Coding gateway (port 4000)
        └── /mi prefix?          ──► Mi-Core server (port 3000)
        │
        ▼
  Express HTTP Server (port 3210)
  Dashboard UI + REST API
```

### Services

| Service | Role | Port | Process |
|---|---|---|---|
| Bakudan Gateway | Main app (WhatsApp + OCR + dashboard) | 3210 | node.exe src/index.js |
| Agent-Coding (optional) | External AI agent routing | 4000 | Separate process |
| Mi-Core (optional) | Internal AI assistant routing | 3000 | Separate process |

The gateway is standalone. Agent-Coding and Mi-Core only matter if `/agent` or `/mi` WhatsApp commands are used.

### Ports

| Port | Service | Protocol |
|---|---|---|
| 3210 | Bakudan Gateway dashboard + API | HTTP |
| 4000 | Agent-Coding (optional, external) | HTTP |
| 3000 | Mi-Core (optional, external) | HTTP |

### Dependencies

| Component | Version | Location | Internet? |
|---|---|---|---|
| Node.js | v24.14.1 | `Program Files/.../runtime/node/` | Bundled |
| Chromium | 148.0.7778.97 | `Program Files/.../runtime/chrome-win64/` | Bundled |
| SQLite | via better-sqlite3 | `node_modules/` | Bundled |
| WhatsApp Web.js | Latest at install | `node_modules/` | Bundled |
| Google Sheets API | googleapis | `node_modules/` | Runtime (HTTPS) |

**No internet required for installation.** Internet is only needed at runtime for Google Sheets sync and update checks.

### Startup Sequence

```
1. Windows boot
2. Scheduled task fires (45s delay for system readiness)
3. node.exe src/index.js launched as SYSTEM
4. src/index.js:
   a. db.init() — runs pending migrations, creates tables if needed
   b. Express HTTP server starts on port 3210
   c. WhatsApp client initializes (LocalAuth from ProgramData)
   d. If prior session exists → auto-connects (no QR needed)
   e. If no session → waits for QR scan via dashboard
   f. Heartbeat watchdog starts (60s probe interval)
5. App ready — dashboard accessible at http://localhost:3210
```

---

## 2. Installer

### Installer Location

```
installer/
├── Install Bakudan Food Safety.bat   ← double-click entry point
├── install.ps1                       ← main installer script
├── source/
│   └── BakudanFoodSafety-app.zip     ← application source
└── runtime/
    ├── node-v24.14.1-win-x64.zip     ← bundled Node.js
    └── chrome-win64/                 ← bundled Chromium
```

### Running the Installer

```
Double-click: installer/Install Bakudan Food Safety.bat
```

The .bat auto-elevates to Administrator (UAC prompt) and runs install.ps1.

**Silent mode (for IT / scripted deployment):**
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Silent
```

### Installation Flow

| Step | Action | Duration |
|---|---|---|
| 1 | Check Windows version (Win10+) and admin rights | <1s |
| 2 | Verify bundled runtime and source zip present | <1s |
| 3 | Create ProgramData folder structure | <1s |
| 4 | Extract app to Program Files | ~8s |
| 5 | Install Node.js runtime to Program Files | ~12s |
| 6 | Install Chromium to Program Files | ~15s |
| 7 | Write .env to ProgramData/config/ | <1s |
| 8 | Verify node_modules present | ~3s |
| 9 | Copy updater scripts | <1s |
| 10 | Create Desktop + Start Menu shortcuts | <1s |
| 11 | Register Windows scheduled task | ~3s |
| 12 | Start application | <1s |
| 13 | Wait for health check on port 3210 (max 120s) | ~22s |
| 14 | Open dashboard in browser | <1s |
| **Total** | | **~65 seconds** |

### ProgramData Structure

```
C:\ProgramData\BakudanFoodSafety\
├── db\
│   └── gateway.db              ← SQLite database (auto-created on first boot)
├── config\
│   └── .env                    ← all environment variables
├── data\                       ← temporary data files
├── uploads\                    ← form photo uploads
├── logs\
│   ├── gateway.log             ← main application log
│   ├── ocr.log                 ← OCR pipeline log
│   └── update.log              ← update/rollback history
├── backups\                    ← pre-update snapshots (created by updater)
└── whatsapp\
    ├── auth\                   ← WhatsApp session tokens (LocalAuth)
    └── cache\                  ← WhatsApp web cache
```

**Nothing in ProgramData is ever deleted by the installer or updater.** Only app source in Program Files is replaced during updates.

### Program Files Structure

```
C:\Program Files\BakudanFoodSafety\
├── app\
│   ├── src\                    ← application source (replaced on update)
│   ├── version.json            ← current version info
│   ├── node_modules\           ← dependencies (not replaced on update)
│   └── runtime\
│       ├── node\node.exe       ← Node.js v24.14.1 (not replaced on update)
│       └── chrome-win64\       ← Chromium (not replaced on update)
└── updater\
    └── bakudan-updater.ps1     ← PowerShell updater/rollback script
```

### Windows Scheduled Task

```
Name:         BakudanFoodSafety
Account:      SYSTEM
Run Level:    Highest Privileges (no UAC)
Triggers:     AtStartup (45s delay) + AtLogon (10s delay)
Restart:      On failure, 99 times, every 2 minutes
Command:      node.exe src/index.js
Working Dir:  C:\Program Files\BakudanFoodSafety\app
```

**Manage the task:**
```powershell
# View
schtasks /query /tn BakudanFoodSafety /fo LIST /v

# Stop
schtasks /end /tn BakudanFoodSafety

# Start
schtasks /run /tn BakudanFoodSafety

# Delete (uninstall)
schtasks /delete /tn BakudanFoodSafety /f
```

### Desktop Shortcuts

| Shortcut | Action |
|---|---|
| Start Bakudan Gateway | Starts the application |
| Stop Bakudan Gateway | Stops the application |
| Open Bakudan Dashboard | Opens http://localhost:3210 |
| Update Bakudan App | Runs bakudan-updater.ps1 update |

---

## 3. Auto Updater

### Update Check

The app checks for updates every 6 hours (configurable via `UPDATE_CHECK_INTERVAL_HOURS` in `.env`).

**Manifest URL** (set in `.env`):
```
UPDATE_MANIFEST_URL=https://raw.githubusercontent.com/liemdo28/bakudan-releases/main/update-manifest.json
```

**Manifest format:**
```json
{
  "latestVersion": "1.0.1",
  "build": "2026.06.12.001",
  "channel": "stable",
  "downloadUrl": "https://releases.../BakudanFoodSafety-1.0.1.zip",
  "sha256": "abc123...",
  "releaseNotes": "Bug fixes and performance improvements.",
  "minSupportedVersion": "1.0.0"
}
```

### Update Flow

```
Dashboard shows "Update Available: v1.0.1"
    │
    ▼
User clicks "Update"
    │
    ▼
POST /api/updates/install   (SSE stream opens — progress shown in browser)
    │
    ├── Fetch + verify manifest
    ├── Download ZIP (HTTPS only, SHA256 verified)
    ├── Stop application
    ├── Create backup (DB + config + app source snapshot)
    ├── Extract and validate ZIP (path traversal guard)
    ├── Replace app source in Program Files
    ├── Re-apply .env from ProgramData
    ├── Start application
    ├── Wait for health check (up to 90s)
    │   ├── PASS → "Update complete: v1.0.0 → v1.0.1"
    │   └── FAIL → auto-rollback triggered → "Rolled back to v1.0.0"
    │
    └── SSE stream closes
```

### Version Management

```
GET /api/updates/version
→ { version, build, channel, backups: [...last 5] }

GET /api/updates/status
→ { updateAvailable, current, manifest, lastChecked }

POST /api/updates/check
→ triggers immediate manifest check
```

### Rollback

```
Dashboard → Update panel → Rollback → select backup
    │
    ▼
POST /api/updates/rollback
Body: { "target": "backup-20260612-120000-pre-v1.0.1" }
    │
    ├── Stop application
    ├── Restore DB snapshot
    ├── Restore .env
    ├── Restore app source
    ├── Start application
    └── Health check → confirm rollback version
```

**Manual rollback via PowerShell:**
```powershell
cd "C:\Program Files\BakudanFoodSafety"
powershell -ExecutionPolicy Bypass -File updater\bakudan-updater.ps1 rollback latest
```

**What is preserved across every update:**

| Data | Location | Preserved by |
|---|---|---|
| SQLite DB | ProgramData/db/ | Outside AppDir — untouched |
| .env config | ProgramData/config/ | Re-applied after replace |
| WhatsApp session | ProgramData/whatsapp/ | Outside AppDir — untouched |
| Logs | ProgramData/logs/ | Outside AppDir — untouched |
| Node.js runtime | Program Files/.../runtime/ | Excluded from replacement |
| node_modules | Program Files/.../node_modules/ | Excluded from replacement |

---

## 4. WhatsApp Session

### Session Location

```
C:\ProgramData\BakudanFoodSafety\whatsapp\
├── auth\       ← LocalAuth tokens — survives app updates, reboots, git pulls
└── cache\      ← WhatsApp web cache
```

The session path is set in `.env` as `SESSION_DIR` and `WWEBJS_CACHE_DIR`. It is **outside the app directory** — updating or reinstalling the app never affects the session.

### Session States

| State | Meaning | Action Required |
|---|---|---|
| `INITIALIZING` | App just started, loading session | Wait up to 30s |
| `QR_READY` | No existing session — QR shown in dashboard | Scan QR with store phone |
| `READY` | Connected and authenticated | None |
| `DISCONNECTED` | Lost connection | Auto-reconnect in 15–120s |
| `RECONNECTING` | Attempting reconnect (exponential backoff) | Wait; alert if >3 attempts |

### Auto-Reconnect (Exponential Backoff)

```
Attempt 1: wait 15s then reconnect
Attempt 2: wait 30s then reconnect
Attempt 3: wait 60s then reconnect → alert sent
Attempt 4+: wait 120s per attempt → alert every 3rd attempt
```

Reconnect count resets to 0 on successful `READY` event.

### Heartbeat Watchdog

Every 60 seconds, the watchdog calls `client.getState()`.  
If state is `null`, `CONFLICT`, or `UNPAIRED` → triggers reconnect.  
This catches silent crashes where WhatsApp dies without firing a `disconnected` event.

### QR Reconnect Procedure

Used when session is expired (phone unlinked, >14 days offline, factory reset):

```
1. Open dashboard: http://localhost:3210
2. Navigate to WhatsApp panel
3. Click "Force Reconnect" (or wait for auto-reconnect to reach QR state)
4. QR code appears in dashboard
5. On store phone: WhatsApp → Settings → Linked Devices → Link a Device
6. Scan QR code
7. Status changes to READY within 10–20 seconds
```

### Session Backup Procedure

```powershell
# Manual backup of WhatsApp session
$src = "C:\ProgramData\BakudanFoodSafety\whatsapp\auth"
$dst = "C:\ProgramData\BakudanFoodSafety\backups\whatsapp-manual-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -Path $src -Destination $dst -Recurse
```

Run this before major changes (OS update, hardware migration, etc.).

### Session Restore Procedure

```powershell
# Restore from backup (replace current session)
$backup = "C:\ProgramData\BakudanFoodSafety\backups\whatsapp-manual-20260612-120000"
$target = "C:\ProgramData\BakudanFoodSafety\whatsapp\auth"

# Stop app first
schtasks /end /tn BakudanFoodSafety

Remove-Item -Path $target -Recurse -Force
Copy-Item -Path $backup -Destination $target -Recurse

# Restart app
schtasks /run /tn BakudanFoodSafety
```

---

## 5. Database

### Location

```
C:\ProgramData\BakudanFoodSafety\db\gateway.db
```

SQLite single-file database. Never deleted by installer or updater.

### Key Tables

| Table | Purpose |
|---|---|
| `food_safety_submissions` | All OCR-processed form submissions |
| `api_keys` | Client API keys (hashed, never plain text) |
| `api_key_audit` | API key create/rotate/revoke events |
| `routed_messages` | Last 1000 WhatsApp routed messages |
| `manager_alerts` | Food safety alerts sent to managers |
| `store_groups` | WhatsApp group → store mapping |
| `pilot_stone_oak` | Stone Oak pilot tracker (10-form pilot) |

### Backup

**Automatic:** Every update creates a DB snapshot in `ProgramData/backups/`.

**Manual backup:**
```powershell
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$src = "C:\ProgramData\BakudanFoodSafety\db\gateway.db"
$dst = "C:\ProgramData\BakudanFoodSafety\backups\manual-db-$ts\gateway.db"
New-Item -ItemType Directory -Path (Split-Path $dst) -Force
Copy-Item $src $dst
```

**Recommended:** Schedule daily backups to an external drive or network share.

### Restore

```powershell
# Stop app
schtasks /end /tn BakudanFoodSafety

# Replace DB with backup
$backup = "C:\ProgramData\BakudanFoodSafety\backups\backup-20260612-120000-pre-v1.0.1\gateway.db"
Copy-Item $backup "C:\ProgramData\BakudanFoodSafety\db\gateway.db" -Force

# Restart app
schtasks /run /tn BakudanFoodSafety
```

### Migration Procedure

Migrations run automatically on startup. To run manually:

```powershell
cd "C:\Program Files\BakudanFoodSafety\app"
.\runtime\node\node.exe -e "require('./src/db').init().then(() => { console.log('Done'); process.exit(0); })"
```

Migrations are in `src/migrations/` and are idempotent — safe to run multiple times.

### Inspect Database

```powershell
# Open SQLite shell (requires sqlite3.exe)
sqlite3 "C:\ProgramData\BakudanFoodSafety\db\gateway.db"

# Useful queries
.tables
SELECT COUNT(*) FROM food_safety_submissions;
SELECT store_id, COUNT(*) FROM food_safety_submissions GROUP BY store_id;
SELECT * FROM food_safety_submissions ORDER BY created_at DESC LIMIT 10;
```

---

## 6. Logs

### Location

```
C:\ProgramData\BakudanFoodSafety\logs\
├── gateway.log     ← main application log (all events)
├── ocr.log         ← OCR pipeline: confidence scores, NEEDS_REVIEW flags
└── update.log      ← update and rollback history
```

### Log Format

```
[2026-06-12T12:00:00.000Z] [INFO]  [whatsapp] Client ready
[2026-06-12T12:00:01.000Z] [INFO]  [router] Message routed: food_safety (stone_oak)
[2026-06-12T12:00:02.000Z] [INFO]  [ocr] Submission saved: id=142 confidence=0.91
[2026-06-12T12:00:03.000Z] [ERROR] [sheets] Sync failed: PERMISSION_DENIED
```

### Log Rotation

Logs are append-only. No automatic rotation is built in.

**Recommended: rotate weekly via Task Scheduler**
```powershell
# Add to a weekly scheduled task
$log = "C:\ProgramData\BakudanFoodSafety\logs\gateway.log"
$ts  = Get-Date -Format 'yyyyMMdd'
Rename-Item $log "gateway-$ts.log"
# App will create a new gateway.log on next write
```

**Recommended retention:** 90 days (delete logs older than 90 days monthly).

### Log Troubleshooting Reference

| Pattern | Meaning | Action |
|---|---|---|
| `[ERROR] [whatsapp] disconnected` | WhatsApp lost connection | Auto-reconnect in progress; check after 2 min |
| `[ERROR] [sheets] PERMISSION_DENIED` | Google service account lacks Sheet access | Share Sheet with service account email |
| `[ERROR] [ocr] confidence below threshold` | Photo too blurry/dark | Ask store to resubmit |
| `[WARN] [router] unknown store` | Group chat ID not in .env | Add GROUP_CHAT_ID to .env |
| `[ERROR] [db] SQLITE_BUSY` | Two processes accessing DB | Kill duplicate node.exe in Task Manager |
| `[ERROR] [updater] SHA256 mismatch` | Download corrupted | Retry update; check network |

### Live Log Tailing

```powershell
# Follow gateway.log in real time
Get-Content "C:\ProgramData\BakudanFoodSafety\logs\gateway.log" -Wait -Tail 50
```

---

## Quick Reference

| Task | Command / URL |
|---|---|
| Open dashboard | http://localhost:3210 |
| Start app | `schtasks /run /tn BakudanFoodSafety` |
| Stop app | `schtasks /end /tn BakudanFoodSafety` |
| Check app status | `GET http://localhost:3210/api/health` |
| WhatsApp session status | `GET http://localhost:3210/api/whatsapp/session` |
| Trigger update check | `POST http://localhost:3210/api/updates/check` |
| List backups | `GET http://localhost:3210/api/updates/backups` |
| Tail logs | `Get-Content ...logs\gateway.log -Wait -Tail 50` |
| Manual rollback | `powershell -File updater\bakudan-updater.ps1 rollback latest` |
