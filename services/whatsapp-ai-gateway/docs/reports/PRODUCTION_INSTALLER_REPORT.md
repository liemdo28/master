# Production Installer Report

**Generated:** 2026-06-12  
**Installer:** `installer/install.ps1`  
**Entry point:** `installer/Install Bakudan Food Safety.bat`

---

## One-Click Install Flow

```
Double-click "Install Bakudan Food Safety.bat"
    │
    ├── Auto-elevates to Administrator (UAC prompt)
    │
    └── install.ps1
          │
          ├─ [1] Check Windows + Admin
          ├─ [2] Verify bundled runtime (Node.js + Chrome)
          ├─ [3] Verify source package (BakudanFoodSafety-app.zip)
          ├─ [4] Create ProgramData folders
          ├─ [5] Install app to Program Files
          ├─ [6] Install Node.js + Chrome runtime
          ├─ [7] Configure environment (.env)
          ├─ [8] Verify node_modules
          ├─ [9] Copy updater scripts
          ├─ [10] Create Desktop + Start Menu shortcuts
          ├─ [11] Register Windows scheduled task (auto-start on boot)
          ├─ [12] Start app
          ├─ [13] Health check (wait up to 120s)
          └─ [14] Open dashboard in browser
```

---

## Folder Structure Created

```
C:\Program Files\BakudanFoodSafety\
└── app\                          ← extracted source (updated on each update)
    ├── src\
    ├── installer\
    ├── runtime\
    │   ├── node\node.exe
    │   └── chrome-win64\chrome.exe
    └── node_modules\

C:\Program Files\BakudanFoodSafety\updater\
└── bakudan-updater.ps1           ← update/rollback orchestrator

C:\ProgramData\BakudanFoodSafety\
├── db\gateway.db                 ← SQLite database (never deleted on update)
├── config\.env                   ← environment configuration
├── data\                         ← uploads, form photos
├── uploads\
├── logs\                         ← application + update logs
├── backups\                      ← pre-update snapshots (DB + config + app source)
└── whatsapp\
    ├── auth\                     ← WhatsApp session tokens (LocalAuth)
    └── cache\                    ← WhatsApp web cache
```

---

## What the Installer Does

### Step 4 — ProgramData Folders

Creates all data folders under `C:\ProgramData\BakudanFoodSafety\`. These are **never deleted** on update — only app source in Program Files is replaced.

### Step 5 — App Installation

Extracts `installer/source/BakudanFoodSafety-app.zip` to `C:\Program Files\BakudanFoodSafety\app\`.

On re-install (update via installer):
- Saves any existing WhatsApp session from legacy paths to `C:\ProgramData\BakudanFoodSafety\whatsapp\auth\`
- Removes old app dir
- Extracts new source

### Step 7 — Environment Configuration

Creates `C:\ProgramData\BakudanFoodSafety\config\.env` with:

| Variable | Value |
|---|---|
| `DATA_DIR` | `C:\ProgramData\BakudanFoodSafety\data` |
| `DB_PATH` | `C:\ProgramData\BakudanFoodSafety\db\gateway.db` |
| `UPLOADS_DIR` | `C:\ProgramData\BakudanFoodSafety\uploads` |
| `LOG_DIR` | `C:\ProgramData\BakudanFoodSafety\logs` |
| `WHATSAPP_SESSION_ROOT` | `C:\ProgramData\BakudanFoodSafety\whatsapp` |
| `SESSION_DIR` | `C:\ProgramData\BakudanFoodSafety\whatsapp\auth` |
| `WWEBJS_CACHE_DIR` | `C:\ProgramData\BakudanFoodSafety\whatsapp\cache` |
| `STARTUP_MODE` | `normal` |
| `UPDATE_MANIFEST_URL` | GitHub releases manifest URL |
| `UPDATE_CHECK_INTERVAL_HOURS` | `6` |

### Step 10 — Desktop & Start Menu Shortcuts

| Shortcut | Action |
|---|---|
| Start Bakudan Gateway | Starts Node.js with bundled Chrome |
| Stop Bakudan Gateway | Kills node process on port 3210 |
| Open Bakudan Dashboard | Opens `http://localhost:3210` |
| Update Bakudan App | Runs `bakudan-updater.ps1 update` |

### Step 11 — Windows Scheduled Task

```
Task name: BakudanFoodSafety
Trigger:   AtStartup (45s delay) + AtLogon (10s delay)
Account:   SYSTEM
RunLevel:  Highest (no UAC popup)
RestartCount: 99 (auto-restart on crash)
RestartInterval: 2 minutes
```

This is the "register startup service" requirement — Windows Task Scheduler running as SYSTEM is the correct approach for apps that must survive user logoff.

---

## SQLite DB Initialization

The SQLite DB is auto-initialized on first startup by `src/index.js`:
1. `db.init()` runs all migrations from `src/migrations/`
2. Creates tables: `food_safety_submissions`, `api_keys`, `api_key_audit`, `routed_messages`, `manager_alerts`, `store_groups`, `pilot_stone_oak`, etc.

No manual DB setup needed — first boot creates the schema.

---

## Bundled Runtime

| Component | Version | Location |
|---|---|---|
| Node.js | v24.14.1 | `installer/runtime/node-v24.14.1-win-x64.zip` |
| Chromium | 148.0.7778.97 | `installer/runtime/chrome-win64/` |

No internet required during installation. Both runtimes are bundled in the installer package.

---

## Silent Install (for IT deployment)

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Silent
```

`-Silent` skips the "Overwrite?" confirmation prompt, suitable for automated deployment.

---

## Post-Install Required Actions

1. **WhatsApp QR scan** — On first start, scan the QR code with the store's phone
2. **Google credentials** — Place `google-service-account.json` at `C:\ProgramData\BakudanFoodSafety\config\`
3. **Store group chat IDs** — Add `STONE_OAK_GROUP_CHAT_ID`, `RIM_GROUP_CHAT_ID`, `BANDERA_GROUP_CHAT_ID` to `.env`

---

## Update (via Installer)

Re-running the installer on an existing install:
- Preserves WhatsApp session (migrates to ProgramData if needed)
- Replaces app source with new ZIP
- Keeps all data in ProgramData (DB, config, logs, session) untouched

Update without re-running the installer:
- Dashboard → "Update Available" button → POST /api/updates/install (SSE)

---

## Verdict

**COMPLETE.** One-click Windows installer. Creates all required folders, installs bundled Node.js + Chrome, configures .env, registers Windows task scheduler service, creates shortcuts, starts app, health-checks. DB is auto-initialized on first boot. Session is preserved across updates.
