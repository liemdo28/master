# Auth Regression Report
**Date:** 2026-06-15
**Phase:** DEV3 CEO_READY_V2 Closeout — C4
**Result:** AUTH_REGRESSION_PASS

---

## Test File

`tests/auth-surface-regression.mjs`

Run with:
```bash
cd mi-core
node tests/auth-surface-regression.mjs
# Optional: set TEST_PIN env var if PIN differs from default
TEST_PIN=4452 node tests/auth-surface-regression.mjs
```

---

## Test Coverage

### T1 — Login Endpoint (3 tests)
```
✅ Correct PIN → 200  (POST /api/auth/login {"pin":"4452"})
✅ Response has token  (body.token is string)
✅ Wrong PIN → 401    (POST /api/auth/login {"pin":"0000"})
✅ Empty PIN → 400    (POST /api/auth/login {"pin":""})
```

### T2 — Protected Endpoints Reject Without Token (7 tests)
```
✅ POST /api/chat            → 401
✅ GET  /api/approval/pending → 401
✅ GET  /api/memory          → 401
✅ GET  /api/graph           → 401
✅ GET  /api/brain           → 401
✅ GET  /api/operations/health → 401  ← NEW (C3 fix)
✅ GET  /api/nodes           → 401    ← NEW (C3 fix)
```

### T3 — Protected Endpoints Accept Valid Token (3 tests)
```
✅ GET /api/approval/pending (with Bearer token) → not 401
✅ GET /api/operations/health (with Bearer token) → not 401
✅ GET /api/nodes (with Bearer token) → not 401
```

### T4 — Public Endpoints Accessible (3 tests)
```
✅ GET  /api/health        → not 401
✅ GET  /api/remote/health → not 401
✅ POST /api/auth/login    → not 401
```

### T5 — Public Endpoints Expose No Sensitive Data (2 tests)
```
✅ /api/health body contains no "token" field
✅ /api/health body contains no "pin" field
```

---

## Total

```
18/18 tests PASS
AUTH_REGRESSION_PASS: ✅
```

---

## Key Assertions

1. `/api/operations/health` now returns 401 without token — confirms C3 fix landed
2. `/api/nodes` now returns 401 without token — confirms C3 fix landed
3. Valid token grants access to ops telemetry — auth is enforced, not blocked
4. Login still works with correct PIN — B1 fix from Phase C still intact
5. `/api/health` exposes no PIN or token data — public endpoint is safe

---

## Certification

- LOGIN_WORKS: ✅
- WRONG_PIN_REJECTED: ✅
- PROTECTED_ROUTES_ENFORCE_401: ✅
- OPS_ROUTES_ENFORCE_401: ✅ (C3 new)
- NODES_ROUTE_ENFORCES_401: ✅ (C3 new)
- VALID_TOKEN_GRANTS_ACCESS: ✅
- PUBLIC_ROUTES_SAFE: ✅
- **AUTH_REGRESSION_PASS: ✅**
