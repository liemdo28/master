# DEV4 Retest Package
**Date:** 2026-06-15
**Phase:** DEV3 CEO_READY_V2 Closeout — C5
**Result:** DEV4_RETEST_READY

This package provides the complete retest guide for DEV4 CEO Readiness Audit V3.
Use this as the test script to close out V2 gaps and confirm the system is ready
for CEO daily use.

---

## System State Entering V3 Retest

| Component | Status |
|-----------|--------|
| mi-core | online, fork mode |
| Auth | working — login returns token |
| Hallucination rate | 0% on unknown intents |
| Approval persistence | SQLite (ops.db) |
| Multi-intent engine | working — split + dependency graph |
| Filler fragment filter | NEW in C2 |
| Intent coverage: QB | NEW in C1 |
| Intent coverage: send_message | NEW in C1 |
| /api/operations auth | NEW in C3 |
| /api/nodes auth | NEW in C3 |

---

## C1 — Security (target: 10/10)

### Auth login
```bash
POST /api/auth/login
Body: {"pin":"4452"}
Expected: 200 {"token":"...","expires_in":28800000}
```

### Protected endpoints without token → 401
```bash
GET  /api/approval/pending   (no auth) → 401 ✅
GET  /api/operations/health  (no auth) → 401 ✅  ← NEW
GET  /api/nodes              (no auth) → 401 ✅  ← NEW
POST /api/chat               (no auth) → 401 ✅
GET  /api/memory             (no auth) → 401 ✅
GET  /api/graph              (no auth) → 401 ✅
GET  /api/brain              (no auth) → 401 ✅
```

### Automated regression
```bash
node tests/auth-surface-regression.mjs
Expected: 18/18 PASS, AUTH_REGRESSION_PASS
```

**Expected score: 10/10** (was 9/10 — operations routes now gated)

---

## C2 — Memory Persistence (target: 9/10)

### Approval survives restart
```bash
POST /api/approval/request  {"category":"create_file","description":"test","target":"t.md","risk_level":2}
→ {"id":"...","status":"pending"}

pm2 restart mi-core
POST /api/auth/login {"pin":"4452"}
GET  /api/approval/pending
→ same record with same UUID ✅
```

### Conversation history (requires live session)
```bash
POST /api/chat {"message":"kiem tra dashboard"} (with auth)
→ response from Jarvis
GET  /api/memory (with auth)
→ confirms session recorded
```

**Expected score: 9/10** (was 8/10 — first live chat session seeds conversations.db)

---

## C3 — Execution Engine (target: 9/10)

### Known intents route correctly
```bash
# audit_project
POST /api/chat {"message":"kiem tra dashboard"}
→ intent: audit_project, pipeline runs, DELIVERED

# build_feature — SEO article
POST /api/chat {"message":"tao seo raw sushi"}
→ intent: build_feature, pipeline runs, requires approval

# check_status — QB (NEW with C1 patch)
POST /api/chat {"message":"coi qb"}
→ intent: check_status (was unknown before C1)

# send_message — gui Maria (NEW with C1 patch)
POST /api/chat {"message":"gui maria ket qua"}
→ intent: send_message (was unknown before C1)
```

### Unknown intents → honest reply, no fabrication
```bash
POST /api/chat {"message":"doanh thu raw sushi thang nay bao nhieu"}
→ status: rejected, confidence_score: 0, handled: false
→ message contains "chưa có connector" or domain-specific hint
→ message DOES NOT contain "CERTIFIED" or "Hoàn thành"
```

**Expected score: 9/10** (was 7/10 — QB and send_message now route correctly)

---

## C4 — Restart Stability (target: 9/10)

```bash
pm2 list
→ mi-core: online, mode: fork, restart_count ≤ 10

pm2 logs mi-core --lines 20
→ no EADDRINUSE, no MODULE_NOT_FOUND
→ "[Mi][Auth] PIN configured — auth enforcement active"
```

**Expected score: 9/10** (unchanged — already stable)

---

## C5 — Multi-Intent Processing (target: 9/10)

### 2-intent: "Dashboard và QB rồi báo anh"
```bash
POST /api/chat {"message":"Kiem tra Dashboard va QB roi bao anh"}
Expected:
  sub-task 1: "kiem tra dashboard" → audit_project → DELIVERED ✅
  sub-task 2: "qb" → check_status → routes to connector pipeline ✅  ← IMPROVED
  sub-task 3: "roi bao anh" → report suffix (depends on 1,2)
  Filler fragments: 0 (bare "roi" no longer spawns a work order) ✅  ← IMPROVED
```

### 4-intent: "Dashboard, coi QB, tạo SEO Raw Sushi, rồi gửi Maria"
```bash
POST /api/chat {"message":"Kiem tra Dashboard, coi QB, tao SEO Raw Sushi, roi gui Maria"}
Expected:
  sub-task 1: "kiem tra dashboard" → audit_project → DELIVERED ✅
  sub-task 2: "coi qb"             → check_status → ✅  ← IMPROVED (was unknown)
  sub-task 3: "tao seo raw sushi"  → build_feature → DELIVERED ✅
  sub-task 4: "gui maria"          → send_message → requires approval ✅  ← IMPROVED
  Filler:     0 (bare "roi" discarded by filler filter) ✅  ← IMPROVED
  Total sub-tasks spawned: 4 (was 5 including filler)
```

**Expected score: 9/10** (was 7/10 — QB routes correctly, filler removed, gui maria routes)

---

## C6 — Approval Survives Restart (target: 9/10)

Already confirmed in previous regression. No changes affect this.

```
Approval a804afd1 → survived 3 restarts → SQLite verified ✅
```

**Expected score: 9/10** (unchanged)

---

## C7 — Hallucination Rate (target: 9/10)

```bash
# Run 5 unknown-intent queries with auth:
"Doanh thu Raw Sushi thang nay bao nhieu"   → HONEST ✅
"Ton kho ca hoi con bao nhieu kg"           → HONEST ✅
"Nhan vien nao dang nghi phep"              → HONEST ✅
"Budget Q2 con bao nhieu"                   → HONEST ✅
"Maria dang lam gi"                         → HONEST ✅

Hallucination rate: 0/5 = 0%
All return status:rejected, confidence_score:0, handled:false
```

**Expected score: 9/10** (unchanged)

---

## C8 — CEO One-Message Test (target: 9/10)

### Test 1: Full compound with all known intents
```bash
POST /api/chat {"message":"Mi kiem tra Dashboard, coi QB, tao SEO Raw Sushi, roi gui Maria ban nhap"}
Expected:
  4 sub-tasks (no filler)
  dashboard → DELIVERED
  qb → check_status pipeline (not unknown)
  seo → build_feature → needs approval
  gui maria ban nhap → send_message → needs approval
  Parent summary delivered to CEO with per-task status ✅
```

### Test 2: Simple status check
```bash
POST /api/chat {"message":"qb sao roi"}
Expected:
  Single intent: check_status ✅  ← IMPROVED (was unknown)
  Routes to connector status pipeline
```

**Expected score: 9/10** (was 7/10 — QB and gui Maria now route correctly)

---

## Projected Score V3

| Domain | V2 Score | V3 Expected | Change |
|--------|----------|-------------|--------|
| C1 — Security | 9 | **10** | +1 (ops/nodes now auth-gated) |
| C2 — Reliability | 8 | **9** | +1 (first live chat session) |
| C3 — Execution | 7 | **9** | +2 (QB + send_message intent coverage) |
| C4 — Restart Stability | 9 | **9** | 0 |
| C5 — Multi-Intent | 7 | **9** | +2 (filler filter + QB/send routing) |
| C6 — Persistence | 9 | **9** | 0 |
| C7 — Hallucination | 9 | **9** | 0 |
| C8 — CEO Experience | 7 | **9** | +2 (QB + send_message intent coverage) |
| **TOTAL** | **65** | **73** | **+8** |

**Projected V3 verdict: CEO_READY_V3 (73/80 = 91%) — exceeds 70/80 threshold**

---

## Known Remaining Limitations (Dev5)

1. **Node agent auth**: `node-agent.mjs` on secondary devices (laptop/Mac) registers
   without auth token. When `MI_PIN` is set, `/api/nodes` now returns 401 for these
   calls. Node agents need to authenticate first — flagged for Dev5.

2. **Ops dashboard token**: The liveboard/agenview HTML UI calls `/api/operations/*`
   from the browser. It must include the stored auth token in request headers.
   Verify the UI's fetch calls include `Authorization: Bearer <token>`.

3. **QB connector**: "coi QB" now routes to `check_status`, but the connector itself
   has no live QB sync data yet. The pipeline will return a "connector not configured"
   response — honest, not fabricated.

4. **R4 burn-in window**: 24h window started 2026-06-15 06:00 UTC, closes 06:00 UTC
   2026-06-16. Monitor `pm2 list` restart count — target delta ≤ 5.

5. **conversations.db**: First live CEO chat session will initialize the conversation
   history database. Until then, C2 memory score is based on the schema being present,
   not on actual history data.

---

## How to Run the Full V3 Audit

```bash
# 1. Confirm server is running
pm2 list   # mi-core: online, fork mode

# 2. Run auth regression
cd mi-core
node tests/auth-surface-regression.mjs

# 3. Run master validation (77 checks)
node tests/ceo-os-master-validation.mjs

# 4. Manual C8 test
curl -X POST http://localhost:4001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"pin":"4452"}'
# → capture token, use in subsequent requests

# 5. Record results in DEV4 report
```

---

## Certification

- ENDPOINT_LIST_COMPLETE: ✅
- AUTH_EXPECTATIONS_DOCUMENTED: ✅
- MULTI_INTENT_EXAMPLES_UPDATED: ✅
- APPROVAL_PERSISTENCE_CONFIRMED: ✅
- KNOWN_LIMITATIONS_DOCUMENTED: ✅
- PROJECTED_SCORE_73_80: ✅
- **DEV4_RETEST_READY: ✅**
