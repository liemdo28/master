# N8N Mi-Core Endpoint Verification — Phase N8N-3

**Date:** 2026-06-29 (corrected)
**Purpose:** Verify every required Mi-Core endpoint exists and responds correctly

> **2026-06-29 CORRECTION:** A prior version of this report marked the four
> n8n fabric entry endpoints (`/api/mi/intake/event`, `/api/mi/tasks/dispatch`,
> `/api/mi/approval/request`, `/api/mi/decision/request`) as "✅ YES / PASS"
> while they did **not** exist in the server source — every n8n workflow 404'd
> on its first node. They have now been implemented in
> `server/src/routes/mi-fabric-router.ts` (mounted at `/api/mi`) and wired into
> real subsystems (company-os dispatch pipeline, QuickBooks ingest, approval
> gate). The n8n-facing `/api/mi/workflows/log` route now also derives the
> canonical contract fields from the lighter n8n payload. All four workflows
> verified green end-to-end against the live server on port 4001.

---

## Required Endpoints

| # | endpoint | method | auth_required | exists | test_payload | response | status |
|---|----------|--------|--------------|--------|-------------|----------|--------|
| 1 | `/api/mi/workflows/status` | GET | yes | ✅ YES | — | `{"ok":true,"workflows":[]}` | PASS |
| 2 | `/api/mi/workflows/log` | POST | yes | ✅ YES | `{"workflow_id":"test","project":"test","entity":"e","action":"a","time_window":"w"}` | `{"ok":true,"duplicate":false}` | PASS |
| 3 | `/api/mi/workflows/evidence` | POST | yes | ✅ YES | `{"workflow_id":"test","status":"success","evidence":[]}` | `{"ok":true,"logged":true}` | PASS |
| 4 | `/api/mi/workflows/heartbeat` | POST | yes | ✅ YES | `{"workflow_id":"test","status":"running"}` | `{"ok":true}` | PASS |
| 5 | `/api/mi/workflows/dead-letter` | POST | yes | ✅ YES | `{"workflow_id":"test","error":"failed","retries":3}` | `{"ok":true,"dead_letter_created":true}` | PASS |
| 6 | `/api/mi/workflows/retry` | POST | yes | ✅ YES | `{"workflow_id":"test","attempt":3}` | `{"ok":true,"retry_scheduled":true}` | PASS |
| 7 | `/api/production-loop/event` | POST | yes | ✅ YES | `{"connectorId":"test","type":"heartbeat"}` | `{"event":{}}` | PASS |
| 8 | `/api/production-loop/heartbeat` | POST | yes | ✅ YES | `{"connectorId":"test","timestamp":"..."}` | `{"ok":true}` | PASS |
| 9 | `/api/executive/daily-brief` | GET | yes | ✅ YES | — | `{"ok":true,"brief":{}}` | PASS |

---

## n8n Health Gate Endpoints

| # | endpoint | method | auth | exists | status |
|---|----------|--------|------|--------|--------|
| 1 | `/api/n8n/health` | GET | no | ✅ YES | PASS |
| 2 | `/api/n8n/workflows` | GET | no | ✅ YES | PASS |
| 3 | `/api/n8n/failures` | GET | no | ✅ YES | PASS |
| 4 | `/api/n8n/dead-letter` | GET | no | ✅ YES | PASS |

---

## n8n Workflow Fabric Entry Endpoints (implemented 2026-06-29)

Source: `server/src/routes/mi-fabric-router.ts`, mounted at `/api/mi`.

| # | endpoint | method | auth | wired into | live status |
|---|----------|--------|------|-----------|-------------|
| 1 | `/api/mi/intake/event` | POST | no | company-os `dispatch()` pipeline (tracked run + evidence) | ✅ 200 |
| 2 | `/api/mi/tasks/dispatch` | POST | no | `quickbooks`→`ingestQuickBooks()`; other domains→pipeline | ✅ 200 |
| 3 | `/api/mi/approval/request` | POST | no | approval gate (autonomous auto-approve for read/report/notify) | ✅ 200 |
| 4 | `/api/mi/decision/request` | POST | no | company-os `dispatch()` pipeline (decision routing) | ✅ 200 |

---

## Live End-to-End Verification (port 4001)

| Workflow | Node sequence | Result |
|----------|---------------|--------|
| quickbooks-daily-sync | intake → dispatch → log | ✅ 200 · 200 · 200 |
| doordash-weekly-campaign-review | intake → dispatch → approval → log | ✅ 200 · 200 · 200 · 200 |
| food-safety-daily-reminder | intake → dispatch → approval → log | ✅ 200 · 200 · 200 · 200 |
| review-monitoring | intake → dispatch → approval → log | ✅ 200 · 200 · 200 · 200 |

Dedup confirmed: re-running an identical `/workflows/log` payload returns
`duplicate:true` (`SKIP_DUPLICATE`).

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Mi-Core workflow telemetry endpoints | 9 | ✅ PASS |
| n8n Health Gate endpoints | 4 | ✅ PASS |
| n8n fabric entry endpoints (intake/dispatch/approval/decision) | 4 | ✅ IMPLEMENTED + LIVE 200 |
| Workflows verified green end-to-end | 4 | ✅ PASS |

**Verification Result:** ✅ All four n8n workflows pass end-to-end against the
live server. The previously-claimed (but absent) endpoints are now real.
