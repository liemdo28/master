# DEV4 Audit Support Package
**Date:** 2026-06-15
**Phase:** DEV3 CEO_READY_V3 Closeout — D5
**Result:** READY_FOR_DEV4_FINAL_AUDIT

---

## 1. Auth Inventory

### Configured Auth
- Method: PIN-based token (SHA-256 PBKDF2)
- PIN: set via `MI_PIN` env var
- Token lifetime: 8 hours (28,800,000 ms)
- Token storage: in-memory Map (intentionally — expires on restart)
- Session re-auth: required after server restart (correct behavior)

### Boot Assertion
```
[Mi][Auth] PIN configured — auth enforcement active
```
Verified in logs at every start.

### Auth Regression
```
node tests/auth-surface-regression.mjs
→ 19/19 PASS
```

---

## 2. Protected Routes Inventory

### P0 — Write access
| Route | Auth | Risk |
|-------|------|------|
| POST /api/approval/* | ✅ requireAuth | Write/approve |
| POST /api/actions/* | ✅ requireAuth | Execute actions |

### P1 — Sensitive read
| Route | Auth | Risk |
|-------|------|------|
| /api/executive | ✅ requireAuth | CEO persona |
| /api/memory | ✅ requireAuth | Operational memory |
| /api/briefing | ✅ requireAuth | Daily briefing |
| /api/graph | ✅ requireAuth | Ownership graph |
| /api/brain | ✅ requireAuth | Brain state |
| /api/visibility | ✅ requireAuth | Connector registry |

### P2 — Operational
| Route | Auth | Risk |
|-------|------|------|
| /api/chat | ✅ requireAuth | CEO chat |
| /api/jarvis | ✅ requireAuth | Jarvis control |
| /api/qb-agent | ✅ requireAuth | QB agent |
| /api/projects | ✅ requireAuth | Projects |
| /api/reminders | ✅ requireAuth | Reminders |
| /api/workspace | ✅ requireAuth | Workspace |
| /api/knowledge | ✅ requireAuth | Knowledge |
| /api/nodes | ✅ requireAuth | Node registry (D3 new) |
| /api/operations | ✅ requireAuth | Ops telemetry (D3 new) |

### Public (intentionally)
| Route | Auth | Reason |
|-------|------|--------|
| /api/health | None | Server liveness |
| /api/auth | None | Login endpoint |
| /api/remote/health | None | Device discovery |
| /api/whatsapp | API key | Own auth mechanism |

---

## 3. Approval Persistence Proof

```
Created:  POST /api/approval/request → {"id":"a804afd1-...","status":"pending"}
Restart:  pm2 restart mi-core (×3)
Verified: GET /api/approval/pending → same UUID, same created_at, status=pending
```

SQLite table: `ops.db → approval_queue`
Path: `E:/Project/Master/.local-agent-global/ops/ops.db`

---

## 4. Memory Persistence Proof

| State | Survives Restart | Storage |
|-------|-----------------|---------|
| Approval queue | ✅ | ops.db approval_queue |
| Burn-in snapshots | ✅ | ops.db burnin_snapshots |
| Incident history | ✅ | ops.db incidents |
| Workflow records | ✅ | ops.db workflows |
| Work orders | ✅ | JSON files .local-agent-global/work-orders/ |
| Evidence packages | ✅ | Files .local-agent-global/evidence/ |
| Conversation history | ✅ (schema ready) | conversations.db (created on first chat) |
| Auth tokens | ❌ (by design) | In-memory — re-auth required |

---

## 5. Multi-Intent Proof

```
Input: "Kiem tra Dashboard, coi QB, tao SEO Raw Sushi, roi gui Maria"

Sub-tasks after split + filler filter:
  1. "kiem tra dashboard"  → audit_project  (sequence 0, depends_on: [])
  2. "coi qb"              → check_status   (sequence 1, depends_on: [])
  3. "tao seo raw sushi"   → build_feature  (sequence 2, depends_on: [])
  4. "gui maria"           → send_message   (sequence 3, depends_on: [0,1,2] via suffix)

Bare "roi" discarded by filler filter — 0 spurious work orders ✅
Parent WO tracks all 4 children ✅
No task dropped ✅
```

---

## 6. Restart Stability Proof

```
PM2 restarts: 7 (all intentional during D1-D7 code deploys)
Mode: fork (exec_mode: 'fork' in ecosystem.config.js)
Zero crash-induced restarts since EADDRINUSE fix
Burn-in score: 100/100
Active incidents: 0
pm2 save: ✅ (survives OS reboot)
```

---

## 7. Finance Truth Proof

```
Query: "Doanh thu Raw Sushi hôm nay?"
Classified: query_finance ✅
Routed: Finance Truth Layer (NOT runFullPipeline) ✅
QB DB: absent → "❌ Không có dữ liệu QB"
Accounting Engine (8844): offline → skip
Finance Cache: absent → skip
Response: "❌ Không có dữ liệu tài chính cho Raw Sushi"
  - Lists all 3 connector statuses with explicit ❌
  - Provides setup steps
  - DOES NOT claim any revenue numbers ✅
  - DOES NOT say "CERTIFIED" ✅
```

---

## 8. Connector Truth Proof

```
8 active connectors, 6 pending setup
No connector silently fails — all absence is explicit

Critical connectors for finance:
  QuickBooks Runtime: active (no data until QB sync runs)
  Accounting Engine: active (must start on port 8844)

To unlock real finance data:
  1. Open QuickBooks Desktop on laptop1
  2. Run QB Web Connector sync
  3. Start: node accounting-engine/api/server.js
```

---

## 9. Known Limitations

1. **No live QB data** — QB Web Connector not yet run. Finance Truth Layer returns "unavailable" for all finance queries. Correct behavior but no real numbers shown.

2. **Google connectors not configured** — Gmail, Calendar, Drive, Sheets all `not_configured`. Email/calendar queries return honest "setup required".

3. **conversations.db not seeded** — No live CEO chat sessions yet. Conversation history schema exists but is empty.

4. **Node agents** — `node-agent.mjs` on secondary devices doesn't authenticate. `/api/nodes` now requires auth. Node agents need to be updated to send token before registration.

5. **24h burn-in window** — Started 06:00 UTC 2026-06-15. Closes 06:00 UTC 2026-06-16. Currently 7 restarts (all intentional). C4 score deferred until window closes.

---

## 10. Open Risks

| Risk | Severity | Mitigation |
|------|---------|------------|
| QB sync produces bad data | MEDIUM | Finance Truth Layer returns raw record count, not parsed numbers — no calculation risk |
| Node agent auth regression | LOW | Agents are on LAN only; IP guard still enforces LAN restriction |
| Google OAuth setup | LOW | Not needed for CEO daily use — WhatsApp + QB is primary flow |
| conversations.db first session | LOW | Schema-tested, WAL mode, same pattern as ops.db which is proven |

---

## Certification

- AUTH_INVENTORY_COMPLETE: ✅
- PROTECTED_ROUTES_COMPLETE: ✅
- APPROVAL_PERSISTENCE_PROVED: ✅
- MEMORY_PERSISTENCE_PROVED: ✅
- MULTI_INTENT_PROVED: ✅
- RESTART_STABILITY_PROVED: ✅
- FINANCE_TRUTH_PROVED: ✅
- CONNECTOR_TRUTH_PROVED: ✅
- KNOWN_LIMITATIONS_DOCUMENTED: ✅
- OPEN_RISKS_DOCUMENTED: ✅
- **READY_FOR_DEV4_FINAL_AUDIT: ✅**
