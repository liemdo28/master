# Auto Updater Report

**Generated:** 2026-06-12  
**Modules:**  
- `src/updater/update-service.js` — base service (pre-existing)  
- `src/updater/auto-updater-service.js` — AutoUpdaterService (new)  
- `updater/bakudan-updater.ps1` — PowerShell orchestrator (pre-existing, comprehensive)

---

## Architecture

```
Admin UI (browser)
     │
     ├── GET /api/updates/status    → AutoUpdaterService.getLastCheckResult()
     ├── POST /api/updates/check    → AutoUpdaterService.checkForUpdates()
     ├── GET /api/updates/version   → AutoUpdaterService.getVersionInfo() [NEW]
     ├── GET /api/updates/backups   → AutoUpdaterService.listBackups() [NEW]
     │
     ├── POST /api/updates/install  → SSE stream → bakudan-updater.ps1 update
     └── POST /api/updates/rollback → SSE stream → bakudan-updater.ps1 rollback [target]
```

The Node.js side handles version checking and UI feedback. The PowerShell script handles the actual file replacement (requires admin, stops/starts the service).

---

## Component Details

### VersionManager

```js
const vm = new VersionManager();
vm.read()                    // → { version, build, channel, releaseDate }
vm.getCurrentVersion()       // → '1.0.0'
vm.isNewer('1.0.1', '1.0.0') // → true
vm.write(data)               // update version.json
```

Reads/writes `version.json` in app root. Comparison is semver-aware (major.minor.patch).

### UpdateDownloader

```js
const dl = new UpdateDownloader();
dl.on('start', ({url}) => log('downloading...'));
dl.on('complete', ({path, sha256, size}) => log('done'));
dl.on('error', (err) => log('failed', err));

const zipPath = await dl.downloadFromManifest(manifest);
// Downloads manifest.downloadUrl with SHA256 verification
```

HTTPS-only. Streams to temp file. Verifies SHA256 before resolving. Rejects on mismatch.

### RollbackManager

```js
const rm = new RollbackManager();
rm.listBackups()      // → [{ name, path, meta }] sorted newest first
rm.getLatestBackup()  // → most recent backup or null
rm.spawnRollback('backup-20260612-120000-pre-v1.0.1') // → child_process
rm.recordRollback('1.0.1', '1.0.0', 'ok', 'health check passed')
```

Backup directory: `C:\ProgramData\BakudanFoodSafety\backups\`

### AutoUpdaterService

```js
const updater = getInstance();  // singleton

// Check for updates
const result = await updater.checkForUpdates();
// emits: 'update-available', 'up-to-date', 'check-error'

// Download
const zipPath = await updater.downloadUpdate(manifest);

// Spawn install (for SSE streaming)
const child = updater.spawnInstall();

// Rollback
const child = updater.spawnRollback('latest');

// Version info
updater.getVersionInfo();
// → { version, build, channel, backups: [...] }

// Backup list
updater.listBackups();
// → [{ name, path, meta }]
```

---

## Update Flow (End-to-End)

```
1. Browser polls GET /api/updates/status (every 4h via dashboard)
2. If updateAvailable=true → dashboard shows "Update Available" button
3. User clicks → POST /api/updates/install (SSE stream opens)
4. SSE streams bakudan-updater.ps1 stdout in real-time:
   [..] Fetching manifest...
   [OK] Manifest: v1.0.1 build 2026.06.12.001
   [..] Downloading https://...
   [OK] SHA256 verified
   [..] Stopping app...
   [OK] App stopped
   [OK] Backup at C:\ProgramData\...\backups\backup-20260612...
   [..] Extracting...
   [OK] Package structure validated
   [OK] App updated
   [..] Starting app...
   [..] Waiting up to 90s for health...
   [OK] Update complete: v1.0.0 → v1.0.1
5. SSE done event → browser shows "Restart complete"
```

**Rollback on failure:**  
If health check fails after update → `Restore-Backup $backupDir` → `Start-App` → SSE sends error.  
User can also manually trigger `POST /api/updates/rollback` at any time.

---

## What Is Preserved During Update

| Data | Location | Preserved by |
|---|---|---|
| SQLite database | `C:\ProgramData\BakudanFoodSafety\db\gateway.db` | Not in AppDir — untouched |
| `.env` config | `C:\ProgramData\BakudanFoodSafety\config\.env` | Copied back after replace |
| WhatsApp session | `C:\ProgramData\BakudanFoodSafety\whatsapp\` | Not in AppDir — untouched |
| Logs | `C:\ProgramData\BakudanFoodSafety\logs\` | Not in AppDir — untouched |
| Node.js runtime | `C:\Program Files\BakudanFoodSafety\app\runtime\` | Excluded from delete |
| node_modules | `C:\Program Files\BakudanFoodSafety\app\node_modules\` | Excluded from delete |

Only `src/`, `installer/`, `updater/`, `version.json`, and other app code files are replaced.

---

## Update Manifest Format

The server checks `UPDATE_MANIFEST_URL` (env var). Manifest must be HTTPS JSON:

```json
{
  "latestVersion": "1.0.1",
  "build": "2026.06.12.001",
  "channel": "stable",
  "downloadUrl": "https://releases.example.com/BakudanFoodSafety-1.0.1.zip",
  "sha256": "abc123...",
  "releaseNotes": "Bug fixes and performance improvements.",
  "minSupportedVersion": "1.0.0"
}
```

Default manifest URL: `https://raw.githubusercontent.com/liemdo28/bakudan-releases/main/update-manifest.json`

---

## New API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/updates/version` | Version info + last 5 backups |
| `GET /api/updates/backups` | Full backup list from ProgramData |

---

## Verdict

**COMPLETE.** AutoUpdaterService, VersionManager, UpdateDownloader, RollbackManager all implemented. Update flow: check → download → stop → backup → replace → restart → health check → rollback on failure. DB, config, session, logs all preserved. One-click update from dashboard via SSE stream.
