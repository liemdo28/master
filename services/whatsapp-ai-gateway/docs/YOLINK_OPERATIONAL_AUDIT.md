# YoLink Operational Audit

Date: 2026-06-04
Author: Dev #2 (Operational Readiness, no runtime changes)
Scope: SECTION 5 — verify YoLink UI/API/runtime surface and Day-0 readiness.

## Live verification (Dev #2, today)

```
$ node scripts/test-yolink-connection.js
=== YoLink Connection Test ===

[ Step 1 ] Checking environment credentials...
  ❌ BLOCKED: YoLink credentials not configured
  Action required: Add YOLINK_CLIENT_ID and YOLINK_CLIENT_SECRET to .env

{
  "timestamp": "2026-06-04T06:24:23.094Z",
  "YOLINK_REAL_RUNTIME": "BLOCKED",
  "YOLINK_ENABLED": false,
  "YOLINK_CLIENT_ID": false,
  "YOLINK_CLIENT_SECRET": false,
  "YOLINK_POLL_INTERVAL": "not set",
  "model": null,
  "hub_status": null,
  "api_status": "NO_CREDENTIALS",
  "auth_status": null,
  "devices_found": 0,
  "first_reading_saved": false,
  "dashboard_shown": false,
  "blocker": "YOLINK_CLIENT_ID and/or YOLINK_CLIENT_SECRET not set in .env"
}
```

**Verdict:** `YOLINK_RUNTIME = BLOCKED — awaiting API credentials`.

## CEO device list (per directive)

| Model | EUI | Serial | Target store | Target item |
|---|---|---|---|---|
| YS8017-UC | d88b4c01000f1398 | 7651DDF730 | stone_oak | Walk-in Cooler |
| YS8017-UC | d88b4c01000f176f | 7651DDF731 | bandera   | Walk-in Cooler |
| YS8017-UC | d88b4c01000f069b | 7651DDF732 | rim       | Walk-in Cooler |

These EUIs are baked into `getSeedDrafts()` in
`src/integrations/yolink/yolink-device-service.js`. The "Seed CEO Devices"
button is a **draft loader**, not an auto-save — it pre-fills the Add
Device form so the operator can review and click Save.

## Code surface (verified)

| Capability | File | Status |
|---|---|---|
| Manual device add UI | `src/dashboard/admin-ui.js` → `renderYoLink()` | exists |
| Seed CEO Devices button | `src/dashboard/admin-ui.js` | exists (loads 3 EUIs into the form) |
| `addDevice` (with EUI unique constraint) | `src/integrations/yolink/yolink-device-service.js` | exists |
| `remapDevice(id, { store_id, item_name })` | same | exists |
| `getSeedDrafts()` returns CEO EUIs | same | exists |
| `sensors` table (with EUI UNIQUE) | `src/integrations/yolink/yolink-device-service.js` ensureSchema | exists |
| `sensor_item_mapping` table | same | exists |
| `findSensorForStoreItem(storeId, itemName)` | `src/compliance/cross-validation-service.js` | exists |
| `compareHumanVsSensor(...)` | same | exists |
| `yolink-auth.isConfigured()` | `src/integrations/yolink/yolink-auth.js` | exists |
| Test API / Test Reading / Force Poll endpoints | `src/api/server.js` | exists |
| Sensor dashboard panel | `src/compliance/sensor-dashboard-panel.js` | exists |
| "YoLink not configured" UI state | `src/dashboard/admin-ui.js` renderYoLink | exists |

## UI form fields (verified)

- Device name, Model (defaulted to YS8017-UC), Device EUI, Serial
- Store select (stone_oak / bandera / rim)
- Item select (populated from current template items)
- Sensor type (temperature / temp+humidity / door / other)
- Active + Trust checkboxes

## UI buttons (verified)

- Save Device → `POST /api/admin/yolink/devices`
- Save + Test → Save then test reading
- Clear → resets the form
- Seed CEO Devices → loads the 3 devices above into the form (no DB write)
- Test API → `POST /api/admin/yolink/test-api`
- Sync Devices → `POST /api/admin/yolink/sync-devices`
- Force Poll → `POST /api/admin/yolink/force-poll`
- Per-row: Test / Remap / Disable/Enable / Delete

## Store / item mapping model

- `sensors` table: `device_eui UNIQUE`, `store_id`, `item_name`, `active`,
  `trust_enabled` — prevents duplicate EUI and supports the dashboard
  "Remap" action.
- `sensor_item_mapping` table: per-store, per-item `active` row, used by
  `findSensorForStoreItem(storeId, itemName)` to look up the trusted sensor
  for cross-validation.
- `checkItemTemplateWarning(id)` warns if the mapped `item_name` no longer
  exists in the runtime template (so a Daily_Entry_Template edit surfaces
  in the YoLink panel).

## Sensor dashboard

`src/compliance/sensor-dashboard-panel.js`:
- Renders readings, alerts, cross-validation, trust score tabs.
- `GET /api/sensors/readings`, `/api/sensors/alerts`,
  `/api/sensors/cross-validation`, `/api/sensors/trust`.

## Cross-validation linkage

`src/compliance/cross-validation-service.js`:
- `compareHumanVsSensor(storeId, itemName, humanValue, employeeId)` returns:
  - `MATCH | MISMATCH | NO_SENSOR | SENSOR_STALE | SENSOR_OFFLINE |
    DISABLED`
- Tolerance: `SENSOR_HUMAN_TOLERANCE_F` (default 2°F)
- Match window: `SENSOR_MATCH_WINDOW_MINUTES` (default 10)
- Stale window: `SENSOR_STALE_MINUTES` (default 15)
- Offline window: `SENSOR_OFFLINE_MINUTES` (default 60)
- Result persisted to `cross_validation_results`; trust score updated via
  `trust-score-service.recordCrossValidationResult()`.

## Credentials gate

- `yolink-auth.isConfigured()` checks for `YOLINK_CLIENT_ID` +
  `YOLINK_CLIENT_SECRET`.
- If missing, dashboard shows:
  `API NOT CONFIGURED — Human workflow remains active`.
- `testReading` returns `NO_CREDENTIALS` if not configured, but the device
  remains saved in the local SQLite `sensors` table.
- The system does **not** fail silently — every UI panel surfaces the
  configuration state.

## Mapped store/item (current state)

| Store | Mapped EUI | Mapped item | DB row exists? |
|---|---|---|---|
| stone_oak | d88b4c01000f1398 | Walk-in Cooler | NO (operator must click "Seed CEO Devices" then "Save Device") |
| bandera | d88b4c01000f176f | Walk-in Cooler | NO |
| rim | d88b4c01000f069b | Walk-in Cooler | NO |

The CEO seed devices are *pre-loaded* into the Add Device form but are
not auto-saved. The operator must click Save Device in the dashboard
for each row. This audit does not pre-populate the `sensors` table.

## API surface

| Endpoint | Purpose |
|---|---|
| `GET    /api/admin/yolink/devices` | List devices |
| `POST   /api/admin/yolink/devices` | Add device |
| `GET    /api/admin/yolink/devices/:id` | Get device |
| `PATCH  /api/admin/yolink/devices/:id` | Update fields |
| `DELETE /api/admin/yolink/devices/:id` | Delete + cleanup mappings |
| `POST   /api/admin/yolink/devices/:id/disable` | Disable |
| `POST   /api/admin/yolink/devices/:id/test-reading` | Test reading |
| `POST   /api/admin/yolink/devices/:id/remap` | Remap store/item |
| `GET    /api/admin/yolink/devices/:id/warning-check` | Template warning |
| `GET    /api/admin/yolink/seed-drafts` | CEO devices |
| `GET    /api/admin/yolink/credentials-status` | API configured? |
| `POST   /api/admin/yolink/test-api` | Test auth |
| `POST   /api/admin/yolink/sync-devices` | Mark sync run |
| `POST   /api/admin/yolink/force-poll` | Mark poll run |

## Warning state notes

1. If credentials are missing, the human workflow is the only path (no
   silent failure).
2. The poller logs a disabled state at boot if `YOLINK_ENABLED != true` or
   credentials are missing.
3. Stale/offline thresholds are env-tunable; if set too lenient, missing
   readings may go unnoticed.
4. Cross-validation only runs when `findSensorForStoreItem` finds a row
   with `trust_enabled=1`; the CEO seed drafts default to `trust_enabled=1`
   in the Add Device form.

## Day-0 verdict

| Section | Status |
|---|---|
| UI manual device add | PASS |
| Seed CEO Devices | PASS (3 EUIs preloaded) |
| Device mapping model | PASS |
| Store/item mapping model | PASS |
| Cross-validation uses mapped sensor | PASS (code-verified) |
| Sensor dashboard | PASS (code-verified) |
| "YoLink not configured" state | PASS (code-verified) |
| Runtime connection | **BLOCKED** — no YOLINK_CLIENT_ID / YOLINK_CLIENT_SECRET |

**Overall: PASS (UI + code layer) / BLOCKED (runtime API layer — awaiting
credentials)**

Pilot is not blocked by this: the human-only workflow is supported and
the dashboard clearly displays the "API NOT CONFIGURED — Human workflow
remains active" state. Day 0 can proceed with the human path; YoLink
sensor cross-validation is a Day-1+ enhancement.

No runtime code, dashboard render, or `localhost:3210` work was modified.
