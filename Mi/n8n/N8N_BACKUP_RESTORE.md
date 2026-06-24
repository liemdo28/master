# N8N Backup & Restore

**Version:** 1.0.0
**Date:** 2026-06-24

---

## What Gets Backed Up

| Item | Source | Destination |
|------|--------|-------------|
| Workflow definitions | `Mi/n8n/workflows/` | `backups/<date>/workflows/` |
| Mi-Core contract logs | `Mi/n8n/data/` | `backups/<date>/data/` |
| Config files | `Mi/n8n/config/` | `backups/<date>/config/` |
| n8n internal DB | PM2 logs + metadata | `backups/<date>/logs/` |
| Reports | `Mi/n8n/reports/` | `backups/<date>/reports/` |
| Credentials metadata | `Mi/n8n/credentials/` | `backups/<date>/credentials/` (NO secrets) |

---

## Backup Script

**Location:** `Mi/n8n/scripts/backup-n8n.bat`
**Run:** Daily via Windows Task Scheduler or PM2 cron.

```cmd
cd E:\Project\Master\Mi\n8n\scripts
backup-n8n.bat
```

Output: `Mi/n8n/backups/<YYYY-MM-DD_HHMMSS>/`

---

## Restore Script

**Location:** `Mi/n8n/scripts/restore-n8n.bat`

```cmd
cd E:\Project\Master\Mi\n8n\scripts
restore-n8n.bat <backup-folder-name>
```

**Warning:** This will overwrite current workflows and config. Back up first if needed.

---

## Export / Import

### Export (n8n API → local JSON)
```cmd
cd E:\Project\Master\Mi\n8n\scripts
export-workflows.bat
```
Requires n8n to be healthy on :5678.

### Import (local JSON → n8n API)
```cmd
cd E:\Project\Master\Mi\n8n\scripts
import-workflows.bat
```
Import order: shared/ first, then domain-specific.

---

## Restart Survival

| Config | Survives restart? | Where |
|--------|-------------------|-------|
| PM2 config | ✅ Yes | `ecosystem.config.js` |
| Workflow JSON | ✅ Yes | `Mi/n8n/workflows/` |
| Config files | ✅ Yes | `Mi/n8n/config/` |
| Contract logs | ✅ Yes | `Mi/n8n/data/` (appended to `.jsonl`) |
| n8n internal DB | ⚠️ Depends | In Docker volume or SQLite file |
| In-memory evidence | ❌ No | Evidence is in-memory only — use `/api/mi/workflows/log` for persistence |

---

## Recovery Procedure

1. Restore from backup: `restore-n8n.bat <backup-name>`
2. Restart n8n: `pm2 restart mi-n8n`
3. Verify health: `check-n8n-runtime.bat`
4. Import workflows if needed: `import-workflows.bat`
5. Verify contract endpoints: `curl http://localhost:4001/api/mi/workflows/status`
