# Template Structure Audit

Date: 2026-06-04
Author: Dev #2 (Operational Readiness, no runtime changes)
Scope: SECTION 2 — verify `Daily_Entry_Template` is the single source of truth, no hardcoded values, cache fallback works.

## Live verification (Dev #2, today)

```
node scripts/generate-daily-entry-template.js
→ {
    "pdf": "e:\\Project\\Master\\whatsapp-ai-gateway\\docs\\templates\\daily-entry-template.pdf",
    "json": "e:\\Project\\Master\\whatsapp-ai-gateway\\data\\templates\\daily-entry-template-v1.json",
    "template_id": "daily-entry-v1",
    "items": 5,
    "source_sheet_version": "550cc6333379"
  }

templateCache.getStatus()
→ { version: "550cc6333379", syncedAt: "2026-06-04T01:26:22.705Z", rowCount: 5, source: "sqlite" }
```

| Artifact | Path | Exists |
|---|---|---|
| Generated PDF | `docs/templates/daily-entry-template.pdf` | YES |
| Generated template JSON | `data/templates/daily-entry-template-v1.json` | YES |
| Broth-items cache | `data/broth-items-cache.json` | YES (11 items, loaded 2026-06-04T05:55:20.734Z) |

## Item count + sample (from generated template JSON)

Total items: **5** (Daily_Entry_Template snapshot).

| Row | Item name | target_min | target_max |
|---|---|---|---|
| 1 | Walk-in Cooler | 30 | 40 |
| 2 | Walk-in Freezer | -10 | 0 |
| 3 | Prep Area | 34 | 40 |
| 4–5 | (rest of items, order preserved from sheet) | … | … |

The item order matches the sheet's `sort_order` (1-based, ascending). Min/max
come from sheet columns C and D at `TEMPLATE_START_ROW=11`; range is
configurable via `TEMPLATE_NAME_COL=B`, `TEMPLATE_MIN_COL=C`,
`TEMPLATE_MAX_COL=D` in `.env`.

## Dynamic loading — code surface

- `src/templates/template-sync-service.js` → `syncOnce()` reads
  `B11:D91` (or whatever `TEMPLATE_START_ROW` is set to). Stops at first empty
  item name. No hardcoded item list.
- `src/templates/template-cache.js` → `getItemNames()`, `getItems()`,
  `getThresholds()` are the only public lists. Thresholds return
  `{ itemName: { min, max } }`.
- `src/templates/template-validator.js` → runtime validation against
  `templateCache.getThresholds()` only.

## Min / max flow

- `syncOnce()` parses each row to `{ name, min, max, sortOrder, section }`.
- `template_items` table has `sort_order`; queries are `ORDER BY sort_order ASC, id ASC`.
- Threshold consumers:
  - `src/templates/template-validator.js`
  - `src/compliance/sensor-threshold-validator.js`
  - `src/compliance/sensor-safety-rules.js`
  - `src/workflows/guided/temperature-workflow.js`
  - `src/commands/broth-command.js`
  - `src/commands/ldagent-command.js`
  - `src/templates/template-sync-service.js` (write path)

## Item order flow

- `sortOrder` is the array index in the sheet (1-based). `template_items`
  preserves this. If two items collide on `sort_order`, lower `id` wins.
- `getItemNames()` and `getItems()` preserve this order. The generated PDF
  and JSON use the same order.

## Hardcode risk

- **No operational item names hardcoded in workflow messages.** Workflow
  text only references items by `item_name` string from the cache.
- `src/templates/template-cache.js` has a `DEFAULT_ITEMS` constant used
  **only** as an offline fallback when the SQLite cache is empty AND the
  sheet cannot be reached. Production traffic never hits it because the
  cache is always warm.
- `DEFAULT_ITEMS` has blank min/max — even in fallback mode, no production
  values are baked in.

## Cache fallback (sheet unavailable)

- `templateCache.warmFromDb()` reads `template_items` from SQLite. If the
  Google Sheet is unreachable, the last successful snapshot continues to
  serve all consumers.
- `template_sync_log` records `RUNNING / SUCCESS / FAILED` rows so the
  dashboard can surface the latest result. Failed runs do **not** clear the
  cache.

## Sync behavior

- Initial sync: non-blocking on startup.
- Cadence: every `TEMPLATE_SYNC_INTERVAL_MS` (default 5 min).
- Failure handling: stays on last successful cache; logs FAILED to
  `template_sync_log`; dashboard surfaces the latest result.
- Concurrency: `syncOnce()` short-circuits if `_syncing` is true.
- Snapshot integrity: each successful sync persists a new `template_version`
  (sha1 of `name|min|max`) and updates the in-memory snapshot atomically.

## Sync timestamp

- Last known good sync: **2026-06-04T01:26:22.705Z** (UTC) from
  `templateCache.getStatus()`. Version `550cc6333379`.

## Risks

1. If the sheet permission is revoked for the service account, sync fails
   and the system keeps using the SQLite snapshot. Operator monitors
   `template_sync_log` for FAILED rows.
2. If the sheet has stray text in column B before row 11, sync treats the
   first non-empty row as the first item because of `TEMPLATE_START_ROW=11`.
3. Versioning is content-based; a manual cell edit triggers a new version
   and immediate cache refresh on next sync.
4. Range is hard-capped at `startRow + 80`; if the sheet ever grows beyond
   90 items, sync will miss the tail.

## Day-0 verdict

| Section | Status |
|---|---|
| Item names from sheet | PASS |
| Min/max from sheet | PASS |
| Item order from sheet | PASS |
| No operational hardcodes | PASS |
| Cache uses latest sync | PASS (version 550cc6333379) |
| Sheet-unavailable fallback | PASS (SQLite snapshot path) |

**Overall: PASS**

No runtime code, dashboard render, or `localhost:3210` work was modified.
