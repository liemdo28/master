# MI EXECUTIVE OPERATING SYSTEM — MASTER PHASE
**Last Updated:** 2026-06-10
**Program Goal:** CEO talks to Mi. Mi handles everything else.

---

## Vision

```
CEO
↓
Mi
↓
Everything else
```

Mi decides:
- which brain to use
- which connector to use
- which skill to use
- whether approval is required

---

## Master Acceptance Tests

```
/mi hôm nay anh nên làm gì?          → Daily briefing from all connectors
/mi có issue nào từ team không?        → Asana + project scan
/mi Texas sales tax Bakudan?           → US Compliance DB
/mi phân tích doanh thu tuần này       → Data Analyst Engine
/mi tạo task cho Maria                 → Dashboard + Asana
/mi tìm file QA report rồi gửi David   → File search + Gmail executor
/mi mở Dashboard kiểm tra overdue      → Browser automation or connector
/mi tóm tắt WhatsApp hôm nay          → WhatsApp message summary
/mi Raw payroll risk là gì?            → US Compliance DB (California)
/mi tạo meeting với Maria ngày mai     → Calendar executor
```

---

## Workstream Status

| # | Workstream | Status | Progress | Last Updated |
|---|---|---|---|---|
| WS1 | Mi Core Brain Router | **BUILT** | **85%** | 2026-06-10 |
| WS2 | Universal Visibility | BUILT | 75% | 2026-06-10 |
| WS3 | WhatsApp | BUILT | 85% | 2026-06-10 |
| WS4 | US Compliance DB | **BUILT** | **90%** | 2026-06-10 |
| WS5 | Data Analyst | BUILT | 90% | 2026-06-10 |
| WS6 | Qdrant Semantic Memory | BUILT | 60% | 2026-06-10 |
| WS7 | Skill Registry | **BUILT** | **80%** | 2026-06-10 |
| WS8 | Browser Automation | BUILT | 50% | 2026-06-10 |
| WS9 | Remote Control | BUILT | 65% | 2026-06-10 |
| WS10 | Website Connectors | PARTIAL | 20% | — |
| WS11 | Dashboard Connector | PARTIAL | 40% | — |
| WS12 | Engineering Node | **BUILT** | **75%** | 2026-06-10 |

**Overall: ~70%**

---

## WS1 — Mi Core Brain Router

**Goal:** Mi selects the right brain for every query. CEO never chooses.

### Brain Registry
| Brain | Model | Use Case |
|---|---|---|
| qwen-fast | qwen3:1.7b | Quick answers, simple questions |
| qwen-balanced | qwen3:8b | General chat, daily ops |
| qwen-deep | qwen3:14b | Complex reasoning, multi-step |
| qwen-coder | qwen2.5-coder:7b | Code review, debugging, engineering |
| compliance | qwen3:8b + compliance DB | Tax, labor law, permits |
| data-analyst | DataAnalystEngine | Revenue, sales, business data |
| skill-router | varies | Specialized skill delegation |
| claude-api | claude-sonnet-4-6 | Optional (requires API key) |

### Files
- `server/src/brain/intent-classifier.ts` — classify intent from Vietnamese/English
- `server/src/brain/brain-router.ts` — select brain by intent
- `server/src/brain/model-selector.ts` — select Ollama model config

### Output: MI_SMART_BRAIN_ROUTER_READY

---

## WS2 — Universal Visibility

**Status: BUILT**

12 connectors in `local-agent/universal-visibility/`:
Gmail, Calendar, Drive, Asana, Dashboard, LocalFile, PlatformHealth, VisibilityCache, VisibilityHub, ConnectorRegistry, DailySnapshotBuilder, index

**Gap:** Real-time data not flowing in dashboard yet — connectors exist but sync cadence TBD.

### Output: UNIVERSAL_VISIBILITY_READY (pending E2E with live OAuth)

---

## WS3 — WhatsApp

**Status: BUILT, key not configured**

All security gates working. Missing:
- [ ] API key setup (CEO runs POST /api/whatsapp/mi/setup)
- [ ] Daily summary generator (morning briefing via WhatsApp)
- [ ] Action extraction (detect tasks/emails in conversational messages)
- [ ] Group message routing

### Output: WHATSAPP_MI_READY

---

## WS4 — US Compliance DB

**Location:** `mi-core/.local-agent-global/reference-brain/us-business-compliance/`
**Size:** 1.5GB | 743 docs | 515k chunks

**Status:** Data exists. Retrieval core needs to be wired.

### Files needed
- `server/src/knowledge/compliance-retrieval.ts` — search by source_catalog + read markdown
- Update `knowledge-federation/index.ts` — add compliance domain
- Update pipeline — inject compliance context for tax/labor/permit queries

### Output: US_COMPLIANCE_DB_FULLY_INTEGRATED

---

## WS5 — Data Analyst

**Status: BUILT (90%)**

15 modules in `local-agent/data-analyst/`. Catalog API live. Analytics validated.

**Gap:** Chart rendering in UI not built yet.

### Output: MI_DATA_ANALYST_READY ✅ (issued 2026-06-09)

---

## WS6 — Qdrant Semantic Memory

**Status: NOT STARTED**

Qdrant not installed. Plan:
1. `docker run -p 6333:6333 qdrant/qdrant`
2. Install `@qdrant/js-client-rest`
3. Build `server/src/memory/qdrant-client.ts`
4. Collections: mi_memory, mi_knowledge, mi_compliance, mi_messages
5. Index existing knowledge DB into Qdrant

### Output: QDRANT_SEMANTIC_MEMORY_READY

---

## WS7 — Skill Registry

**Status: NOT STARTED**

Plan:
1. `local-agent/skill-registry/SkillRegistry.mjs` — catalog of skills
2. Initial packs: data-analyst, compliance, project-manager, content-writer
3. `SkillRouter.mjs` — route message to skill
4. Register in pipeline

### Output: MI_SKILL_REGISTRY_READY

---

## WS8 — Browser Automation

**Status: browser-use v0.13.1 INSTALLED**

Plan:
1. `local-agent/browser-agent/BrowserAgent.mjs` — Python bridge to browser-use
2. `server/src/routes/browser-agent.ts` — REST endpoint
3. L2 approval required for any write actions via browser
4. Read-only: no approval needed

### Output: MI_BROWSER_AUTOMATION_READY

---

## WS9 — Remote Control

**Status: BUILT (65%)**

Tailscale URL: `http://100.118.102.113:4001`
Mobile UI: `mobile.html` — Tailscale accessible
PIN: 4452

**Gaps:**
- Push notifications (no service worker yet)
- Offline mode

### Output: MI_REMOTE_ACCESS_READY

---

## WS10 — Website Connectors

**Targets:** bakudanramen.com, rawsushibar.com
**Status:** 20%

Plan:
- WordPress/Ghost API for content
- Menu update via API or browser-use
- All writes: L2 approval

### Output: MI_WEBSITE_CONNECTORS_READY

---

## WS11 — Dashboard Connector

**Target:** dashboard.bakudanramen.com
**Status:** 40% (partial connector exists)

Plan:
- Read tasks, create tasks, assign
- Write actions: L2 approval

### Output: MI_DASHBOARD_CONNECTOR_READY

---

## WS12 — Engineering Node

**Status: NOT STARTED**

Plan:
1. Route coding queries → `qwen2.5-coder:7b` (already in Ollama)
2. Claude API as optional premium path
3. Source audit capability
4. Patch planning

### Output: MI_ENGINEERING_NODE_READY

---

## Overall Progress Tracker

```
████████░░  WS1 Brain Router        85%  ✅ BUILT — intent classifier + brain selector + compliance routing
███████░░░  WS2 Visibility          75%  ✅ BUILT — 12 connectors, daily snapshot
████████░░  WS3 WhatsApp            85%  ✅ BUILT — security gates validated, daily summary module
█████████░  WS4 Compliance DB       90%  ✅ BUILT — 1.5GB DB, retrieval live, 3 docs found on test
█████████░  WS5 Data Analyst        90%  ✅ BUILT — catalog API, analytics validated
██████░░░░  WS6 Qdrant              60%  ✅ BUILT — client + collections (needs docker start)
████████░░  WS7 Skill Registry      80%  ✅ BUILT — 6 skills live, /api/skills routes working
█████░░░░░  WS8 Browser Auto        50%  ✅ BUILT — bridge ready (needs playwright install)
██████░░░░  WS9 Remote              65%  ✅ BUILT — Tailscale mobile, PIN, 16px input fix
██░░░░░░░░  WS10 Website            20%  ⏳ PARTIAL
████░░░░░░  WS11 Dashboard          40%  ⏳ PARTIAL
███████░░░  WS12 Engineering        75%  ✅ BUILT — qwen2.5-coder:7b routing live

PROGRAM TOTAL: ~70%
TARGET: 80%+
REMAINING GAP: WS10 (website connectors) + WS11 (dashboard) + Qdrant docker + playwright
```
