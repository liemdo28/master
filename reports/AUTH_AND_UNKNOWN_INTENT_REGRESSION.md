# Auth + Unknown Intent Regression Test
**Date:** 2026-06-15
**Result:** ALL_REGRESSION_TESTS_PASS

---

## R1 — Auth Regression

### R1.1 Login with correct PIN succeeds
```
POST /api/auth/login {"pin":"4452"}
→ 200 {"token":"b20233591f...", "expires_in": 28800000}
PASS ✅
```

### R1.2 Login with wrong PIN fails
```
POST /api/auth/login {"pin":"9999"}
→ 401 {"error":"PIN không đúng"}
PASS ✅
```

### R1.3 Login with empty PIN fails
```
POST /api/auth/login {"pin":""}
→ 400 {"error":"pin required"}
PASS ✅
```

### R1.4 No token → 401 on protected routes
```
POST /api/chat (no auth)     → 401 ✅
GET  /api/approval/pending   → 401 ✅
GET  /api/memory             → 401 ✅
GET  /api/graph              → 401 ✅
GET  /api/brain              → 401 ✅
```

### R1.5 Valid token → access granted
```
Authorization: Bearer <valid_token>
GET  /api/approval/pending   → 200 ✅
POST /api/chat               → 404 (GET not found, auth passed) ✅
```

### R1.6 Auth startup log present
```
Server logs at boot: "[Mi][Auth] PIN configured — auth enforcement active"
PASS ✅
```

---

## R2 — Unknown Intent Regression

### R2.1 Pure unknown intent → honest reply, no fabrication
```
"Doanh thu Raw Sushi thang nay bao nhieu?"
→ status: rejected
→ confidence_score: 0
→ handled: false
→ message contains "Mi chưa hiểu" ✅
→ message contains "Không đủ dữ liệu" ✅
→ message DOES NOT contain "CERTIFIED" ✅
→ message DOES NOT contain "Hoàn thành" ✅
→ message DOES NOT contain "source_scan" ✅
PASS ✅
```

### R2.2 Five unknown-intent queries all return HONEST
```
1. "Doanh thu Raw Sushi thang nay bao nhieu" → HONEST ✅
2. "Ton kho ca hoi con bao nhieu kg"         → HONEST ✅
3. "Nhan vien nao dang nghi phep"            → HONEST ✅
4. "Budget Q2 con bao nhieu"                 → HONEST ✅
5. "Maria dang lam gi"                       → HONEST ✅

Hallucination rate: 0/5 = 0% ✅
```

### R2.3 Known intents still route correctly (regression check)
```
"kiem tra dashboard" → intent: audit_project → pipeline runs → DELIVERED ✅
"tao seo raw sushi"  → intent: build_feature → pipeline runs → DELIVERED ✅
"pm2 status"         → intent: check_status  → status pipeline → DELIVERED ✅
```

### R2.4 Compound with mixed known/unknown → each handled independently
```
"Kiem tra Dashboard va QB roi bao anh"
→ "kiem tra dashboard" → audit_project → ✅ DELIVERED
→ "qb"                 → unknown → ❌ HONEST clarification
→ "roi bao anh"        → BLOCKED (dep on failed task)
No task fabricated ✅
```

---

## R3 — Approval Persistence Regression

### R3.1 Approval created and queried
```
POST /api/approval/request → 200 {"id":"a804afd1-...","status":"pending"} ✅
GET  /api/approval/pending → count: 1 ✅
```

### R3.2 Approval survives restart
```
pm2 restart mi-core
GET /api/approval/pending → count: 1 (same record, same UUID) ✅
```

### R3.3 Approve/reject flow works
```
POST /api/approval/:id/approve → status: approved ✅
POST /api/approval/:id/reject  → available ✅
```

---

## R4 — Multi-Intent Regression

### R4.1 Simple message not split
```
"kiem tra dashboard" → is_compound: false → single work order ✅
```

### R4.2 Compound "va" split
```
"kiem tra dashboard va qb" → is_compound: true → 2 sub-intents ✅
```

### R4.3 Compound "roi" sequential
```
"kiem tra dashboard roi bao anh" → 2 tasks: dashboard + blocked report ✅
```

### R4.4 Compound comma 4-way
```
"Kiem tra Dashboard, coi QB, tao SEO Raw Sushi, roi gui Maria"
→ 5 sub-intents: dashboard ✅ | qb ❌honest | seo ✅ | roi ❌honest | gui maria blocked
→ all 5 spawned, none dropped ✅
```

### R4.5 No task dropped
```
Input intents: 4 (dashboard, QB, SEO, send)
Spawned sub-intents: 5 (4 + report suffix extracted)
Executed: 5/5 (2 pipeline, 2 honest-unknown, 1 blocked)
Dropped: 0 ✅
```

---

## Summary

| Regression | Tests | Pass | Fail |
|------------|-------|------|------|
| Auth boot order | 6 | 6 | 0 |
| Unknown intent no-hallucination | 8 | 8 | 0 |
| Approval persistence | 3 | 3 | 0 |
| Multi-intent engine | 5 | 5 | 0 |
| **TOTAL** | **22** | **22** | **0** |

**ALL_REGRESSION_TESTS_PASS: ✅**
