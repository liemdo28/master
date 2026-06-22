# AUTH SURFACE AUDIT

**Date:** 2026-06-15
**Target:** Verify 9 unauthenticated API groups

## Method

Read `server/src/index.ts` (398 lines) and checked every route file for auth middleware usage.

## Global Auth Middleware

| Middleware | Applied | Scope |
|-----------|---------|-------|
| `helmet()` | ✅ Global | Security headers only |
| `cors()` | ✅ Global | LAN + Tailscale origins |
| `rateLimiter` | ✅ Global | 120 req/min, bypassed with `x-api-key` header |
| `ipGuard` | ✅ Global | **SKIP** `/api/remote/health` and `/api/remote/login` |

**No global authentication middleware.** Every route group is accessible without login unless it individually applies `requireRemoteAuth`.

## Route Groups Audited

### UNAUTHENTICATED (P0 - Write Access)

| # | Route Group | Auth | Risk | Evidence |
|---|------------|------|------|---------|
| 1 | `/api/approval` | ❌ None | P0 | Anyone can approve/reject actions via `POST /:id/approve` |
| 2 | `/api/actions` | ❌ None | P0 | Gmail search, Drive, Excel, Word creation exposed |
| 3 | `/api/whatsapp` (mi endpoint) | ✅ API key only | P1 | `waAuth` middleware checks `x-api-key` but key is in env |

### UNAUTHENTICATED (P1 - Read Access to Sensitive Data)

| # | Route Group | Auth | Risk | Evidence |
|---|------------|------|------|---------|
| 4 | `/api/visibility` | ❌ None | P1 | Daily snapshot, connector status, health data |
| 5 | `/api/executive` | ❌ None | P1 | Executive snapshot, business data |
| 6 | `/api/brain` | ❌ None | P1 | System status, connector registry, memory |
| 7 | `/api/memory` | ❌ None | P1 | Executive memory, owner profile |
| 8 | `/api/graph` | ❌ None | P1 | Ownership/dependency graph data |
| 9 | `/api/briefing` | ❌ None | P1 | Executive daily briefing data |

### UNAUTHENTICATED (P2 - Operational Data)

| # | Route Group | Auth | Risk | Evidence |
|---|------------|------|------|---------|
| 10 | `/api/jarvis` | ❌ None | P2 | Proactive monitor, risk engine, suggestions |
| 11 | `/api/chat` | ❌ None | P2 | Direct chat interface |
| 12 | `/api/qb-agent` | ❌ None | P2 | QuickBooks agent data |
| 13 | `/api/knowledge` | ❌ None | P2 | Knowledge base search |
| 14 | `/api/nodes` | ❌ None | P2 | Node registration, heartbeat |
| 15 | `/api/health` | ❌ None | P2 | Health monitoring |
| 16 | `/api/models` | ❌ None | P2 | Model registry status |
| 17 | `/api/operations` | ❌ None | P2 | Operations data |

### AUTHENTICATED (Remote Auth Only)

| # | Route Group | Auth | Risk |
|---|------------|------|------|
| 18 | `/api/remote/health` | ❌ Public | P2 (server info) |
| 19 | `/api/remote/login` | ❌ Public (PIN) | Acceptable |
| 20 | `/api/remote/devices` | ✅ `requireRemoteAuth` | Protected |
| 21 | `/api/remote/sessions` | ✅ `requireRemoteAuth` | Protected |
| 22 | `/api/remote/audit` | ✅ `requireRemoteAuth` | Protected |

## Key Findings

### F1: `requireAuth` middleware is defined but NEVER USED (P0)

**File:** `server/src/routes/auth.ts` lines 97-104
```typescript
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!process.env.MI_PIN && !process.env.MI_PIN_HASH) return next();
  const token = extractToken(req);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized — login with PIN' });
  }
  next();
}
```

**Search result:** `requireAuth` appears in `auth.ts` definition only. Zero usages in any route file.

### F2: `requireRemoteAuth` only used in `/api/remote` routes (P1)

**File:** `server/src/remote/remote-auth.ts` line 296
Used only in `remote.ts`: devices, sessions, audit, config routes.

### F3: IP Guard is the ONLY global protection (P2)

**File:** `server/src/index.ts` lines 125-128
Skipped for `/api/remote/health` and `/api/remote/login`. LAN/Tailscale CIDR ranges are broad (192.168.x.x, 10.x.x.x, 100.x.x.x).

## Severity Classification

| Severity | Count | Details |
|----------|-------|---------|
| **P0** | 3 | Approval gate, Actions API, requireAuth never used |
| **P1** | 6 | Executive data, memory, graph, briefing, visibility, brain |
| **P2** | 8 | Jarvis, chat, QB, knowledge, nodes, health, models, operations |

## Verdict: CONFIRMED

**9+ route groups are fully unauthenticated.** The `requireAuth` middleware exists but is dead code. Only `/api/remote/*` device management routes require authentication. Any device on the LAN/Tailscale network can access executive data, approve actions, and trigger workflows.
