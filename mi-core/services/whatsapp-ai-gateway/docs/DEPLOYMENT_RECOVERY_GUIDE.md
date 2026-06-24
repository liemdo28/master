# Deployment Recovery Guide

**Bakudan Food Safety Gateway**  
**Last updated:** 2026-06-12

> Step-by-step recovery procedures for every known failure mode. No source code reading required.

---

## Table of Contents

1. [Failed Install](#1-failed-install)
2. [Failed Update](#2-failed-update)
3. [Broken WhatsApp Session](#3-broken-whatsapp-session)
4. [Database Restore](#4-database-restore)
5. [Manual Rollback](#5-manual-rollback)
6. [Disaster Recovery](#6-disaster-recovery)

---

## 1. Failed Install

### Symptoms

- Installer exits with an error message
- Dashboard does not open after installation
- `http://localhost:3210` refuses connection
- App does not start on Windows boot

---

### 1A — Installer fails mid-way (extraction error)

**Cause:** Source zip missing, corrupted, or insufficient disk space.

```
1. Check disk space:
   Get-PSDrive C | Select-Object Used, Free

2. Verify installer package is complete:
   dir installer\source\BakudanFoodSafety-app.zip
   (should be > 50MB)

3. If zip is missing or small, re-copy the installer package

4. Re-run installer:
   Double-click: Install Bakudan Food Safety.bat
```

---

### 1B — App starts but dashboard won't load

**Cause:** Port 3210 in use, or Node.js failed to start.

```
1. Check if something else is on port 3210:
   netstat -ano | findstr :3210

2. If port in use by another process:
   taskkill /PID <pid> /F
   schtasks /run /tn BakudanFoodSafety

3. Check app log for startup error:
   Get-Content C:\ProgramData\BakudanFoodSafety\logs\gateway.log -Tail 30

4. Common startup errors:
   - "Cannot find module" → node_modules missing → re-run installer
   - "EADDRINUSE" → port conflict → kill conflicting process
   - "DB migration failed" → see Section 4 (Database Restore)
```

---

### 1C — Scheduled task not running after reboot

**Cause:** Task registration failed, or SYSTEM account lacks permissions.

```
1. Check task exists:
   schtasks /query /tn BakudanFoodSafety

2. If not found, register manually:
   powershell -ExecutionPolicy Bypass -File installer\install.ps1 -Silent

3. If task exists but won't run, check task history:
   schtasks /query /tn BakudanFoodSafety /fo LIST /v
   Look for "Last Run Result" — 0x0 = success, anything else = error

4. Manually start the task to test:
   schtasks /run /tn BakudanFoodSafety
   Start-Sleep 20
   Invoke-WebRequest http://localhost:3210/api/health
```

---

### 1D — Clean reinstall (wipe and start over)

**Use when:** Multiple failures, corrupted state, moving to a new machine.

```
WARNING: This deletes all app data. Back up ProgramData first.

# Step 1: Backup data
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item C:\ProgramData\BakudanFoodSafety D:\BakudanBackup-$ts -Recurse

# Step 2: Stop and remove
schtasks /end /tn BakudanFoodSafety
schtasks /delete /tn BakudanFoodSafety /f
Remove-Item "C:\Program Files\BakudanFoodSafety" -Recurse -Force
Remove-Item "C:\ProgramData\BakudanFoodSafety" -Recurse -Force

# Step 3: Reinstall
Double-click: Install Bakudan Food Safety.bat

# Step 4: Restore data
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Copy-Item D:\BakudanBackup-$ts\db\gateway.db C:\ProgramData\BakudanFoodSafety\db\
Copy-Item D:\BakudanBackup-$ts\config\.env C:\ProgramData\BakudanFoodSafety\config\
Copy-Item D:\BakudanBackup-$ts\whatsapp\auth C:\ProgramData\BakudanFoodSafety\whatsapp\ -Recurse
schtasks /run /tn BakudanFoodSafety
```

---

## 2. Failed Update

### Symptoms

- Dashboard shows "Update failed"
- App doesn't respond after update attempt
- Version shows incorrectly after update

---

### 2A — Auto-rollback succeeded (most common)

The updater automatically rolls back if health check fails. Dashboard shows:  
`"Update failed — rolled back to v1.0.0 automatically."`

```
1. Verify app is running:
   GET http://localhost:3210/api/health

2. Verify version rolled back:
   GET http://localhost:3210/api/updates/version

3. Check update log for failure reason:
   Get-Content C:\ProgramData\BakudanFoodSafety\logs\update.log -Tail 20

4. Common reasons and fixes:
   - "SHA256 mismatch" → download was corrupted; retry update later
   - "health_check_timeout" → app took >90s to start; check for startup errors
   - "structure_invalid" → bad update package; contact support
   - "permission_denied" → installer ran as user, not SYSTEM; re-register task

5. Retry update when root cause is resolved:
   POST http://localhost:3210/api/updates/check
   Then click Update in dashboard
```

---

### 2B — Auto-rollback failed (app not responding)

```
1. Open PowerShell as Administrator

2. Stop any running node process:
   Stop-Process -Name node -Force -ErrorAction SilentlyContinue

3. Run manual rollback:
   cd "C:\Program Files\BakudanFoodSafety"
   powershell -ExecutionPolicy Bypass -File updater\bakudan-updater.ps1 rollback latest

4. Wait for rollback to complete (watch PowerShell output)

5. Verify recovery:
   Start-Sleep 20
   Invoke-WebRequest http://localhost:3210/api/health

6. If rollback also fails: proceed to Section 5 (Manual Rollback) or Section 6 (Disaster Recovery)
```

---

### 2C — No backup exists (first update, backup creation failed)

```
1. Stop the app:
   schtasks /end /tn BakudanFoodSafety
   Stop-Process -Name node -Force -ErrorAction SilentlyContinue

2. Re-run installer (reinstalls from bundled zip — restores v1.0.0 source):
   Double-click: Install Bakudan Food Safety.bat

3. Installer preserves ProgramData (DB, config, session) — data is safe

4. Verify recovery:
   Start-Sleep 20
   Invoke-WebRequest http://localhost:3210/api/health
```

---

## 3. Broken WhatsApp Session

### Symptoms

- Dashboard WhatsApp panel shows DISCONNECTED for >5 minutes
- QR code appears but scanning doesn't connect
- Messages not being received
- `GET /api/whatsapp/session` returns state ≠ READY

---

### 3A — Temporary disconnect (most common)

The auto-reconnect handles this automatically. No action needed unless:
- DISCONNECTED for >5 minutes
- `reconnect_count` > 6 in `/api/whatsapp/session`

```
1. Check current status:
   GET http://localhost:3210/api/whatsapp/session

2. If reconnecting, wait 2 more minutes — backoff may be at 120s delay

3. If stuck at DISCONNECTED with no reconnect timer:
   - Open dashboard → WhatsApp panel → click "Force Reconnect"
   OR
   - schtasks /end /tn BakudanFoodSafety
   - Start-Sleep 5
   - schtasks /run /tn BakudanFoodSafety
```

---

### 3B — Session expired (phone unlinked)

Happens when: phone was reset, WhatsApp was reinstalled, or device was unlinked manually.

```
1. Verify by checking: GET /api/whatsapp/session
   state = "QR_READY" confirms session is gone

2. Re-link procedure:
   a. Open dashboard: http://localhost:3210
   b. WhatsApp panel shows QR code
   c. On store phone: WhatsApp → Settings → Linked Devices → Link a Device
   d. Scan QR code displayed in dashboard
   e. Status changes to READY within 10–20 seconds

3. Verify messages flow:
   Send a test message to the store WhatsApp group
   Check dashboard for incoming message
```

---

### 3C — QR code not appearing

```
1. Check session state: GET /api/whatsapp/session
   - If state=READY: already connected, no QR needed
   - If state=INITIALIZING: wait 30s, then check again

2. If state=DISCONNECTED with no QR:
   schtasks /end /tn BakudanFoodSafety
   # Delete session to force fresh QR
   Remove-Item "C:\ProgramData\BakudanFoodSafety\whatsapp\auth" -Recurse -Force
   New-Item "C:\ProgramData\BakudanFoodSafety\whatsapp\auth" -ItemType Directory
   schtasks /run /tn BakudanFoodSafety
   # Wait 20s — QR should now appear in dashboard

3. After scanning new QR, update the linked device name in WhatsApp on phone
```

---

### 3D — Session restore from backup

Use when: you have a session backup and want to restore a known-good session.

```
1. Stop app:
   schtasks /end /tn BakudanFoodSafety

2. List available session backups:
   dir C:\ProgramData\BakudanFoodSafety\backups\

3. Restore session from backup:
   $backup = "C:\ProgramData\BakudanFoodSafety\backups\whatsapp-manual-20260612\auth"
   $target = "C:\ProgramData\BakudanFoodSafety\whatsapp\auth"
   Remove-Item $target -Recurse -Force
   Copy-Item $backup $target -Recurse

4. Restart app:
   schtasks /run /tn BakudanFoodSafety

5. Verify: GET /api/whatsapp/session → should show READY within 20s
   (If phone is still linked — otherwise re-scan QR)
```

---

## 4. Database Restore

### Symptoms

- Dashboard shows no submissions / empty data
- App crashes with "DB error" on startup
- Migration failed error in logs

---

### 4A — Restore from update backup (most recent)

```
1. List available backups:
   dir C:\ProgramData\BakudanFoodSafety\backups\

2. Identify the correct backup (most recent that has good data):
   Get-Content "C:\ProgramData\BakudanFoodSafety\backups\<backup-name>\backup-meta.json"

3. Stop app:
   schtasks /end /tn BakudanFoodSafety
   Stop-Process -Name node -Force -ErrorAction SilentlyContinue
   Start-Sleep 3

4. Restore DB:
   $backup = "C:\ProgramData\BakudanFoodSafety\backups\<backup-name>\gateway.db"
   Copy-Item $backup "C:\ProgramData\BakudanFoodSafety\db\gateway.db" -Force

5. Restart app:
   schtasks /run /tn BakudanFoodSafety
   Start-Sleep 20

6. Verify row count:
   sqlite3 "C:\ProgramData\BakudanFoodSafety\db\gateway.db" "SELECT COUNT(*) FROM food_safety_submissions;"
```

---

### 4B — DB corrupted (SQLITE_CORRUPT error in logs)

```
1. Check integrity:
   sqlite3 "C:\ProgramData\BakudanFoodSafety\db\gateway.db" "PRAGMA integrity_check;"
   # "ok" = fine; anything else = corruption confirmed

2. Try recovery:
   sqlite3 "C:\ProgramData\BakudanFoodSafety\db\gateway.db" ".recover" | \
   sqlite3 "C:\ProgramData\BakudanFoodSafety\db\gateway-recovered.db"

3. If recovery succeeds:
   schtasks /end /tn BakudanFoodSafety
   Copy-Item "C:\ProgramData\BakudanFoodSafety\db\gateway-recovered.db" \
             "C:\ProgramData\BakudanFoodSafety\db\gateway.db" -Force
   schtasks /run /tn BakudanFoodSafety

4. If recovery fails: restore from backup (procedure 4A above)
```

---

### 4C — Migration failed on startup

```
1. Check log for which migration failed:
   Get-Content C:\ProgramData\BakudanFoodSafety\logs\gateway.log -Tail 30 | Select-String "migration"

2. Check DB state:
   sqlite3 "C:\ProgramData\BakudanFoodSafety\db\gateway.db" ".tables"
   sqlite3 "C:\ProgramData\BakudanFoodSafety\db\gateway.db" "SELECT * FROM schema_migrations;"

3. If DB is empty (fresh install, migration 001 failed):
   # DB will be recreated — just restart
   schtasks /run /tn BakudanFoodSafety

4. If partial migration ran and left DB in bad state:
   # Restore from backup (4A) then restart
```

---

## 5. Manual Rollback

Use when: dashboard rollback fails, or app is not responding.

### 5A — Rollback to most recent backup

```powershell
# Open PowerShell as Administrator

# Step 1: Stop app
schtasks /end /tn BakudanFoodSafety
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Sleep 3

# Step 2: Run rollback
cd "C:\Program Files\BakudanFoodSafety"
powershell -NoProfile -ExecutionPolicy Bypass -File updater\bakudan-updater.ps1 rollback latest

# The script will:
# - Find most recent backup in ProgramData/backups/
# - Restore DB, .env, and app source
# - Start the app
# - Wait for health check

# Step 3: Verify
Start-Sleep 20
Invoke-WebRequest http://localhost:3210/api/health
Invoke-WebRequest http://localhost:3210/api/updates/version
```

### 5B — Rollback to a specific backup

```powershell
# List available backups
dir C:\ProgramData\BakudanFoodSafety\backups\

# Roll back to a named backup
cd "C:\Program Files\BakudanFoodSafety"
powershell -ExecutionPolicy Bypass -File updater\bakudan-updater.ps1 rollback backup-20260612-120000-pre-v1.0.1
```

### 5C — Manual rollback (no PowerShell script)

Use when: updater script itself is broken.

```powershell
$backup = "C:\ProgramData\BakudanFoodSafety\backups\backup-20260612-120000-pre-v1.0.1"
$appDir = "C:\Program Files\BakudanFoodSafety\app"

# Step 1: Stop
schtasks /end /tn BakudanFoodSafety
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Sleep 3

# Step 2: Restore DB
Copy-Item "$backup\gateway.db" "C:\ProgramData\BakudanFoodSafety\db\gateway.db" -Force

# Step 3: Restore .env
Copy-Item "$backup\.env" "C:\ProgramData\BakudanFoodSafety\config\.env" -Force

# Step 4: Restore app source
Remove-Item "$appDir\src" -Recurse -Force
Copy-Item "$backup\src" "$appDir\src" -Recurse

# Step 5: Restore version.json
Copy-Item "$backup\version.json" "$appDir\version.json" -Force

# Step 6: Restart
schtasks /run /tn BakudanFoodSafety
Start-Sleep 20
Invoke-WebRequest http://localhost:3210/api/health
```

---

## 6. Disaster Recovery

Use when: machine failure, Windows corruption, hardware replacement, or catastrophic data loss.

### Prerequisites

- External backup of `C:\ProgramData\BakudanFoodSafety\` (DB, config, session)
- Installer package (USB or network share)
- Google service account JSON

---

### 6A — New machine deployment with data migration

```
1. On new machine (Windows 11):
   - Copy installer package
   - Double-click: Install Bakudan Food Safety.bat
   - Wait ~65s for installation

2. Stop app before restoring data:
   schtasks /end /tn BakudanFoodSafety
   Stop-Process -Name node -Force -ErrorAction SilentlyContinue

3. Restore data from external backup:
   Copy-Item D:\BakudanBackup\db\gateway.db
         C:\ProgramData\BakudanFoodSafety\db\gateway.db -Force

   Copy-Item D:\BakudanBackup\config\.env
         C:\ProgramData\BakudanFoodSafety\config\.env -Force

   Copy-Item D:\BakudanBackup\whatsapp\auth
         C:\ProgramData\BakudanFoodSafety\whatsapp\ -Recurse -Force

   Copy-Item D:\BakudanBackup\config\google-service-account.json
         C:\ProgramData\BakudanFoodSafety\config\ -Force

4. Start app:
   schtasks /run /tn BakudanFoodSafety
   Start-Sleep 20

5. Verify:
   - GET http://localhost:3210/api/health → 200 OK
   - GET http://localhost:3210/api/whatsapp/session → state=READY (if session restored)
   - Check dashboard submission count matches backup
   - If session expired: re-scan QR (Section 3B)

6. Update group chat IDs if machine changed:
   Check .env for GROUP_CHAT_IDs — these are based on WhatsApp group membership,
   not machine identity, so they should still be valid
```

---

### 6B — Complete data loss (no backup)

Worst case: machine destroyed, no external backup.

```
1. Fresh install on new machine (Section 1D)

2. Data that can be recovered:
   - Google Sheets: all synced submissions are in the store's Google Sheet
   - WhatsApp: message history visible on store phone
   - Data that cannot be recovered: un-synced submissions, API keys, audit logs

3. Reconfigure:
   a. Scan fresh QR with store phone
   b. Re-enter GROUP_CHAT_IDs in .env (get from WhatsApp)
   c. Re-generate API keys in dashboard if Agent/Mi-Core integration used
   d. Google service account JSON: re-download from Google Cloud Console

4. Verify submissions start flowing from store phone → dashboard → Google Sheet
```

---

### 6C — Recovery Time Objectives

| Scenario | Recovery Time | Data Loss |
|---|---|---|
| App crash (auto-restart) | 2 minutes | None |
| Failed update (auto-rollback) | ~3 minutes | None |
| Manual rollback | ~5 minutes | Since last backup |
| Reinstall with ProgramData backup | ~10 minutes | None |
| New machine with ProgramData backup | ~20 minutes | None |
| Complete data loss (no backup) | ~30 minutes | All local data |

---

### Recovery Contacts

| Situation | Contact |
|---|---|
| App won't start | Check `gateway.log`, then run installer again |
| WhatsApp QR stuck | Store manager re-scan procedure (Section 3B) |
| Data question | Google Sheet has all synced submissions |
| Update failure | See Section 2, then contact developer if unresolved |
| New machine needed | Run full DR procedure (Section 6A or 6B) |

---

## Quick Recovery Reference

| Problem | Go to |
|---|---|
| Install failed | Section 1 |
| Update failed | Section 2 |
| WhatsApp disconnected | Section 3A |
| WhatsApp needs QR rescan | Section 3B |
| Dashboard empty / no data | Section 4 |
| Need to roll back version | Section 5 |
| Machine replaced / hardware failure | Section 6 |
