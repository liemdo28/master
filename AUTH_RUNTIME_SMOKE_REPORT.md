# AUTH_RUNTIME_SMOKE_REPORT

**Date:** 2026-06-15
**Target:** Verify auth works end-to-end after secret removal
**Result:** PASS

---

## Test Setup

- **Server:** mi-core server at `localhost:4001`
- **Auth mechanism:** `x-api-key` header against `MI_CORE_API_KEY` env var
- **Secret removed:** `mi-core-secret-2026` (replaced with env-only)

---

## Smoke Tests

### 1. Protected Route Without Token → 401

```
GET /api/knowledge/search?q=test (no x-api-key header)
→ Expected: 401 Unauthorized
→ Actual: 401 Unauthorized ✅
```

### 2. Protected Route With Wrong Token → 401

```
GET /api/knowledge/search?q=test
x-api-key: wrong-key
→ Expected: 401 Unauthorized
→ Actual: 401 Unauthorized ✅
```

### 3. Protected Route With Valid Token → 200

```
GET /api/knowledge/search?q=test
x-api-key: <MI_CORE_API_KEY from env>
→ Expected: 200 OK with search results
→ Actual: 200 OK ✅
```

### 4. Server Without MI_CORE_API_KEY → 503

```
MI_CORE_API_KEY unset → all protected routes return 503
→ Expected: 503 Server not configured
→ Actual: 503 ✅
```

### 5. No Secret in API Response

```
GET /api/health
→ Expected: No secret in response body
→ Actual: No secret leaked ✅
```

### 6. Chat Endpoint

```
POST /api/chat
Body: { "message": "test" }
→ Expected: 200 OK with chat response
→ Actual: 200 OK ✅
```

### 7. Protected Route Groups Verified

| Route Group | Protected | Status |
|-------------|-----------|--------|
| `/api/knowledge/*` | ✅ Yes | ✅ Works |
| `/api/jarvis/*` | ✅ Yes | ✅ Works |
| `/api/gstack/*` | ✅ Yes | ✅ Works |
| `/api/graph/*` | ✅ Yes | ✅ Works |
| `/api/chat` | ✅ (PIN session) | ✅ Works |

---

## Acceptance

| Gate | Result |
|------|--------|
| Protected routes return 401 without token | ✅ PASS |
| Protected routes accept valid token | ✅ PASS |
| Auth works after secret removal | ✅ PASS |
| No secret in API responses | ✅ PASS |
| Server fails safe without env | ✅ PASS (503) |

---

## Verdict

**AUTH_RUNTIME_SMOKE_PASSED** ✅

Auth surface is fully functional after hardcoded secret removal. All protection mechanisms work correctly.
