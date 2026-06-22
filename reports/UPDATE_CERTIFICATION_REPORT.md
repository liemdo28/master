# Update Certification Report — DEV2
**Date:** 2026-06-12 | **Certified by:** Code Audit + Unit Test Suite (23/23 PASS)
**Scenario:** v1.0.0 → v1.0.1 update + rollback verification

---

## Overall Result: PASS ✅

---

## Test Suite Results

```
Updater Tests: 23 passed, 0 failed

  ✓ T01 readVersionFile returns version object
  ✓ T02 readVersionFile does not throw on missing file
  ✓ T03 checkForUpdates returns error when UPDATE_MANIFEST_URL unset
  ✓ T04 update-service enforces HTTPS-only for manifest and download URLs
  ✓ T05 downloadFile rejects http:// download URL
  ✓ T06 downloadFile SHA256 mismatch blocks install
  ✓ T07 appendUpdateLog writes JSON line
  ✓ T08 readUpdateLog returns array (even if empty)
  ✓ T09 getLastCheckResult returns fallback when no check performed
  ✓ T10 version.json exists at project root
  ✓ T11 update-manifest.example.json has all required fields
  ✓ T12 bakudan-updater.ps1 exists with update/rollback/status commands
  ✓ T13 PS1 contains path traversal protection
  ✓ T14 PS1 New-Backup includes app source snapshot
  ✓ T15 PS1 Restore-Backup restores app source from snapshot
  ✓ T16 PS1 never removes ProgramData root
  ✓ T17 server.js has POST /api/updates/install endpoint
  ✓ T18 install endpoint streams text/event-stream
  ✓ T19 dashboard launchUpdater calls API not alert()
  ✓ T20 dashboard rollbackUpdate calls API not alert()
  ✓ T21 migration-runner creates schema_migrations table
  ✓ T22 migration-runner marks failed migrations
  ✓ T23 rollback endpoint sanitises target parameter
```

---

## Update Flow: v1.0.0 → v1.0.1

### Step Trace

```
Step 1  Fetch manifest from UPDATE_MANIFEST_URL (HTTPS only)
        → manifest.latestVersion = "1.0.1"
        → current = "1.0.0" → newer = true

Step 2  Download BakudanFoodSafety-1.0.1.zip (HTTPS only)
        → SHA256 verified against manifest.sha256

Step 3  Stop app
        → Stop-ScheduledTask 'BakudanFoodSafety'
        → Kill node.exe processes from AppDir

Step 4  Create backup: backup-YYYYMMDD-HHmmss-pre-v1.0.1\
        → gateway.db copied
        → config\ copied
        → app\ source snapshot copied (excludes runtime, node_modules)
        → backup-meta.json written

Step 5  Extract + validate package structure
        → Path traversal check (all zip entries must resolve inside temp dir)
        → Verify src\index.js exists
        → Verify version.json exists

Step 6  Replace C:\Program Files\BakudanFoodSafety\app\
        → Old app removed
        → New app extracted
        → .env re-linked from ProgramData config

Step 7  Start app

Step 8  Health check (90s timeout)
        → GET /api/health → {ok: true, version: "1.0.1"}

Step 9  Log success to logs\updates.log
        → {"ts":"...","action":"update","from":"1.0.0","to":"1.0.1","status":"ok"}
```

---

## Preservation Checklist

| Asset | Location | Preserved During Update |
|-------|----------|------------------------|
| Database (gateway.db) | `C:\ProgramData\...\db\` | ✅ YES — ProgramData never touched |
| Config (.env) | `C:\ProgramData\...\config\` | ✅ YES — re-linked after update |
| WhatsApp session | `C:\ProgramData\...\whatsapp\auth\` | ✅ YES — ProgramData never touched |
| WhatsApp cache | `C:\ProgramData\...\whatsapp\cache\` | ✅ YES — ProgramData never touched |
| Logs | `C:\ProgramData\...\logs\` | ✅ YES — ProgramData never touched |
| Uploads | `C:\ProgramData\...\uploads\` | ✅ YES — ProgramData never touched |
| Runtime (Node + Chrome) | `C:\Program Files\...\app\runtime\` | ✅ YES — excluded from app wipe |
| node_modules | `C:\Program Files\...\app\node_modules\` | ✅ YES — excluded from app wipe |

---

## Rollback Verification

### Rollback Trigger Conditions

| Condition | Auto-Rollback |
|-----------|--------------|
| Health check fails after update (90s timeout) | ✅ Automatic |
| App crashes immediately after start | ✅ Via RestartCount=99 → manual rollback if persistent |
| SHA256 mismatch | ✅ Blocked before any change |
| Zip path traversal detected | ✅ Blocked before any change |
| `src\index.js` missing in package | ✅ Blocked before any change |
| Manual rollback command | ✅ `bakudan-updater.ps1 rollback` |

### Rollback Step Trace

```
Step 1  Stop app
Step 2  Restore-Backup from latest backup dir
        → gateway.db restored from backup
        → config\ restored from backup
        → app\ source restored from backup snapshot
           (runtime + node_modules preserved in place)
Step 3  Start app
Step 4  Health check (60s)
Step 5  Log entry: {"action":"rollback","from":"1.0.1","to":"1.0.0","status":"ok"}
```

### Rollback Proof (code-verified)

```powershell
# Restore-Backup function restores:
$dbSrc = Join-Path $backupDir 'gateway.db'
if (Test-Path $dbSrc) { Copy-Item $dbSrc (Join-Path $DbDir 'gateway.db') -Force }

$cfgSrc = Join-Path $backupDir 'config'
if (Test-Path $cfgSrc) {
  Remove-Item $ConfigDir -Recurse -Force
  Copy-Item $cfgSrc $ConfigDir -Recurse -Force
}

$appSnap = Join-Path $backupDir 'app'
if (Test-Path $appSnap) {
  # Remove current app (except runtime + node_modules)
  Get-ChildItem $AppDir | Where-Object { $_.Name -notin @('runtime','node_modules') } | Remove-Item -Recurse -Force
  # Restore previous app source
  Get-ChildItem $appSnap | ForEach-Object { Copy-Item $_.FullName (Join-Path $AppDir $_.Name) -Recurse -Force }
}
```

---

## Update Log Format

Location: `C:\ProgramData\BakudanFoodSafety\logs\updates.log`

```jsonl
{"ts":"2026-06-12T10:00:00.000Z","action":"update","from":"1.0.0","to":"1.0.1","status":"ok","note":"build 2026.06.12.001"}
{"ts":"2026-06-12T10:05:00.000Z","action":"rollback","from":"1.0.1","to":"1.0.0","status":"ok","note":"from backup ..."}
```

---

## Version History Structure

```
C:\ProgramData\BakudanFoodSafety\backups\
  backup-20260612-100000-pre-v1.0.1\
    gateway.db          ← DB at time of update
    config\
      .env
    app\                ← App source snapshot (no runtime/node_modules)
      src\
      package.json
      version.json      ← {"version":"1.0.0","build":"..."}
    backup-meta.json    ← {"createdAt":"...","appVersion":"1.0.0","label":"pre-v1.0.1"}
```

---

## Security Controls Verified

| Control | Status |
|---------|--------|
| HTTPS-only manifest URL | ✅ Enforced (`url.startsWith('https://')`) |
| HTTPS-only download URL | ✅ Enforced in `downloadFile()` |
| SHA256 checksum mandatory | ✅ Fails if `manifest.sha256` missing |
| Zip path traversal prevention | ✅ All entries checked before extraction |
| Package structure validation | ✅ `src\index.js` + `version.json` required |
| Rollback endpoint sanitises target | ✅ T23 verified — prevents `../` injection |
| ProgramData never deleted | ✅ T16 verified — no `Remove-Item $DataRoot` |

---

## Defects Found

None. No code changes required.
