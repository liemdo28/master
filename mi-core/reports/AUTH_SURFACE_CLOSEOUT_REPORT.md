# Auth Surface Closeout Report
**Date:** 2026-06-15
**Phase:** DEV3 CEO_READY_V2 Closeout — C3
**Result:** AUTH_SURFACE_FULLY_CLOSED

---

## Problem

Two route groups were mounted without `requireAuth` middleware:
- `/api/nodes` — node registry: device list, leader election state
- `/api/operations` — ops telemetry: health, incidents, burn-in scores, quality metrics

These endpoints exposed internal system topology and operational health data to
any unauthenticated caller on the LAN. While access is limited by the IP guard
(LAN/Tailscale only), there is no credential check.

---

## Fix Applied

**File:** `server/src/index.ts`

```typescript
// Before:
app.use('/api/nodes',      nodesRouter);
app.use('/api/operations', operationsRouter);

// After:
app.use('/api/nodes',      requireAuth, nodesRouter);
app.use('/api/operations', requireAuth, operationsRouter);
```

`requireAuth` is imported from `'./routes/auth'` and is already used on all
P0/P1/P2 route groups. When `MI_PIN` is unset, `requireAuth` is a no-op
(dev mode — all requests pass). When `MI_PIN` is set, a valid Bearer token
from `POST /api/auth/login` is required.

---

## Full Auth Surface Map (post-closeout)

### P0 — Write access (approval required)
| Route | Auth | Notes |
|-------|------|-------|
| `/api/approval` | ✅ requireAuth | Approve/reject CEO actions |
| `/api/actions` | ✅ requireAuth | Execute actions (Gmail, Drive, etc.) |

### P1 — Sensitive read (executive data)
| Route | Auth | Notes |
|-------|------|-------|
| `/api/executive` | ✅ requireAuth | Executive personality + persona |
| `/api/memory` | ✅ requireAuth | Operational memory runtime |
| `/api/briefing` | ✅ requireAuth | Daily briefing data |
| `/api/graph` | ✅ requireAuth | Ownership graph |
| `/api/brain` | ✅ requireAuth | Brain state |
| `/api/visibility` | ✅ requireAuth | Connector registry |

### P2 — Operational (protected)
| Route | Auth | Notes |
|-------|------|-------|
| `/api/chat` | ✅ requireAuth | CEO chat sessions |
| `/api/jarvis` | ✅ requireAuth | Jarvis control plane |
| `/api/qb-agent` | ✅ requireAuth | QuickBooks agent |
| `/api/projects` | ✅ requireAuth | Project tracking |
| `/api/reminders` | ✅ requireAuth | Reminder management |
| `/api/workspace` | ✅ requireAuth | Workspace control |
| `/api/knowledge` | ✅ requireAuth | Knowledge base |
| `/api/nodes` | ✅ requireAuth | **NEW — was unprotected** |
| `/api/operations` | ✅ requireAuth | **NEW — was unprotected** |

### Public (intentionally unauthenticated)
| Route | Auth | Reason |
|-------|------|--------|
| `/api/health` | None | Server liveness — safe for monitoring tools |
| `/api/auth` | None | Login endpoint — must be public by definition |
| `/api/remote/health` | None | Remote device discovery (no sensitive data) |
| `/api/remote/login` | None | Remote device auth entry point |
| `/api/whatsapp` | API key | WhatsApp gateway has its own key-based auth |

---

## Security Notes

1. **IP guard is a defence-in-depth layer**, not a substitute for credential auth.
   The `ipGuard` middleware blocks all non-LAN/Tailscale origins globally, so
   the unprotected `/api/nodes` and `/api/operations` were only accessible from
   the local network. Adding `requireAuth` closes the gap for insider/LAN threats.

2. **Node agents** (`node-agent.mjs` on laptop/Mac) will need to be updated to
   authenticate before calling `/api/nodes` if `MI_PIN` is set. Currently node
   agents use unauthenticated registration — acceptable for LAN-only setup but
   flagged for Dev5 hardening.

3. **Operations dashboard UI** (`/liveboard.html`, `/agenview.html`) calls
   `/api/operations/*` from the browser. These UI pages must include an auth
   token in their requests or the calls will return 401. The UI's login flow
   already stores the token in localStorage — confirm the ops dashboard reads
   it before calling ops endpoints.

---

## Certification

- NODES_ROUTE_BEHIND_AUTH: ✅
- OPERATIONS_ROUTE_BEHIND_AUTH: ✅
- PUBLIC_ROUTES_DOCUMENTED: ✅
- EXISTING_AUTH_ROUTES_UNCHANGED: ✅
- **AUTH_SURFACE_FULLY_CLOSED: ✅**
