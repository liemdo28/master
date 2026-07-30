# CEO_CONTROL_CENTER_PLAN.md
> Mi Company OS — CEO Control Center Plan
> Date: 2026-06-18
> Status: PLAN ONLY — Do not build yet

---

## Overview

The CEO Control Center is a unified dashboard for Liem Do to monitor and command the entire Mi Company OS from a single interface. It surfaces real-time system health, pipeline activity, money operations, and executive tasks — accessible from desktop (AgenView) and mobile (WhatsApp).

---

## Goals

1. **Real-time visibility** — See all 20 departments, 13 services, 14 brains, and 14 connectors at a glance
2. **Command dispatch** — Send commands without opening WhatsApp
3. **Money operations panel** — QB, Toast, Payroll, DoorDash in one view
4. **Alert center** — DEGRADED services, pipeline failures, CEO decisions pending
5. **Evidence timeline** — Last 50 pipeline runs with QA status

---

## Proposed Architecture

```
CEO Control Center
├── /ceo-control/           ← New dashboard route
│   ├── index.html          ← Main shell (extends agenview.html)
│   ├── panels/
│   │   ├── system-health   ← Services, brains, connectors
│   │   ├── pipeline-feed   ← Live pipeline runs (WebSocket)
│   │   ├── command-bar     ← Text input → POST /api/company-os/command
│   │   ├── money-ops       ← QB, Toast, Payroll, DoorDash
│   │   ├── alert-center    ← Degraded/failed items
│   │   └── evidence-log    ← Last 50 runs with QA verdict
│   └── api/
│       ├── GET /api/ceo/status       ← Unified system status
│       ├── GET /api/ceo/alerts       ← Active alerts
│       └── WS  /api/ceo/live         ← Real-time pipeline feed
```

---

## Panel Specifications

### Panel 1 — System Health

| Widget | Data source | Refresh |
|--------|-------------|---------|
| Services (13) | `GET /api/company-os/services/health` | 60s |
| Brains (14) | `GET /api/company-os/brains/verify` | 120s |
| Connectors (14) | Connector registry | 60s |
| Departments (20) | `GET /api/company-os/departments` | 120s |

Color coding: green=healthy, yellow=degraded, red=offline, gray=planned

### Panel 2 — Live Pipeline Feed

| Widget | Data source | Refresh |
|--------|-------------|---------|
| Recent pipelines | `GET /api/company-os/pipelines` | WebSocket push |
| Active pipeline steps | `GET /api/company-os/pipelines/:id/steps` | WebSocket |
| QA verdicts | Evidence DB | Real-time |

### Panel 3 — Command Bar

- Text input with Vietnamese keyboard support
- `POST /api/company-os/command` on submit
- Show pipeline ID and QA verdict inline
- Approval-required commands show PENDING badge + approve/reject buttons

### Panel 4 — Money Operations

| Widget | Data source | Notes |
|--------|-------------|-------|
| QB Desktop status | `GET /api/company-os/money?source=quickbooks` | Shows DEGRADED when laptop1 offline |
| Toast daily summary | Toast API via pipeline | Requires Playwright agent |
| Payroll status | Payroll dept | PLANNED |
| DoorDash orders | DoorDash agent | Requires agent running |
| Accounting summary | Accounting HTTP API | Requires port 8844 |

### Panel 5 — Alert Center

Sources:
- Services with health ≠ healthy
- Pipelines with `qa_verdict: FAIL`
- Pipelines with `requires_approval: true` (pending CEO decision)
- Connectors with status ≠ healthy
- Brains with `online: false`

### Panel 6 — Evidence Log

- Last 50 pipeline runs from evidence.db
- Columns: timestamp, command_preview, departments, qa_verdict, duration
- Click-to-expand shows all 11-13 steps

---

## Technical Requirements

| Requirement | Details |
|-------------|---------|
| Framework | Plain HTML + vanilla JS (same as agenview.html, liveboard.html) |
| Real-time | WebSocket on existing `ws` server in index.ts |
| Auth | None (internal network only, same as AgenView) |
| Mobile | Responsive layout for iPhone (same breakpoints as mobile.html) |
| Dark mode | CSS variables, same as existing UI |
| New API routes | `GET /api/ceo/status`, `GET /api/ceo/alerts`, WS `/api/ceo/live` |
| New router file | `server/src/ceo-control/ceo-control-router.ts` |

---

## Implementation Phases

### Phase A — Backend API (first)
1. Create `ceo-control-router.ts` with `/status` + `/alerts` endpoints
2. Add WebSocket channel for pipeline events
3. Mount router in `index.ts`
4. Write acceptance tests

### Phase B — Dashboard UI
1. Create `ui/ceo-control.html`
2. Implement panels 1-2 (system health + pipeline feed)
3. Implement panel 3 (command bar)
4. Implement panels 4-6 (money, alerts, evidence)

### Phase C — Mobile Optimization
1. Responsive breakpoints
2. Touch-friendly command bar
3. WhatsApp-style approval cards

---

## Dependencies Before Building

| Dependency | Status | Required for |
|------------|--------|-------------|
| QA gate bug fix | ✅ DONE | Panel 2 (pipeline feed) |
| Evidence store | ✅ DONE | Panel 6 (evidence log) |
| QB Desktop online | ❌ Needs CEO action | Panel 4 (money ops) |
| Toast agent running | ❌ Needs CEO action | Panel 4 (money ops) |
| PM2 as Windows service | ❌ Needs CEO action | Panel 1 (service health) |

---

## Not Included in This Plan

- CEO authentication / password protection (scope creep)
- Mobile app (iPhone native app)
- Notification push (WhatsApp covers this)
- Historical analytics / charts (Phase 18 strategic memory)

---

## Recommendation

Build **Phase A (backend API)** first and test with curl before touching UI. The most valuable piece is the unified `/api/ceo/status` endpoint — it composes health data from 5 existing endpoints into one response. Phase B UI can be built incrementally on top.

Estimated time: Phase A = 2-4 hours, Phase B = 4-8 hours, Phase C = 2 hours.

---

**This is a plan document only. No code has been written. CEO approval required before implementation begins.**
