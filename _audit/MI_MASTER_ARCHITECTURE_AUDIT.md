# MI COMPANY OS — MASTER PATH AUDIT
## Phase 1: Architecture Audit Report

**Captured:** 2026-07-06 10:00 +07:00  
**Machine:** LIEMDO-PC  
**User:** liemdo  
**Git branch:** n8n-workflow-fabric-fix (dirty — 400+ files staged/modified/untracked)  
**Baseline:** `_audit/MI_MASTER_BASELINE_20260706_0948/`

---

## 1. CRITICAL FINDING — RUNTIME STATUS

```
⚠️  P0 BLOCKER: Mi-Core services are DOWN

Listening ports at time of audit:
  TCP 127.0.0.1:11434  (Ollama)          ✅ LISTENING (pid 20764)
  TCP 127.0.0.1:4001  (Mi-Core)          ❌ NOT LISTENING
  TCP 127.0.0.1:3211  (WhatsApp Gateway) ❌ NOT LISTENING

PM2 processes:  Only pm2-logrotate module running
Windows services: Tailscale (Running)

CONCLUSION: The entire mandatory CEO→Mi workflow cannot be tested or demonstrated
because the core server (4001) and WhatsApp gateway (3211) are not running.
This is the FIRST issue that must be resolved before any Phase 3+ work proceeds.
```

---

## 2. CURRENT ARCHITECTURE (as-built)

### 2.1 Process Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│  CEO iPhone / Web UI                                                  │
│      ↓ WhatsApp (port 3211) OR web (mi-chat.html → POST /api/chat)  │
└────────────┬──────────────────────────────────────────────────────────┘
             │  ← TARGET: port 4001 NOT LISTENING (DOWN)
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  WhatsApp AI Gateway  (3211)  — STATUS: DOWN                        │
│    services/whatsapp-ai-gateway/                                     │
│    WhatsApp auth session: data/whatsapp/auth-state.json (tracked)    │
└────────────┬──────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Mi-Core Server  (4001)  — STATUS: DOWN                             │
│    mi-core/server/src/                                              │
│    Tech: Node.js 18+ / TypeScript (CommonJS) / Express 4 / WebSocket│
│    DB: better-sqlite3 (WAL mode) — graph.db, memory.db, knowledge.db│
│    Runtime PM2 cwd: E:/Project/Master                                │
└────────────┬──────────────────────────────────────────────────────────┘
             │
    ┌────────┴────────────────────────────────────────┐
    ▼                                                 ▼
┌──────────────────┐                    ┌──────────────────────┐
│  Ollama (11434)  │                    │  External Services   │
│  qwen3:8b,14b    │                    │  Google Sheets, QB,   │
│  nomic-embed-text│                    │  Asana, Tailscale...  │
│  STATUS: ✅ UP   │                    └──────────────────────┘
└──────────────────┘
```

### 2.2 Server Source Structure (mi-core/server/src/)

```
mi-core/server/src/
├── index.ts                        ← main server; mounts ALL routers
│
├── gstack/                         ← Intent & execution layer
│   ├── intent-router.ts            ← NLP → intent category (Vietnamese fuzzy)
│   ├── gstack-orchestrator.ts     ← work order creation
│   ├── approval-engine.ts
│   ├── qa-certification-engine.ts
│   ├── execution-ledger.ts
│   ├── evidence-engine.ts
│   ├── autofix-boundary.ts
│   ├── ceo-report.ts
│   ├── role-agents/
│   │   ├── game-qa-agent.ts        ← Game QA (weighted scoring, 95% threshold)
│   │   ├── image-qa-agent.ts
│   │   └── seo-qa-agent.ts
│   ├── connectors/                 ← 16 connector implementations
│   ├── role-registry.ts
│   ├── skills/                     ← skill definitions
│   ├── pm-agent/                   ← PM2 monitoring agent
│   ├── evidence/
│   ├── task-intelligence/
│   └── work-order-engine.ts
│
├── game-division/                  ← GAME DEPARTMENT (EXISTS)
│   ├── game-orchestrator.ts        ← orchestrateGameTask() pipeline
│   └── game-worker.ts             ← executeGame() — LLM generates HTML5 game
│
├── company-os/                      ← COMPANY OS DEPARTMENTS (EXISTS)
│   ├── departments.ts             ← 20 departments with qa_model, autonomy
│   ├── dispatch-center.ts          ← dispatch() → classifyIntent → dept assignment
│   ├── department-runtime.ts
│   ├── dept-executors.ts
│   ├── qa-department.ts           ← QA department implementation
│   ├── qa-gate.ts
│   ├── report-center.ts
│   ├── reporting-department.ts
│   ├── evidence-store.ts
│   ├── project-registry.ts
│   ├── tool-registry.ts
│   ├── service-registry.ts
│   ├── source-inventory.ts
│   ├── data-source-registry.ts
│   ├── brain-registry.ts
│   ├── accounting-department.ts
│   ├── engineering-department.ts
│   ├── executive-assistant-department.ts
│   ├── library-department.ts
│   ├── money-operations.ts
│   ├── company-os-router.ts
│   └── self-healing-monitor.ts
│
├── routes/                         ← HTTP API endpoints
│   ├── chat.ts                    ← POST /api/chat (NO AUTH middleware here)
│   ├── game-router.ts             ← POST /api/game/create, /publish, /file/*
│   ├── mi-fabric-router.ts
│   ├── creative-router.ts
│   ├── content-router.ts
│   ├── mi-chat-sse.ts
│   ├── mi-chat-cross-device.ts
│   ├── qb-mirror-router.ts
│   └── reviews.ts
│
├── execution/                      ← Action intent classification + multi-intent
│   ├── action-intent-engine.ts
│   ├── multi-intent-engine.ts
│   ├── multi-intent-executor.ts
│   └── ...
│
├── approval/                       ← Gate-based approval engine
│   └── gate.ts
│
├── chat/                           ← Queue, metrics, conversation store (SQLite)
│
├── jarvis/                         ← Proactive monitoring, briefing scheduler
│   └── phase30-jarvis/jarvis-core.ts
│
├── memory/                         ← Executive + operational memory
├── operational-memory/
├── knowledge/
├── graph/                          ← Phase 14 ownership graph
├── knowledge/
├── visibility/                     ← Connector health monitoring
├── production-loop/                ← Connector heartbeat + freshness
├── self-improving-memory/
├── cross-agent-intelligence/
├── executive-daily-brief/
├── creative-division/
├── content-division/
├── browser/
├── engineering/
├── business-knowledge-graph/
├── financial-intelligence/
├── strategic-memory/
├── quickbooks/
├── seo/
├── brain/
├── providers/                      ← Model/AI provider router
├── services/                       ← QA, QB, WhatsApp agents
├── n8n/
├── ws-broadcast.ts
└── [100+ more modules]
```

### 2.3 Current Game Workflow (as-built)

```
CEO command (WhatsApp or Chat)
    ↓
intent-router.ts → classifyIntent() → detects "game" intent
    ↓
gstack-orchestrator.ts → processGStackRequest() → routes to Game Department
    ↓
game-orchestrator.ts → orchestrateGameTask()
    ├── detectGameType()  (flappy_bird / snake / memory_match / pong / default)
    ├── isDuplicate()     (fingerprint deduplication)
    ├── executeGame()     → game-worker.ts → LLM generates HTML5 game
    │                        → saves to .local-agent-global/game/evidence/<taskId>/
    ├── runGameQA()       → game-qa-agent.ts
    │   ├── GQA-01: Execution status DONE  (weight: 20)
    │   ├── GQA-02: Game file exists       (weight: 20)
    │   ├── GQA-03: File size > 5KB        (weight: 15)
    │   ├── GQA-04: Has HTML5 Canvas       (weight: 15)
    │   ├── GQA-05: Has RAF game loop      (weight: 15)
    │   ├── GQA-06: Touch support           (weight: 10)
    │   └── GQA-07: Generation time <30s    (weight: 5)
    │   → Score = weighted sum; threshold = 95%
    │   → If blocking issues: FAIL regardless of score
    │
    ├── IF PASS:  game_url = /api/game/file/<taskId>/<filename>
    │             → chat route extracts [GAME:...] from history
    │             → delivers via chat reply
    └── IF FAIL:  returns {status:'FAIL', error: qa.recommendation}
                    ❌ NO REPAIR LOOP — THIS IS THE KEY GAP
                    ❌ NO VERSIONING (v1/v2/v3)
                    ❌ NO ESCALATION
```

### 2.4 Current Department Dispatch (as-built)

```
dispatch-center.ts: dispatch(ctx: DispatchContext): DispatchResult
    → context_resolution
    → intent_classification (via classifyIntent)
    → BLOCKED-command check (hardcoded dangerous patterns)
    → dept_assignment (via findDeptForIntent)  → 20 departments
    → task_decomposition
    → execution_planning
```

---

## 3. IDENTIFIED GAPS (vs. Prompt Requirements)

| # | Gap | Severity | Prompt Requirement | Existing Code | Action |
| 1 | **No repair loop** | P0 | QA FAIL must return structured report to Dept, dept fixes, QA re-tests until ≥95% | `game-orchestrator.ts` returns FAIL with error string, no rebuild | Implement repair-loop in orchestrator |
| 2 | **No versioned builds** | P0 | Jobs must have v1/v2/v3 build directories | Single flat `evidence/<taskId>/` | Add builds/v1, v2 subdirs |
| 3 | **QA not independent** | P0 | QA Department must be separate from Game Dept; Game cannot self-score | `runGameQA()` called inline in `orchestrateGameTask()` | Refactor: QA is a separate department service call |
| 4 | **No job state machine** | P0 | 18 required job states (RECEIVED→DELIVERED) | No job state table or tracking | Create `job-state.json` + state transitions |
| 5 | **No specification step** | P1 | "Mi must create a lightweight specification before building" | No spec generation in game pipeline | Add spec-kit style spec creation |
| 6 | **No structured artifact contract** | P1 | Backend must produce `{type, job_id, artifact_type, preview_url, ...}` | Returns `game_url` string + manual chat extraction | Implement ArtifactContract object |
| 7 | **No ChatMi artifact card** | P1 | UI must render Play Game / View Report buttons | Chat returns `[GAME:/api/game/file/...]` text only | Implement artifact card in chat response |
| 8 | **No department routing events** | P1 | Routing must emit `department.job.created` events | Not implemented in game flow | Add event emission to department router |
| 9 | **No escalation/loop protection** | P1 | Max 5 cycles, cycle-3 warning, CEO decision after cycle-5 | None | Add cycle counter + escalation logic |
| 10 | **No Report Department** | P1 | QA pass → Report Dept produces FINAL_REPORT.json/md/QA_SUMMARY.json | No report generation in game pipeline | Implement Report Department integration |
| 11 | **Missing auth fix details** | P2 | "Unauthorized — login with PIN" error resolution | Error string NOT found in mi-core source (likely from old dist or UI) | Audit compiled dist + UI auth layer |
| 12 | **No idempotency** | P2 | Deduplicate CEO messages, button presses | Only game-level fingerprint in orchestrator | Add job-lock + idempotency-key to chat router |
| 13 | **No mobile auth persistence** | P2 | CEO must login once, use from mobile without re-auth | Unknown auth mechanism in web UI | Investigate mobile.html / mi-chat.html auth |
| 14 | **Intent not routed to game-department** | P2 | "Flappy Bird" → Game Dept, not generic GStack | Game called via `processGStackRequest` direct | Verify game intent routes to game department |
| 15 | **No job timeline endpoint/panel** | P2 | Observability: job ID, state, score, events | No job tracking UI | Add job timeline API + AgenView panel |

---

## 4. EXISTING COMPONENTS TO PRESERVE (DO NOT REBUILD)

The following are **already implemented and working** — do not rewrite:

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Intent Router (Vietnamese fuzzy) | `gstack/intent-router.ts` | Working | 96%+ accuracy, NFD normalization |
| Department definitions | `company-os/departments.ts` | Working | 20 departments with qa_model, autonomy flags |
| Department dispatcher | `company-os/dispatch-center.ts` | Working | dispatch() pipeline, findDeptForIntent() |
| QA Agent (game) | `gstack/role-agents/game-qa-agent.ts` | Working | 7 weighted checks, 95% threshold, blocking logic |
| Game Worker | `game-division/game-worker.ts` | Working | LLM generates HTML5, canvas/game-loop/touch detection |
| Game Orchestrator | `game-division/game-orchestrator.ts` | Working (partial) | Build pipeline, type detection, deduplication |
| Approval Gate | `approval/gate.ts` | Working | Dangerous command blocking with rollback plan |
| Conversation Store | `chat/conversation-store.ts` | Working | SQLite-backed, survives restart |
| Chat Queue | `chat/chat-queue.ts` | Working | Rate limiting, timeout handling |
| Ollama Provider Router | `providers/` | Working | qwen3:8b/14b, nomic-embed-text |
| WhatsApp Gateway | `services/whatsapp-ai-gateway/` | Needs restart | Not currently running |
| PM2 ecosystem | `ecosystem.config.js` | Needs restart | Not currently running |
| Self-Healing Monitor | `company-os/self-healing-monitor.ts` | Working | Auto-restart on crash |

---

## 5. PROPOSED TARGET STRUCTURE

Based on audit findings, the structure should be organized as follows. **Do not force-match existing code into this tree** — use adapters and staged migration where moves create runtime risk.

```
E:\Project\Master\
│
├── _platform\                          ← core Mi OS platform (EXISTING — preserve)
│   ├── mi-core\                        ← main repo root (CLAUDE.md lives here)
│   │   ├── server/src/                 ← TypeScript source (WORKING)
│   │   ├── ecosystem.config.js
│   │   ├── ui/                         ← static HTML dashboards
│   │   ├── tests/                      ← acceptance tests
│   │   ├── services/                   ← QA agent, QB ops, WhatsApp
│   │   ├── client/                     ← cross-device chat component
│   │   └── reports/
│   │
│   └── [SHOULD BE KEPT IN mi-core]:
│       ├── gstack/                     ← GStack + intent router ✅
│       ├── company-os/                 ← departments + dispatch ✅
│       ├── game-division/              ← game dept ✅ (needs repair loop)
│       ├── approval/                   ← gate ✅
│       ├── chat/                       ← queue + store ✅
│       ├── routes/                     ← HTTP routers ✅
│       ├── execution/                  ← action/multi-intent ✅
│       ├── jarvis/                    
