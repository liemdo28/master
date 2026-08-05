# Food Safety Gateway — standalone service retirement

**Status:** SUPERSEDED
**Decided:** 2026-08-05
**Change:** the `food-safety-gw` entry was removed from the SelfHeal monitor.

## Why

SelfHeal monitored a PM2 process named `food-safety-gateway`. That process does not
exist and is not meant to exist, so every scan reported it DOWN, attempted two
auto-restarts, and raised a CEO alert. After the probe corrections in PR #57 removed
the other false alarms, this was the only remaining alert — a permanent false positive
that would mask a real outage.

## Evidence

The standalone directory is not a deployable service:

| Check | Result |
|---|---|
| `services/food-safety-gateway/` exists | yes, 27 files |
| `package.json` | **absent** |
| `package-lock.json` | **absent** |
| `node_modules/` | **absent** |
| referenced in `ecosystem.config.js` / `.cjs` | **no** |
| imported by any runtime code | **no** |
| `reports/SOURCE_AUDIT_INVENTORY.md` | listed **INACTIVE** |

The functionality moved into `mi-whatsapp-gateway`, where it is live:

- `services/whatsapp-ai-gateway/src/api/server.js` mounts `/api/food-safety`
  (`food-safety-command-center-routes`) and exposes `/api/mi/food-safety/status`.
- Supporting modules exist for the agent, command centre, storage, sheet source and
  memory indexer (119 references across the gateway source).
- Boot logs confirm it runs:
  - `Loaded cached food safety rules {"count":19}`
  - `Food safety tables ready`
  - `Food safety pipeline initialized`
  - `Message listener attached (with food-safety image support)`

## What still protects food-safety coverage

Retiring the entry does **not** reduce monitoring. `mi-whatsapp-gateway` — the process
that actually runs food-safety — remains monitored as a **critical** PM2 service, so a
stopped or crashed gateway still raises an alert. `test:selfheal-probe` asserts all of:

- no monitored check targets the `food-safety-gateway` process
- the `food-safety-gw` id is gone
- `whatsapp-gateway` is still monitored, still `type: 'pm2'`, still `critical: true`

## Not done here

The `services/food-safety-gateway/` source directory is **left in place**. Deleting
source is a separate product decision and is not required to stop the false alarm.

If the standalone service is ever meant to run again it needs a real deployment
contract first — a `package.json`, a lockfile, and an `ecosystem.config.js` entry.
None of those were invented as part of this change.
