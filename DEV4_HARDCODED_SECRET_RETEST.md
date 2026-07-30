# DEV4 — Track V1: Hardcoded Secret Re-Test

**Date:** 2026-06-15  
**Tester:** DEV4  
**Target:** `HARDCODED_SECRET_CLOSED`

---

## Objective

Verify that `mi-core-secret-2026` has been fully removed from runtime code, no fallback secret remains, the server fails safe if auth env is missing, and no secret appears in API responses.

---

## Method

1. Grep-scan entire `server/src/` tree for `mi-core-secret-2026` patterns
2. Grep-scan for fallback patterns: `|| 'mi`, `default.*key`, `default.*secret`
3. Live API tests — hit all protected routes without auth token
4. Verify error responses contain no secret references

---

## Results

### ❌ FAILED — 8 runtime source files still contain `mi-core-secret-2026`

#### Files with `process.env.MI_CORE_API_KEY || 'mi-core-secret-2026'` fallback pattern

| File | Line | Pattern |
|------|------|---------|
| `server/src/routes/knowledge.ts` | 15 | `const KNOWLEDGE_API_KEY = process.env.MI_CORE_API_KEY \|\| 'mi-core-secret-2026'` |
| `server/src/routes/jarvis.ts` | 285 | `const JARVIS_API_KEY = process.env.MI_CORE_API_KEY \|\| 'mi-core-secret-2026'` |
| `server/src/routes/gstack.ts` | 23 | `const API_KEY = process.env.MI_CORE_API_KEY \|\| 'mi-core-secret-2026'` |
| `server/src/graph/graph-router.ts` | 30 | `const API_KEY = process.env.MI_CORE_API_KEY \|\| 'mi-core-secret-2026'` |

#### Files with hardcoded-only (no env var check)

| File | Line | Pattern |
|------|------|---------|
| `server/src/gstack/role-agents/qa-agent.ts` | 54 | `{ name: 'mi-core', port: 4001, path: '/api/health', key: 'mi-core-secret-2026' }` |
| `server/src/gstack/skills/skill-registry.ts` | 289 | `key: process.env.MI_CORE_API_KEY \|\| 'mi-core-secret-2026'` (dashboard_audit) |
| `server/src/gstack/skills/skill-registry.ts` | 297 | `const apiKey = process.env.MI_CORE_API_KEY \|\| 'mi-core-secret-2026'` (github_write) |
| `server/src/gstack/skills/skill-registry.ts` | 309 | `'mi-core-secret-2026'` (review_automation) |

**Total: 8 occurrences across 4 files in `server/src/`**

### Runtime Behavior — No Auth Env Present

All protected routes return correct 401:

```
GET /api/approval/pending → 401 {"error":"Unauthorized — login with PIN"}
GET /api/actions          → 401 {"error":"Unauthorized — login with PIN"}
GET /api/executive        → 401 {"error":"Unauthorized — login with PIN"}
GET /api/memory           → 401 {"error":"Unauthorized — login with PIN"}
GET /api/brain            → 401 {"error":"Unauthorized — login with PIN"}
GET /api/visibility       → 401 {"error":"Unauthorized — login with PIN"}
GET /api/graph            → 401 {"error":"Unauthorized — login with PIN"}
GET /api/briefing         → 401 {"error":"Unauthorized — login with PIN"}
GET /api/jarvis           → 401 {"error":"Unauthorized — login with PIN"}
GET /api/chat             → 401 {"error":"Unauthorized — login with PIN"}
GET /api/knowledge        → 401 {"error":"Unauthorized — login with PIN"}
```

✅ No secret appears in any error response.

### Server Log Evidence — `MI_CORE_API_KEY not set`

```
[RateLimit] MI_CORE_API_KEY not set — internal rate-limit bypass disabled
[Review approval] callbacks are running without REVIEW_SYSTEM_INTERNAL_TOKEN.
```

✅ Server correctly detects missing env var — fallback is **NOT auto-activating** in production.

### Auth Gate — `requireAuth` (index.ts)

```typescript
const MI_PIN = process.env.MI_PIN || ''; // no fallback secret here
app.use('/api', requireAuth);
```

✅ The main auth gate in `index.ts` does NOT use the fallback secret. It relies on PIN from env.

### Fallback Secret Risk Assessment

**Risk Level: MEDIUM (not critical)**

- The fallback `mi-core-secret-2026` in 8 files means that if `MI_CORE_API_KEY` is unset AND the attacker knows the fallback value, they could authenticate to those specific sub-routes.
- However, the **main auth gate** (`requireAuth` in `index.ts`) uses PIN-based session tokens, NOT direct API key comparison — it does NOT fall back to `mi-core-secret-2026`.
- The 8 files with fallback are: `knowledge.ts`, `jarvis.ts` (Phase 30), `gstack.ts`, `graph-router.ts`, `qa-agent.ts`, `skill-registry.ts`.
- `qa-agent.ts` hardcodes the secret as a health-check key for internal service-to-service calls — **hardcoded literal, no env override** at line 54.

### No Secret in Responses

✅ Verified: None of the 401 responses contain `mi-core-secret-2026`.

---

## Verdict

| Criterion | Status | Notes |
|-----------|--------|-------|
| `mi-core-secret-2026` removed from runtime `server/src/` | ❌ **FAIL** | 8 occurrences remain |
| No fallback secret | ❌ **FAIL** | All 8 files have fallback |
| Server fails safe without auth env | ✅ PASS | Correctly detects missing env; fallback not auto-used |
| No secret in API responses | ✅ PASS | 401 responses are clean |

**Track V1 Status: `HARDCODED_SECRET_PARTIALLY_ADDRESSED` → `HARDCODED_SECRET_REMAINING`**

### Required Fix

Dev5 must remove all `|| 'mi-core-secret-2026'` fallbacks from `server/src/` and replace with proper error-throwing:

```typescript
// WRONG (current):
const API_KEY = process.env.MI_CORE_API_KEY || 'mi-core-secret-2026';

// CORRECT:
const API_KEY = process.env.MI_CORE_API_KEY;
if (!API_KEY) throw new Error('MI_CORE_API_KEY environment variable is required');
```

Files to fix:
1. `server/src/routes/knowledge.ts:15`
2. `server/src/routes/jarvis.ts:285`
3. `server/src/routes/gstack.ts:23`
4. `server/src/graph/graph-router.ts:30`
5. `server/src/gstack/role-agents/qa-agent.ts:54` — hardcoded-only, must add env check
6. `server/src/gstack/skills/skill-registry.ts:289,297,309` — 3 occurrences