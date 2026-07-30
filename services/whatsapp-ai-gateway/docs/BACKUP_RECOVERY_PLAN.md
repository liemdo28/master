# Backup & Recovery Plan

Date: 2026-06-04
Author: Dev #2 (Operational Readiness, no runtime changes)
Scope: SECTION 9 — what to back up, what to exclude, recovery scenarios, future dashboard buttons.

## What to back up

| Artifact | Path | Why |
|---|---|---|
| Runtime config (`app_config`) | `data/gateway.db` → table `app_config` | Sheet URLs, store mappings, manager-alert group, YoLink creds state |
| Store group mappings | `data/gateway.db` → table `store_groups` | chat_id → store_id, locked flag, last_message_at |
| Sensor / device mapping | `data/gateway.db` → tables `sensors`, `sensor_item_mapping` | Walk-in Cooler, etc. per store |
| Template cache (offline fallback) | `data/gateway.db` → table `template_items`, `template_versions` | Last successful sheet snapshot if Sheets is unreachable |
| Audit trail | `data/gateway.db` → tables `workflow_audit`, `manager_alerts` | Compliance, dispute resolution |
| Sheet write queue | `data/gateway.db` → table `sheet_write_queue` | PENDING / FAILED rows to drain on recovery |
| Pilot logs | `data/gateway.db` → tables `pilot_submissions`, `pilot_metrics` | Day 0–7 evidence |
| Local broth-items cache | `data/broth-items-cache.json` | Last successful /broth fetch |
| Generated template PDF + JSON | `docs/templates/daily-entry-template.pdf`, `data/templates/daily-entry-template-v1.json` | OCR template + layout |
| Local food-safety rules | `data/food-safety-rules.json` | Threshold fallback if Vision API is down |
| Configuration files | `.env.example`, `package.json`, `package-lock.json` | Reproducible build |
| Documentation | `docs/*.md` | Operational knowledge (no secrets) |
| Source code | full repo (git remote is the source of truth) | Re-deployable |

## What NOT to include

| Artifact | Why exclude |
|---|---|
| `.env` | Contains `YOLINK_CLIENT_SECRET`, `GEMINI_API_KEY`, service-account path. Goes to operator's password manager only. |
| `secrets/bakudan-food-safety-ai-123456.json` | Google service account private key. **Never** goes in any zip or public artifact. |
| WhatsApp session (`data/session/`) | Local-auth state — backed up to operator's secure storage only; copying to another machine re-triggers QR scan. |
| Browser cache (`screenshots/`) | Volatile, regeneratable. |
| Runtime SQLite in public zip | The runtime DB is operator-environment-specific; share via secure channel only. |
| `data/uploads/` | Image staging; not required to recover operations. |
| `node_modules/` | Restored by `npm install` against `package-lock.json`. |

## Recovery scenarios

### 1. PC reboot
- Run `start-whatsapp-ai-gateway.ps1` (or `.bat` / `.command`).
- `auditTrail.ensureTables()` and all `ensureTables()` re-run on boot.
- `sheet_write_queue.startRetryScheduler()` drains PENDING rows within 5 min.
- `templateSync.start()` re-snapshots `Daily_Entry_Template` within 5 min.
- Operator verifies `/health` → `whatsapp: ready`.

### 2. WhatsApp logout (session lost)
- `/health` reports `whatsapp: lost`; dashboard surfaces NEEDS_ACTION.
- `AUTO_RECONNECT=true` attempts to re-use existing session files.
- If session files are gone: open dashboard, click "Reconnect WhatsApp", scan QR.
- All other state (sheet queue, mappings, audit) is untouched.

### 3. Google Sheet credentials lost
- Operator pastes new service-account JSON at `secrets/google-service-account.json`.
- Restart gateway (or call `POST /api/admin/google-sheet-links/test`).
- `sheet_write_queue.retryAll()` drains backed-up rows.
- `templateSync.syncOnce()` refreshes item list from new credentials.

### 4. SQLite corrupted
- Stop the gateway.
- Replace `data/gateway.db` with last known-good backup.
- Boot re-runs schema migrations; missing columns are added via `ALTER TABLE`
  (those `WARN` lines in `sheet-write-test.js` are expected and harmless — they
  mean the column already exists in a newer schema).
- Sheet queue + audit tables re-attach to existing data.

### 5. Package restore (full re-install)
- Restore source from git.
- Restore `data/gateway.db` (without `.env`).
- Run `npm install`.
- Operator pastes fresh `.env` and `secrets/*.json`.
- Boot; `setupStatus.allRequiredPass` reveals any operator-side gaps.

### 6. Group mapping lost
- Open Admin Control Center → Store Mappings.
- Click "Refresh Groups" (lists WhatsApp groups the bot sees).
- For each store, click "Map to Store" and then "Lock".
- `store_groups.locked=1` re-enforced; staff commands can no longer override.

## Recommended future dashboard buttons

| Button | Endpoint stub | Action |
|---|---|---|
| **Export Config** | `POST /api/admin/backup/export` | Zips `app_config`, `store_groups`, `sensors`, `sensor_item_mapping` (NO secrets) into `data/backup/<timestamp>.zip` |
| **Import Config** | `POST /api/admin/backup/import` | Reads a previously exported zip and upserts the same tables (with operator confirmation prompt) |
| **Backup Now** | `POST /api/admin/backup/now` | Triggers Export Config + copies the current `data/gateway.db` to `data/backup/gateway-<timestamp>.db` |
| **Restore From Backup** | `POST /api/admin/backup/restore` | Lists available backups, prompts operator to choose; stops the gateway, swaps the DB, reboots |

These buttons are **not** in scope for Day 0. They are listed here so the
operator can request them as Phase 2 work without re-deriving the spec.

## Day-0 readiness

- Manual backup: `cp data/gateway.db data/backup/gateway-day0.db` before pilot
  start. Restorable via `cp data/backup/gateway-day0.db data/gateway.db` +
  restart.
- `data/backup/` already exists (verified in `list_files`).
- Documentation in `docs/` is version-controlled via git.

No runtime code, dashboard render, or `localhost:3210` work was modified.
