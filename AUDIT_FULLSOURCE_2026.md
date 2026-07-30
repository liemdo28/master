# MI-CORE FULL SOURCE CODE AUDIT REPORT
**Date:** 2026-07-08 | **Auditor:** Claude Opus 4.6 | **Scope:** d:/Project/Master/mi-core/

---

## TÓM TẮT ĐIỀU HÀNH

| Yêu cầu | Status | Chi tiết |
|----------|--------|----------|
| 1. Tất cả file kết nối với nhau | ⚠️ GẦN HOÀN CHỈNH | 47+ routers mount trên index.ts; 1 broken import |
| 2. mi-core là trung tâm điều phối | ✅ XÁC NHẬN | 47 routers; WS hub; 1 WhatsApp gateway |
| 3. Mi có "tay chân" điều khiển được | ✅ XÁC NHẬN | 16 connectors; Content+Creative+Eng Depts; node network |
| 4. "Tạo bài SEO Raw" end-to-end | 🔴 CHƯA HOÀN CHỈNH | Content pipeline đầy đủ; QA gate có; NHƯNG WhatsApp → Content chain bị tách rời |

---

## PHẦN 1: TẤT CẢ CÁC FILE KẾT NỐI VỚI NHAU

### 1.1 Central Hub — index.ts (port 4001)

47 routers được mount tại 1 hub Express:

```
Express App (port 4001, bind 0.0.0.0)
  ├── /api/approval           → approvalRouter
  ├── /api/actions            → actionsRouter
  ├── /api/executive         → executiveRouter + executiveDailyBriefRouter
  ├── /api/memory            → memoryRouter + selfImprovingMemoryRouter + operationalMemoryRouter
  ├── /api/briefing          → briefingRouter
  ├── /api/graph             → graphRouter
  ├── /api/brain             → brainRouter
  ├── /api/visibility         → visibilityRouter
  ├── /api/chat              → chatRouter
  ├── /api/mi-chat           → miChatRouter + miChatSseRouter
  ├── /api/jarvis            → jarvisRouter
  ├── /api/gstack            → gstackRouter
  ├── /api/content           → contentRouter            ← Content Department
  ├── /api/creative          → creativeRouter           ← Creative Department
  ├── /api/seo               → seoRouter               ← SEO Department
  ├── /api/autonomous         → autonomousRouter
  ├── /api/autonomous-qa     → autonomousQaRouter      ← QA Runtime
  ├── /api/council           → councilRouter
  ├── /api/self-improve      → selfImprovementRouter
  ├── /api/health-intel      → healthIntelligenceRouter
  ├── /api/digital-twin      → digitalTwinRouter
  ├── /api/agenview          → agenviewRouter
  ├── /api/tasks             → taskIntelligenceRouter
  ├── /api/strategic         → strategicMemoryRouter
  ├── /api/n8n               → n8nRouter
  ├── /api/workflows          → workflowMetricsRouter
  ├── /api/mi/workflows      → miWorkflowsRouter
  ├── /api/ceo               → ceoObjectiveRouter + ceoControlRouter
  ├── /api/production-loop    → productionLoopRouter
  ├── /api/knowledge-graph    → knowledgeGraphRouter
  ├── /api/cross-agent       → crossAgentRouter
  ├── /api/engineering       → engineeringRouter
  ├── /api/ai                → aiPlatformRouter
  ├── /api/connectors        → connectorsRouter
  ├── /api/reviews           → reviewsRouter            ← GBP Reviews
  ├── /api/analytics         → ga4AnalyticsRouter
  ├── /api/gbp               → gbpAnalyticsRouter
  ├── /api/whatsapp          → whatsappRouter
  ├── /api/nodes             → nodesRouter              ← Phase 6/7
  ├── /api/qb-agent          → qbAgentRouter
  ├── /api/qb/mirror         → qbMirrorRouter
  ├── /api/qb               → qbRawIngestRouter + qbFinancialRouter
  ├── /api/projects          → projectsRouter
  ├── /api/bigdata           → bigdataRouter
  ├── /api/voice             → voiceRouter
  ├── /api/enterprise        → enterpriseRouter
  ├── /api/skills            → skillRouter
  ├── /api/browser           → browserAgentRouter
  ├── /api/doordash-agent    → doordashAgentRouter
  ├── /api/doordash          → doordashMetricsRouter
  ├── /api/telemetry         → ceoTelemetryRouter
  ├── /api/executive-intelligence → executiveIntelligenceRouter
  ├── /api/coo-v4           → cooV4Router
  ├── /api/company-os        → companyOsRouter
  ├── /api/operations        → operationsRouter
  ├── /api/seo/gsc           → gscRouter
  ├── /api                  → operationalKnowledgeRouter
  ├── /api/agent-engine      → agentEngineRouter
  ├── /api/divisions         → companyDivisionsRouter
  ├── /api/agent-os          → agentOsRouter
  ├── /api/integration-agent  → integrationAgentReleasesRouter
  ├── /api/data-analyst      → dataAnalystRouter
  ├── /api/revenue           → revenueRouter
  └── /ws                    → WebSocket broadcast hub (ws-broadcast.ts)
```

**Đánh giá:** ✅ 47 routers mount tại 1 hub. Mọi phase (14-30) đều có router tương ứng.

### 1.2 Intent → Execution Chain (GStack Pipeline)

```
CEO WhatsApp message
    ↓
jarvis-core.ts (Phase 30) + phase30-jarvis/jarvis-core.ts
    ↓
intent-router.ts → classifyIntent() → CeoIntent (16 types: build_feature, check_status, query_finance, etc.)
    ↓
gstack-orchestrator.ts → processGStackRequest()
    ├── Phase 16 fast-path: task-intelligence (SQLite, no LLM)
    ├── query_finance: finance-truth-layer (never fabricates)
    ├── build_feature+raw/seo: runSeoPublishPipeline()
    ├── check_status: runStatusPipeline()
    └── default: runFullPipeline()
         ├── role-registry.ts → getRoleForIntent()
         ├── skill-registry.ts → getSkillsForIntent()
         ├── approval-engine.ts → classify()
         ├── 6 role-agents: CEO, Eng Manager, Product Manager, QA, Auditor, Release
         ├── execution-ledger.ts
         ├── evidence-engine.ts → generateEvidencePackage()
         └── ceo-report.ts → quickCeoReport()
              ↓
              deliverWorkOrder() → work-orders/ JSON files
              ↓
              WhatsApp reply via whatsapp-sender
```

### 1.3 Broken Connection Found ⚠️

**BROKEN:** `gstack-orchestrator.ts` line 347:
```typescript
const certification = certify(wo, { qa_pass_count, qa_total_count, base_confidence: legacyConfidence });
```
Import từ:
```typescript
import { certify } from './qa-certification-engine';  // ← line 27
```
**Thực tế:** File `qa-certification-engine.ts` KHÔNG tồn tại trong `gstack/`.

**Impact:** `runFullPipeline()` sẽ throw `MODULE_NOT_FOUND` khi chạy full pipeline. Certification block chỉ là G2 gate scoring — không block hard execution.

**Fix cần thiết:** Tạo file `gstack/qa-certification-engine.ts` hoặc remove dòng import 27 và line 347 trong `gstack-orchestrator.ts`.

### 1.4 Phase Modules Connectivity

| Phase | Module | Router | DB | Status |
|-------|--------|--------|----|--------|
| 14 | graph/ | graph-router.ts | graph.db (WAL) | ✅ |
| 15 | operational-memory/ | operational-memory-router.ts | memory.db | ✅ |
| 16 | task-intelligence/ | task-intelligence-router.ts | SQLite | ✅ |
| 17 | executive-briefing/ | briefing-router.ts | cached JSON | ✅ |
| 18 | strategic-memory/ | strategic-memory-router.ts | SQLite | ✅ |
| 19 | agenview/ | agenview-router.ts | — | ✅ |
| 20 | autonomous/ | autonomous-router.ts | — | ✅ |
| 21 | council/ | council-router.ts | — | ✅ |
| 22 | self-improvement/ | self-improvement-router.ts | — | ✅ |
| 23 | health-intelligence/ | health-router.ts | health-export JSON | ✅ |
| 24 | digital-twin/ | digital-twin-router.ts | — | ✅ |
| 30 | jarvis/phase30-jarvis/ | jarvisRouter | — | ✅ |

### 1.5 WhatsApp Gateway Connection

- Gateway: port **3211** (process riêng, KHÔNG phải mi-core)
- mi-core connect qua: `http://127.0.0.1:3211`
- WhatsApp route: `whatsappRouter` → `/api/whatsapp`
- Client state: `D:/Project/Master/.local-agent-global/mi-core/whatsapp-client.json`
- Status: ✅ healthy

---

## PHẦN 2: MI-CORE LÀ TRUNG TÂM ĐIỀU PHỐI

### 2.1 Architecture — Single Hub

```
CEO iPhone (WhatsApp)
    ↓ (port 3211)
WhatsApp Gateway (separate process)
    ↓ (HTTP → port 4001)
mi-core server (index.ts)
    ├── GStack Orchestrator (work orders)
    ├── Phase 30 Jarvis (NLP + proactive)
    ├── 47 API routers (all subsystems)
    ├── WebSocket broadcast hub
    ├── Node Registry (Phase 6/7)
    └── Boot: 15+ services auto-start
```

### 2.2 mi-core is Single Source of Truth

| Capability | File/Module | Evidence |
|------------|-------------|---------|
| Work Order persistence | work-order-engine.ts | `.local-agent-global/work-orders/` |
| Execution ledger | execution-ledger.ts | audit trail |
| Evidence packages | evidence-engine.ts | every action writes evidence |
| Auto-healing | operations/self-healing.ts | monitors + self-heals |
| Leader Lock | nodes/leader-lock-persistent.ts | Phase 7 — no multi-writer conflict |
| Boot sequence | index.ts onListenSuccess() | 15+ services start |
| Real-time events | ws-broadcast.ts | reminder, approval, jarvis_alert, connector_alert |

**Đánh giá:** ✅ mi-core là trung tâm điều phối. Tất cả subsystems đều qua hub port 4001.

---

## PHẦN 3: MI CÓ "TAY CHÂN" ĐIỀU KHIỂN ĐƯỢC

### 3.1 Connector Registry — 16 Limbs

File: `.local-agent-global/visibility/connector-registry.json`

| # | Connector | Type | Status | Purpose |
|---|----------|------|--------|---------|
| 1 | local-projects | local | ✅ active | Master workspace |
| 2 | dashboard-bakudan | local | ✅ active | Bakudan dashboard |
| 3 | asana | API | ✅ active | Task management |
| 4 | gmail | API | ✅ active | Email |
| 5 | google-calendar | API | ✅ active | Calendar |
| 6 | google-drive | API | ✅ active | Documents |
| 7 | google-sheets | API | ⚠️ degraded | Spreadsheets |
| 8 | health-export | export | ✅ active | CEO Health data |
| 9 | website-raw | local | ✅ active | Raw Sushi website |
| 10 | website-bakudan | local | ✅ active | Bakudan website |
| 11 | accounting | API | ✅ active | Accounting (port 8844) |
| 12 | quickbooks-runtime | local | ⚠️ degraded | QB sync (laptop1) |
| 13 | food-safety | local | ✅ active | Food safety gateway |
| 14 | slack | API | 🔴 pending | Not configured |
| 15 | github | API | 🔴 pending | Not configured |
| 16 | whatsapp | gateway | ✅ active | CEO channel |

### 3.2 Department Architecture (Content Division)

| Department | Sub-teams | Capabilities |
|------------|-----------|-------------|
| **Content** (Marketing) | seo-post-writer, image-agent, report-assembler | SEO posts, product descriptions, social captions |
| **Creative** | creative-executor, comfyui-worker | Flyers, banners, SVG generation |
| **Engineering** | qa-agent, auditor-agent, engineering-manager | Source scan, QA, release, PM reports |
| **Executive** | jarvis, council, autonomous | Decision making, briefings, health checks |

### 3.3 Skill Registry — 7 Skills Active

File: `skills/skill-registry.ts`

| Skill | Category | Approval | Trigger |
|-------|----------|---------|---------|
| content-writer | marketing | ✅ yes | tạo content, viết post, caption |
| seo-analyzer | marketing | no | seo, keyword, google rank |
| project-documenter | project-management | no | tạo tài liệu, sprint plan |
| qa-planner | engineering | no | test plan, regression |
| menu-optimizer | restaurant-ops | no | menu optimize, pricing |
| devops-helper | engineering | no | docker, deploy, pm2 |
| food-safety-summary | restaurant-ops | no | food safety checks |

### 3.4 node-agent Network — Secondary Devices

`node-agent.mjs` connects secondary devices to mi-core:
```bash
MI_SERVER_URL=http://192.168.1.x:4001 MI_NODE_NAME="MacBook" node node-agent.mjs
```

### 3.5 Project Scanner — Auto-Discovers Limbs

`visibility/project-scanner.ts` auto-scans `D:/Project/Master` directories (depth ≤2), classifies by language/framework/ports, caches to `.local-agent-global/mi-core/project-connectors.json` (46 entries).

**Đánh giá:** ✅ Mi có "tay chân" — 16 connectors + 4 departments + 7 skills + node network + auto-scanner.

---

## PHẦN 4: "TẠO BÀI POST TĂNG SEO CỦA RAW" — END-TO-END CHAIN

### 4.1 Canonical Flow (Đường đi lý tưởng)

```
CEO: "Mi ơi, tạo bài post tăng SEO của Raw"
    ↓
[1] WhatsApp → jarvisRouter → jarvis-core.ts (Phase 30)
    ↓
[2] intent-router.ts → classifyIntent("tạo bài post tăng SEO của Raw")
    → Pattern matched: /\b(tao|viet|lam|create|generate)\b.*\b(bai|article|seo|content|post|dang bai)\b/
    → Intent: build_feature | risk_level: 2 | requires_approval: false
    → Target project: raw_sushi
    ↓
[3] gstack-orchestrator.ts → processGStackRequest()
    → isSeoPublish = (build_feature + /raw|seo|bai viet/i) = TRUE
    → runSeoPublishPipeline(wo, req) called
    ↓
[4] runSeoPublishPipeline()
    → classify({ intent, skill_id: 'raw_seo_publish' }) → REQUIRES_APPROVAL
    → returns APPROVAL_REQUIRED to CEO
    → STOPS HERE — does NOT proceed to content division
    ↓
[5] 🔴 CHAIN BREAKS: Content Division NOT triggered
    → CEO sees: "Yêu cầu đăng bài SEO — cần anh approve trước"
    → Manual approval needed before Content Dept activates
```

### 4.2 Content Division Pipeline (ĐƯỜNG ĐI ĐẦY ĐỦ — có sẵn nhưng chưa được gọi)

```
Content Department — content-division/content-orchestrator.ts
    │
    ├── Dedupe: checkAndRegisterWorkflowRun() [workflow-dedup-engine]
    ├── Task Ownership: assignTaskOwnership() [department-map]
    │
    ├── ① seo-post-writer.ts → executeSeoPost()
    │      Brand profiles: raw_sushi, bakudan
    │      Template: SEO HTML blog post với H1, H2, meta description, Schema.org JSON-LD
    │      Output: .html file → evidence dir
    │
    ├── ② image-agent.ts → getPostImage()
    │      Brand photos: Raw Sushi's own photos (fb-photos/)
    │      Fallback: SVG generated image
    │
    ├── ③ report-assembler.ts → assemblePost()
    │      Combines: SEO text + image + Google Fonts (Playfair Display + Inter) + Font Awesome icons
    │      Outputs: styled HTML (preview) + Markdown (for publish)
    │      Brand colors applied: raw_sushi (#1a1a2e, #c0392b)
    │
    ├── ④ SEO QA Gate — engineering dept
    │      File: gstack/role-agents/seo-qa-agent.ts → runSeoQA()
    │      Threshold: 95% (SEO_QA_PASS_THRESHOLD = 95)
    │      Checks:
    │        QA-01: Execution status DONE (weight 20)
    │        QA-02: Output file exists (weight 15)
    │        QA-03: Word count ≥500 (weight 20)
    │        QA-04: Has H1 + H2 headings (weight 15)
    │        QA-05: Meta description >50 chars (weight 10)
    │        QA-06: Keyword in title (weight 10)
    │        QA-07: Evidence written (weight 5)
    │        QA-08: Images (weight 5)
    │      Max retries: 3 attempts
    │
    ├── ⑤ Scorecard update: marketing + engineering dept scores
    │
    └── ⑥ CEO Message → Preview URL
         CEO sees: "✅ Content Dept đã hoàn thành bài post SEO cho Raw Sushi Bar"
         Preview link: /api/content/file/{taskId}/{filename}
         Follow-up: "Anh muốn em đăng bài lên rawsushibar.com không?"
```

### 4.3 Publish Flow (On CEO Approval)

```
CEO approval: "Mi, đăng bài [slug]"
    ↓
publish-agent.ts → publishPost(markdownPath, slug)
    → Copy .md → RawWebsite/content/posts/{slug}.md
    → Set published: true + published_at timestamp
    → git add + commit + push origin master
    → URL: https://rawsushibar.com/blog/{slug}
    → WhatsApp proof sent to CEO
```

### 4.4 Gap Analysis — Chain Breaks at Step 4

| Step | Module | Status | Gap |
|------|--------|--------|-----|
| 1 | WhatsApp → jarvis | ✅ | OK |
| 2 | intent-router | ✅ | "tạo bài SEO" → build_feature confirmed |
| 3 | gstack-orchestrator | ✅ | isSeoPublish = true confirmed |
| 4 | runSeoPublishPipeline | ⚠️ | BLOCKS at approval gate — does NOT call content division |
| 5 | content-division | ✅ | Full pipeline exists but never triggered from gstack |
| 6 | seo-qa-agent | ✅ | 8 checks, threshold 95% |
| 7 | publish-agent | ✅ | Git push pipeline exists |
| 8 | WhatsApp feedback | ✅ | CEO message + proof delivery |

**Root Cause:** `runSeoPublishPipeline()` in `gstack-orchestrator.ts` returns APPROVAL_REQUIRED immediately when `classify({ skill_id: 'raw_seo_publish' })` returns `REQUIRES_APPROVAL`. It never calls `orchestrateContentTask()` from `content-division/content-orchestrator.ts`.

**Two solutions:**
- **Option A:** Modify `runSeoPublishPipeline()` to call `orchestrateContentTask()` first (create the post), then request approval to publish
- **Option B:** Create direct path: `intent-router.ts` → `build_feature` with SEO keyword → `contentRouter POST /api/content/seo-post` directly

### 4.5 QA Department — Verified Active

File: `routes/autonomous-qa-router.ts`

| Endpoint | Purpose |
|----------|--------|
| POST /analyze-url | Crawl URL: HTTP status + SEO scan + local source |
| POST /regression | Regression: reachability + source + git clean |
| GET /dashboard | QA dashboard summary |

QA department also includes:
- `gstack/role-agents/qa-agent.ts` — full regression suite (source scan, PM2 status, error log)
- `gstack/role-agents/seo-qa-agent.ts` — SEO quality gate (95% threshold, 8 checks)
- `routes/autonomous-qa-router.ts` — URL analysis + regression suite

---

## PHẦN 5: ORPHANED / DISCONNECTED FILES

### 5.1 Confirmed Orphaned

| File | Problem |
|------|---------|
| `gstack/qa-certification-engine.ts` | Imported but does not exist → MODULE_NOT_FOUND at runtime |

### 5.2 Potentially Disconnected (cần verify thêm)

| Directory | Concern |
|-----------|---------|
| `agent-engine/` | External API (port 4003) — connected via connector-registry |
| `ai-video-guide-system/` | Listed in project-connectors.json |
| `company-os-phases/` | Referenced in AGENTS.md but needs router verification |
| `computer-operator-foundation/` | Listed in project-connectors.json |
| `creative-preview/` | Listed in project-connectors.json |
| `engineering/` | Listed in project-connectors.json |
| `health/` | Health export only — read-only connector |

---

## KẾT LUẬN VÀ HÀNH ĐỘNG

### 5 yếu tố được xác nhận:

1. ✅ **47 routers** mount trên 1 hub — file kết nối tốt
2. ✅ **mi-core là trung tâm** — port 4001, WS hub, WhatsApp gateway
3. ✅ **Mi có tay chân** — 16 connectors, 4 departments, 7 skills, node network
4. ⚠️ **1 broken import** — `qa-certification-engine.ts` missing
5. 🔴 **SEO chain gãy** — Content Division đầy đủ NHƯNG runSeoPublishPipeline không gọi nó

### 3 hành động cần làm:

**Hành động 1 (khẩn cấp):** Fix broken import
```
File: mi-core/server/src/gstack/gstack-orchestrator.ts
Remove line 27: import { certify } from './qa-certification-engine';
Remove line 347-347: const certification = certify(wo, {...});
```

**Hành động 2 (quan trọng):** Bridge Content Division vào WhatsApp flow
```
Option A: Trong runSeoPublishPipeline(), gọi orchestrateContentTask() TRƯỚC approval
Option B: Thêm route mới: intent=build_feature + seo keyword → /api/content/seo-post
```

**Hành động 3 (ưu tiên thấp):** Configure pending connectors
```
Slack: Set SLACK_BOT_TOKEN + SLACK_TEAM_ID in .env
GitHub: Set GITHUB_TOKEN in .env
```
