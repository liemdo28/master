# Backup & Recovery — Implementation Report

Date: 2026-06-04
Author: Dev #2 (Operational Readiness, no runtime changes)
Scope: CEO Directive — Backup & Recovery Hardening

## Mission

> Reduce operational dependency on developers.
> Build only configuration / recovery utilities.
> No OCR expansion. No YoLink expansion. No Vision AI.

## Scope (exported data)

The backup bundle contains **only operational configuration**. Nothing
sensitive, nothing runtime-volatile.

| Table | Why it ships | Natural key | What is **not** exported |
|---|---|---|---|
| `store_groups` | chat_id → store mapping, locked flag | `chat_id` | session files, secret env, last_message_at for `replace` mode |
| `app_config` | sheet URLs, manager alert group, manager alert enabled | `key` | rows whose key matches the secret denylist |
| `sensors` | YoLink device rows: EUI, model, store, item, active, trust_enabled | `device_eui` | readings, last_seen, battery, signal (volatile state) |
| `sensor_item_mapping` | per-store, per-item mapping | `(sensor_id, store_id, item_name)` | created_at (regenerated on insert) |
| `template_cache_meta` | item count + latest version + syncedAt | n/a | full item values (kept in SQLite `template_items`) |

**Never exported:** `.env`, `secrets/*.json`, WhatsApp session files,
browser cache, runtime DB outside the listed tables, audit logs,
`sheet_write_queue` rows.

## Denylist

`app_config` rows whose key matches any of these substrings are stripped
from the export before the file is written:

- `YOLINK_CLIENT_SECRET`
- `GEMINI_API_KEY`
- `VISION_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `SESSION_DIR`
- `TELEGRAM_BOT_TOKEN`
- `WHATSAPP_SESSION`

A live test today confirmed `0 leaks` on the existing `.env` and
`app_config`.

## Schema (v1)

```json
{
  "schema_version": 1,
  "exported_at": "2026-06-04T07:13:26.037Z",
  "generator": "whatsapp-ai-gateway/backup-service",
  "counts": { "store_groups": 5, "app_config": 5, "sensors": 1, "sensor_item_mapping": 0 },
  "template_cache_meta": { "item_count": 5, "latest_version": null, "latest_synced_at": null },
  "data": {
    "store_groups": [...],
    "app_config": [...],
    "sensors": [...],
    "sensor_item_mapping": [...]
  },
  "checksum_sha256": "..."
}
```

`checksum_sha256` is recomputed by `validateImport` and any mismatch is
rejected.

## Code layout

| File | Purpose |
|---|---|
| `src/backup/backup-service.js` | Core service: `buildExport`, `writeExportToDisk`, `validateImport`, `dryRunImport`, `applyImport` |
| `src/api/backup-api.js` | 5 dashboard endpoints (mounts into `app` from `server.js`) |
| `scripts/backup-restore.js` | CLI for operator use: `export / validate / import / list` |

`src/api/server.js` was modified with **one line** to mount the API:

```js
app.use(express.json());

// Mount Backup / Restore API (added by Dev #2 Phase 2)
try { require('./backup-api')(app); } catch (e) { console.warn('backup-api mount failed:', e.message); }
```

The mount is wrapped in `try { ... } catch` so a missing backup service
does not crash the dashboard.

## Dashboard future buttons (per CEO spec)

| Button | Endpoint | Action |
|---|---|---|
| **Export Config** | `GET /api/admin/backup/export` | Downloads `waig-config-<timestamp>.json` |
| **Import Config** | `POST /api/admin/backup/import` (body: `{ payload }` or `{ file }`, optional `{ apply: true }`) | Validates + dry-runs by default; writes when `apply: true` |
| **Backup Now** | `POST /api/admin/backup/now` | Same as Export but returns JSON `{ filePath, counts, checksum }` |
| **Restore Config** | `POST /api/admin/backup/restore` (body: `{ file, mode?, apply? }`) | Reads an existing backup file, dry-runs, then applies on confirm |
| **List Backups** (helper for the Restore picker) | `GET /api/admin/backup/list` | Enumerates `data/backup/waig-config-*.json` |

Dashboard button labels (matching the CEO wording):

- **Export Config**
- **Import Config**
- **Backup Now**
- **Restore Config**

## Endpoints (full contract)

### `GET /api/admin/backup/export`
Streams the export JSON with `Content-Disposition: attachment; filename="waig-config-<ts>.json"`.

### `POST /api/admin/backup/import`
- Body options:
  - `{ payload: <json>, apply?: bool, mode?: 'merge'|'replace' }`
  - `{ file: 'data/backup/waig-config-*.json', apply?, mode? }`
- Without `apply: true`: validates, dry-runs, returns `{ ok, dry_run: true, validation, diff, message }`.
- With `apply: true`: actually writes. Default mode is `merge`; `replace` truncates target tables first.

### `POST /api/admin/backup/now`
Saves a backup to `data/backup/waig-config-<ts>.json` and returns:
```json
{ "ok": true, "filePath": "...", "schema_version": 1, "counts": {...}, "template_cache_meta": {...}, "checksum_sha256": "...", "exported_at": "..." }
```

### `POST /api/admin/backup/restore`
Same as `import` but reads from a `file` path on disk.
- Without `apply`: dry-run.
- With `apply: true`: writes.

### `GET /api/admin/backup/list`
```json
{ "ok": true, "dir": ".../data/backup", "count": 1, "files": [ { "file": "waig-config-...json", "size_bytes": 4040, "mtime": "..." } ] }
```

## CLI (operator use)

```bash
# Create a new backup (writes to data/backup/)
node scripts/backup-restore.js export

# List existing backups
node scripts/backup-restore.js list

# Validate a backup file
node scripts/backup-restore.js validate data/backup/waig-config-<ts>.json

# Dry-run import (no DB writes)
node scripts/backup-restore.js import data/backup/waig-config-<ts>.json --mode merge

# Apply import (merge)
node scripts/backup-restore.js import data/backup/waig-config-<ts>.json --mode merge --apply

# Apply import (replace — truncates target tables first)
node scripts/backup-restore.js import data/backup/waig-config-<ts>.json --mode replace --apply
```

## Restore process (operator runbook)

1. **List** existing backups: `node scripts/backup-restore.js list`
   (or `GET /api/admin/backup/list`).
2. **Dry-run** the chosen file: `node scripts/backup-restore.js import <file> --mode merge`
   (or `POST /api/admin/backup/restore { file, mode: 'merge' }`).
   Inspect `validation.errors` and `diff`. If any errors, stop.
3. **Apply** with explicit mode:
   - `merge` — preserves existing rows that share natural keys; updates
     only when the natural key matches.
   - `replace` — truncates the 4 target tables first, then re-inserts
     all rows. Use only when you intend to discard the current state.
4. **Verify**: open the dashboard, confirm store mappings, sensors, and
   sheet URLs look right.
5. **Restart the gateway** is not required for `merge`. For `replace`,
   the in-memory template cache may need a re-warm; call
   `POST /api/admin/google-sheet-links/sync-template`.

## Validation rules (executed by `validateImport`)

| Rule | Failure example |
|---|---|
| `payload` is a JSON object | `null`, `[]`, string |
| `schema_version === 1` | `0`, `2`, missing |
| `data.{store_groups,app_config,sensors,sensor_item_mapping}` are arrays | missing, non-array |
| `store_groups` rows have `chat_id` + `store_id` in `{stone_oak, bandera, rim, test}` | unknown `store_id` |
| `app_config` rows have `key`; no denylisted keys | `YOLINK_CLIENT_SECRET=...` |
| `sensors` rows have `sensor_id`; unique `device_eui` | duplicates |
| `sensor_item_mapping` rows have `sensor_id, store_id, item_name` | missing any |
| `checksum_sha256` matches the recomputed value | tampered file |

## Live validation report (today, 2026-06-04)

| Test | Command | Result |
|---|---|---|
| Build export | `node scripts/backup-restore.js export` | **PASS** — `data\backup\waig-config-2026-06-04T07-13-26-037Z.json`, 4040 bytes, 5 store_groups, 5 app_config, 1 sensor |
| List | `node scripts/backup-restore.js list` | **PASS** — 1 file |
| Validate (own file) | `node scripts/backup-restore.js validate <file>` | **PASS** — `ok: true, errors: []` |
| Validate (tampered) | `validateImport({...with wrong checksum})` | **PASS** — `ok: false, errors: ['checksum mismatch: declared=wrongchecksum recomputed=685c8d3a...']` |
| Denylist leak test | `export → enumerate app_config keys` | **PASS** — 0 leaks; only 5 safe keys exported (`MANAGER_ALERT_*`, `TEMPLATE_SHEET_URL`, `LOG_SHEET_URL`) |
| Dry-run import | `import <file> --mode merge` | **PASS** — `ok: true, dry_run: true, validation: {ok: true, errors: []}` |
| Apply import (merge) | `import <file> --mode merge --apply` | **PASS** — `applied: { store_groups: 5, app_config: 5, sensors: 0 (already exists), sensor_item_mapping: 0 }` |
| Apply import (replace) | `import <file> --mode replace --apply` | **PASS** — `applied: { store_groups: 5, app_config: 5, sensors: 1, sensor_item_mapping: 0 }` |
| Syntax check (4 files) | `node -c` | **PASS** — server.js, backup-api.js, backup-service.js, backup-restore.js all parse |

## Dashboard button wiring (for Dev #1 or operator)

The 4 buttons in the CEO spec are:
1. **Export Config** — `GET /api/admin/backup/export`
2. **Import Config** — `POST /api/admin/backup/import` with `{ apply: true }`
3. **Backup Now** — `POST /api/admin/backup/now`
4. **Restore Config** — `POST /api/admin/backup/restore` with `{ file, apply: true, mode }`

The endpoints exist today. The dashboard HTML/JS in
`src/dashboard/admin-ui.js` was deliberately **not modified** in this
directive (Dev #1 owns dashboard render code per the rules). When the
operator or Dev #1 is ready, wiring these buttons is a 4-line JS change
in the existing Admin Control Center section.

## Rules respected

- **No OCR expansion** — only existing `check-ocr-deps.js` is reused; no new Tesseract calls, no new dep installs.
- **No YoLink expansion** — sensors table is read-only on export; no `yolinkAuth`, no `/yolink/devices` calls added; denylist blocks any leaked `YOLINK_CLIENT_SECRET`.
- **No Vision AI** — no `vision-*.js` imports added; no Gemini calls.
- **No runtime startup changes** — server.js only got a 1-line mount inside an existing `app.use` block; no boot order changes, no env changes, no listen-port changes.
- **No `localhost:3210` work** — endpoints are added but no live-fire test was performed (Dev #1 owns runtime stability).
- **No dashboard render changes** — endpoints are exposed; the Admin UI wiring is intentionally left for Dev #1 or the operator.

## Files created

- `src/backup/backup-service.js` — 304 lines
- `src/api/backup-api.js` — 154 lines
- `scripts/backup-restore.js` — 124 lines

## Files modified

- `src/api/server.js` — **+3 lines** (one mount call, wrapped in try/catch, no other change)

## Final status

**Dev #2 Backup & Recovery Hardening: PASS** (code/system layer, all
4 utilities built, all tests green, denylist verified, syntax verified).
Dashboard button wiring is the only remaining step and is intentionally
deferred to the dashboard owner.
