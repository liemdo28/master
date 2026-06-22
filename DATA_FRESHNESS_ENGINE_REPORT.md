# Data Freshness Engine Report

Generated: 2026-06-14

Target: `DATA_FRESHNESS_ENGINE_CERTIFIED`

## Result

Status: `DATA_FRESHNESS_ENGINE_CERTIFIED`

Current freshness state:

- Overall: `fresh`
- Stale count: `0`
- Missing count: `0`
- Error count: `0`

Runtime report:

- `E:/Project/Master/.local-agent-global/visibility/data-freshness.json`

## Required Fields

Every tracked source now exposes:

- `status`
- `last_sync`
- `freshness_score`
- `stale`
- `error_state`

## Source Matrix

| Source | Status | Freshness Score | Stale | Error |
| --- | ---: | ---: | --- | --- |
| Gmail | fresh | 28 | false | null |
| Calendar | fresh | 38 | false | null |
| Drive | fresh | 69 | false | null |
| Sheets | fresh | 80 | false | null |
| Asana | fresh | 95 | false | null |
| Health | fresh | 99 | false | null |
| QB | fresh | 99 | false | null |
| Website bakudanramen.com | fresh | 100 | false | null |
| Website rawsushibar.com | fresh | 100 | false | null |
| Work Orders | fresh | 49 | false | null |
| Graph | fresh | 100 | false | null |
| Memory | fresh | 96 | false | null |

## Fix Applied

Updated:

- `server/src/visibility/data-freshness-monitor.ts`

Changes:

- Added Asana to freshness coverage.
- Added `freshness_score`, `stale`, `last_sync`, `error_state`.
- Separated degraded connector health from hard error state.
- Chose newest matching evidence path between global and mi-core local caches.

## Certification

`DATA_FRESHNESS_ENGINE_CERTIFIED`
