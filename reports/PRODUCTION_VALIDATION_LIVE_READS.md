# PRODUCTION_VALIDATION_LIVE_READS.md
> Mi Company OS — Production Validation Live Business Reads
> Date: 2026-06-18
> Directive: Read-only validation only. No writes. No payments. No tax filing. No payroll execution.

---

## Summary

| Data Source | Status | Result |
|-------------|--------|--------|
| Asana Tasks | ✅ LIVE_READ_PASS | Live tasks returned |
| Gmail | ⚠️ DATA_PRESENT | Connector healthy, no HTTP route for direct read |
| Google Calendar | ⚠️ DATA_PRESENT | Connector healthy, no HTTP route for direct read |
| QuickBooks Desktop | ❌ UNREACHABLE | Port 8844 closed, laptop1 + Tailscale needed |
| Toast POS | ❌ DATA_MISSING | Playwright agent not running |
| Payroll | ❌ CREDENTIAL_MISSING | Integration not built (PLANNED phase) |
| DoorDash | ❌ DATA_MISSING | DoorDash agent not running |
| IRS / Tax | ❌ CREDENTIAL_MISSING | No API integration built |

---

## Read 1 — Asana (LIVE_READ_PASS)

**Method:** `GET /api/company-os/projects` → confirmed Asana connector live  
**Connector:** `asana` — status: connected, health: healthy  
**Evidence:** Project registry returns 24 projects with live task data  
**Result:** ✅ LIVE_READ_PASS

```
Data source: asana
Status: connected
Health: healthy
Access method: oauth2
Live tasks: confirmed alive
```

---

## Read 2 — Gmail (DATA_PRESENT — connector healthy, no HTTP route)

**Method:** Connector registry check + executive snapshot  
**Connector:** `gmail` — status: connected, health: healthy  
**Evidence:** `GET /api/company-os/data-sources` returns gmail as healthy  
**Executive snapshot:** 39 unread emails reported via executive assistant pipeline  
**Why not LIVE_READ_PASS:** No HTTP route on port 4001 that triggers a live Gmail API call on demand. Gmail reads go through the executive/actions pipeline (`gmail-action-adapter.ts`) but there is no `GET /api/company-os/gmail/inbox` endpoint.  
**Result:** ⚠️ DATA_PRESENT (connector alive, reads possible via pipeline not direct HTTP)

```
Connector: gmail
Status: connected
Health: healthy
Unread count reported: 39 (via exec assistant pipeline)
Direct read endpoint: NOT AVAILABLE
```

---

## Read 3 — Google Calendar (DATA_PRESENT — connector healthy, no HTTP route)

**Method:** Connector registry check  
**Connector:** `google-calendar` — status: connected, health: healthy  
**Why not LIVE_READ_PASS:** Same as Gmail — no direct HTTP endpoint for calendar reads. Routes through executive assistant pipeline.  
**Result:** ⚠️ DATA_PRESENT (connector alive, reads possible via pipeline)

```
Connector: google-calendar
Status: connected
Health: healthy
Direct read endpoint: NOT AVAILABLE
```

---

## Read 4 — QuickBooks Desktop (UNREACHABLE)

**Method:** Attempted `GET http://localhost:8844/api/qb/summary`  
**Result:** Connection refused — port 8844 closed  
**Root cause:** QuickBooks Desktop agent runs on laptop1. Laptop1 is offline. Tailscale VPN required.  
**CEO action:** Connect laptop1 to network + start Tailscale to restore QB sync  
**Result:** ❌ UNREACHABLE

```
Port: 8844
Status: CLOSED (refused)
Agent: qb-ops-agent (not running)
Requires: laptop1 online + Tailscale VPN
```

---

## Read 5 — Toast POS (DATA_MISSING)

**Method:** Attempted company-os command routing to restaurant-intelligence dept  
**Result:** Pipeline PASS but dept returns DATA_MISSING (no Toast agent running)  
**Root cause:** Toast API reads require `bakudan-integration-system` Playwright agent running separately  
**CEO action:** Start bakudan-integration-system process  
**Result:** ❌ DATA_MISSING

```
Department: restaurant-intelligence
Brain: qwen3:8b (online)
Toast API: requires Playwright agent
Agent status: NOT RUNNING
```

---

## Read 6 — Payroll (CREDENTIAL_MISSING)

**Method:** Attempted routing to payroll department  
**Result:** Department status: PLANNED (not active)  
**Root cause:** Payroll integration not built. No API connection, no credentials configured.  
**CEO action:** Build payroll integration (Phase 15 — PLANNED)  
**Result:** ❌ CREDENTIAL_MISSING

```
Department: payroll
Status: PLANNED
Integration: NOT BUILT
```

---

## Read 7 — DoorDash (DATA_MISSING)

**Method:** Attempted routing to delivery-operations department  
**Result:** Department status: PLANNED (not active)  
**Root cause:** DoorDash agent requires Playwright automation, not running  
**CEO action:** Start doordash-agent  
**Result:** ❌ DATA_MISSING

---

## Validation Conclusion

| Classification | Count | Data Sources |
|---------------|-------|-------------|
| LIVE_READ_PASS | 1 | Asana |
| DATA_PRESENT | 2 | Gmail, Google Calendar |
| UNREACHABLE | 1 | QuickBooks |
| DATA_MISSING | 2 | Toast, DoorDash |
| CREDENTIAL_MISSING | 2 | Payroll, IRS/Tax |

**Production validation status:** PARTIAL  
3 of 8 data sources confirmed alive (Asana live, Gmail/Calendar connector healthy).  
5 of 8 require CEO action to activate.

**All reads were read-only. No writes performed. No payments executed. No tax filing triggered. No payroll run.**
