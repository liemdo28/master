# AUTH HARDENING REPORT

**Date:** 2026-06-15
**Target:** AUTH_AND_MEMORY_READY

## A1: Remove Hardcoded Secret

### Change

**File:** `server/src/middleware/rate-limit.ts` (Line 8-10)

**Before:**
```typescript
function internalKey(): string {
  return process.env.MI_CORE_API_KEY || 'mi-core-secret-2026';
}
```

**After:**
```typescript
function internalKey(): string {
  const key = process.env.MI_CORE_API_KEY;
  if (!key) {
    console.warn('[RateLimit] MI_CORE_API_KEY not set — internal rate-limit bypass disabled');
    return '';  // fail-safe: empty string means no request will match
  }
  return key;
}
```

**Result:** Hardcoded fallback removed. System now fails-safe (rejects all internal bypass attempts) if `MI_CORE_API_KEY` is not configured.

### Verification
- ✅ `mi-core-secret-2026` no longer in source code
- ✅ `process.env.MI_CORE_API_KEY` is the only source
- ✅ Fail-safe: empty string returned when env var missing

---

## A2: Wire Auth to P0 Routes

### Change

**File:** `server/src/index.ts`

**Added imports:**
```typescript
import { requireAuth } from './routes/auth';
```

**Route protection applied:**

| Severity | Route | Auth | Status |
|----------|-------|------|--------|
| **P0** | `/api/approval` | ✅ `requireAuth` | Protected |
| **P0** | `/api/actions` | ✅ `requireAuth` | Protected |
| **P1** | `/api/executive` | ✅ `requireAuth` | Protected |
| **P1** | `/api/memory` | ✅ `requireAuth` | Protected |
| **P1** | `/api/briefing` | ✅ `requireAuth` | Protected |
| **P1** | `/api/graph` | ✅ `requireAuth` | Protected |
| **P1** | `/api/brain` | ✅ `requireAuth` | Protected |
| **P1** | `/api/visibility` | ✅ `requireAuth` | Protected |
| **P2** | `/api/chat` | ✅ `requireAuth` | Protected |
| **P2** | `/api/jarvis` | ✅ `requireAuth` | Protected |
| **P2** | `/api/qb-agent` | ✅ `requireAuth` | Protected |
| **P2** | `/api/projects` | ✅ `requireAuth` | Protected |
| **P2** | `/api/reminders` | ✅ `requireAuth` | Protected |
| **P2** | `/api/workspace` | ✅ `requireAuth` | Protected |
| **P2** | `/api/knowledge` | ✅ `requireAuth` | Protected |
| Public | `/api/remote` | Own auth | No change |
| Public | `/api/auth` | Must be public | No change |
| Public | `/api/health` | Public | No change |
| Protected | `/api/whatsapp` | API key | No change |

### Behavior
- **If MI_PIN not configured:** `requireAuth` is a no-op (all requests pass) — backward compatible with dev mode
- **If MI_PIN configured:** All protected routes require `Authorization: Bearer <token>` header
- **Token source:** POST `/api/auth/login` with `{ "pin": "..." }` returns `{ "token": "..." }`

### Verification
- ✅ 15 route groups now protected with `requireAuth`
- ✅ 4 public routes remain accessible (remote, auth, health, nodes)
- ✅ WhatsApp has its own API key middleware (unchanged)
- ✅ Backward compatible: no PIN = no auth required

---

## Summary

| Task | Status | Evidence |
|------|--------|---------|
| A1: Remove hardcoded secret | ✅ COMPLETE | `rate-limit.ts` — no hardcoded fallback |
| A2: Wire auth to P0 routes | ✅ COMPLETE | `index.ts` — 15 routes protected |

**Target: AUTH_AND_MEMORY_READY** — Auth surface hardened.
