# DoorDash Live Read Proof

Generated: 2026-06-18 15:20 ICT
Target: `LIVE_READ_PASS`
Result: `DATA_MISSING`

## Runtime Read

The DoorDash Campaign Agent was started on `localhost:3000`.

Returned:

- Store records: Bandera, Raw Sushi Bar, Rim, Stone Oak
- Campaign snapshot records
- Mi-Core package version: `1.0.0`
- Mi-Core package sync status: up to date

## Why This Is Not A Live Pass

- Every store has `doordash_store_id = null`.
- Campaign snapshots have `source = manual`.
- Snapshot business date is `2026-06-09`.
- No DoorDash credential vault exists under the runtime data directory.
- No merchant session or current DoorDash response was retrieved.
- Store credential status endpoint has an RBAC defect:
  - response: role `ceo` does not have permission `view_reports`
  - source permissions use `reports:read`, not `view_reports`
- `GET /api/company-os/money` still returns DoorDash `DATA_MISSING`.

## Required Proof Status

| Requirement | Result |
|---|---|
| Campaign status retrieved from DoorDash | No |
| Store list retrieved from DoorDash | No; local configured stores only |
| Latest package retrieved | Yes; internal Mi-Core package only |
| Latest merchant report retrieved | No |

## Additional Runtime Defect

`npm start` points to missing file `dist/server/index.js`. The server can currently run only from TypeScript source via `tsx`.

## Evidence

- `E:\Project\Master\Agent\doordash-compaigns\data\campaigns.db`
- `E:\Project\Master\Agent\doordash-compaigns\data\mi-package\current.json`
- `E:\Project\Master\Agent\doordash-compaigns\runtime-start.log`
- Read endpoints: `/api/stores`, `/api/snapshots`, `/api/mi-sync/status`

No DoorDash campaign or store write was executed.

