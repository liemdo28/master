# Phase 21 — Executive Intelligence Layer: Implementation Todo List

> Blueprint: `C:\Users\liemdo\Downloads\deep-research-report.md`
> Gap analysis: 2026-06-22
> Codebase baseline: Express-based server, JSON file memory, code-only skills, Ollama qwen3:8b/14b

---

## Current State Summary

| Component | Status | Location |
|---|---|---|
| Express server | ✅ Working | `server/src/index.ts` |
| Ollama model routing | ✅ Working (qwen3:8b, 14b, 2.5-coder:7b) | `server/src/model-router/ollama-router.ts` |
| Executive Memory (file-based) | ⚠️ Basic — JSON files, keyword search only | `server/src/memory/executive-memory.ts` |
| Skill system (code-only) | ⚠️ Basic — no governance, no SKILL.md | `server/src/skills/skill-registry.ts` |
| Phase 28 Briefing | ⚠️ Basic — template-based, no intent/planner/reflection | `server/src/jarvis/phase28-executive/executive-intelligence.ts` |
| Approval gate | ✅ Working | `server/src/approval/gate.ts` |
| Evidence gate | ✅ Partial | `server/src/jarvis/evidence-gate-runtime.ts` |
| Postgres (bigdata) | ✅ Available | `server/src/bigdata/db-client.ts` |
| Qdrant | ✅ Available | `server/src/memory/qdrant-client.ts` |
| PM2 ecosystem | ✅ Working | `ecosystem.config.cjs` |
| JSON schema enforcement | ❌ Not implemented | — |
| Intent Engine | ❌ Not implemented | — |
| Executive Planner | ❌ Not implemented | — |
| Reflection Engine | ❌ Not implemented | — |
| Decision Engine (structured) | ❌ Not implemented | — |
| Executive Orchestrator | ❌ Not implemented | — |
| Postgres executive tables | ❌ Not implemented | — |
| SKILL.md governance | ❌ Not implemented | — |
| Benchmark harness | ❌ Not implemented | — |
| Tailscale policy | ❌ Not in repo | — |
| Compiled executive wiki | ❌ Not implemented | — |
| Active-memory-before-reply | ❌ Not implemented | — |
| Session routing by ingress | ❌ Not implemented | — |

---

## Week 1: Foundation — Intent, Planner, Schemas, Model Router, Base APIs

- [ ] **1.1 Create executive type definitions**
  - File: `server/src/executive-intelligence/types.ts`
  - Copy types from blueprint: `IntentHypothesis`, `IntentResult`, `PlanTask`, `ExecutivePlan`, `EvidencePacket`, `ReflectionResult`, `ExecutiveBrief`, `DecisionRecord`, `Confidence`
  - Adapt to existing codebase conventions (Express-style, not Fastify)

- [ ] **1.2 Create JSON schemas for structured output**
  - Files: `server/src/executive-intelligence/schemas/intent.schema.json`
  - Files: `server/src/executive-intelligence/schemas/plan.schema.json`
  - Files: `server/src/executive-intelligence/schemas/decision.schema.json`
  - Files: `server/src/executive-intelligence/schemas/reflection.schema.json`
  - Files: `server/src/executive-intelligence/schemas/brief.schema.json`
  - Follow blueprint schemas exactly

- [ ] **1.3 Build structured LLM caller wrapper**
  - File: `server/src/executive-intelligence/structured-llm.ts`
  - Wrap existing `provider-router.ts` to add JSON schema enforcement
  - Use Ollama structured outputs (`format` parameter) for local models
  - Fallback: parse + validate JSON from unstructured responses
  - Support `MI_EXEC_MODEL` env var (default `qwen3:14b`)

- [ ] **1.4 Build Executive Intent Engine**
  - File: `server/src/executive-intelligence/executive-intent-engine.ts`
  - Accepts: `{ objective: string, runId: string }`
  - Calls active memory for recent context before interpreting
  - Uses structured LLM with `intent.schema.json`
  - Returns: `IntentResult` with multiple hypotheses + confidence
  - System prompt: "Infer CEO objective, list alternatives, do not pretend certainty"

- [ ] **1.5 Build Executive Planner**
  - File: `server/src/executive-intelligence/executive-planner.ts`
  - Accepts: `{ objective, intent, runId }`
  - Produces `ExecutivePlan` with tasks, dependencies, success criteria, risk level
  - Each task has: `id`, `title`, `department`, `type` (investigate/read/analyze/execute/qa/report), `dependsOn`, `readOnly`
  - Uses structured LLM with `plan.schema.json`

- [ ] **1.6 Build Model Router for Executive Layer**
  - File: `server/src/executive-intelligence/model-router.ts`
  - Role-based routing:
    - `intent/planner/decision` → `qwen3:14b` (env: `MI_EXEC_MODEL`)
    - `tool-heavy execution` → `qwen3:8b` (env: `MI_EXEC_TOOL_MODEL`)
    - `embeddings` → `qwen3-embedding` or `nomic-embed-text` (env: `MI_EMBED_MODEL`)
    - `premium reasoning` → `qwen3.6:27b` (optional, env: `MI_EXEC_PREMIUM_MODEL`)
  - Extend existing `server/src/model-router/ollama-router.ts` or create thin wrapper

- [ ] **1.7 Create executive health endpoint**
  - File: `server/src/executive-intelligence/executive-routes.ts`
  - `GET /api/executive/health` — returns version, model routes, DB status, queue status
  - Wire into `server/src/index.ts` as new router

- [ ] **1.8 Create objective entrypoint endpoint**
  - `POST /api/executive/objective` — accepts `{ objective, actor, channel }`
  - Returns initial intent analysis (full orchestration comes in Week 3-4)
  - `GET /api/executive/objectives/:id` — returns run status

- [ ] **1.9 Unit tests for intent engine + planner**
  - File: `server/src/executive-intelligence/__tests__/intent-engine.test.ts`
  - File: `server/src/executive-intelligence/__tests__/planner.test.ts`
  - Test with mock LLM responses, validate schema compliance

- [ ] **1.10 Create `ecosystem.phase21.config.cjs`**
  - Add `MI_EXEC_MODEL`, `MI_EXEC_TOOL_MODEL`, `MI_EMBED_MODEL` env vars
  - Add `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` for Postgres
  - Add `REDIS_URL` for queue/cache
  - Add `EVIDENCE_ROOT`, `WIKI_ROOT` paths
  - Keep existing `ecosystem.config.cjs` unchanged

---

## Week 2: Memory Layer + Evidence Store + Postgres Migrations

- [ ] **2.1 Design Postgres schema for executive tables**
  - File: `server/src/executive-intelligence/db/migrations/001_executive_tables.sql`
  - Tables:
    - `objective_runs` (id, objective_text, channel, status, owner, started_at, ended_at, final_confidence)
    - `intent_hypotheses` (objective_run_id, intent, confidence, rationale, missing_info)
    - `plans` (objective_run_id, version, tasks_json, dependencies_json, risk_level)
    - `reasoning_frames` (objective_run_id, frame_type, hypotheses_json, signals_json)
    - `decision_records` (objective_run_id, priority, impact_scores_json, recommended_actions_json)
    - `evidence_packets` (id, objective_run_id, source_type, source_ref, sha256, captured_at, read_only, artifact_path)
    - `qa_gates` (objective_run_id, gate_name, status, details_json, checked_at)
    - `executive_briefs` (objective_run_id, brief_markdown, brief_json, confidence, sent_to_ceo)
    - `memory_items` (id, namespace, kind, title, body, embedding vector(384), tags, freshness_date, source_refs_json)
    - `memory_claims` (memory_item_id, claim_text, evidence_refs_json, confidence, contradiction_refs_json)
    - `skill_manifests` (name, version, scope, approved, capabilities_json, hash)
    - `skill_runs` (skill_name, objective_run_id, status, inputs_json, outputs_json, evidence_refs_json)
  - Enable pgvector extension

- [ ] **2.2 Create migration runner**
  - File: `server/src/executive-intelligence/db/migrate.ts`
  - Run SQL migrations against Postgres
  - Track migration versions in `schema_migrations` table

- [ ] **2.3 Build Executive Memory (Postgres-backed)**
  - File: `server/src/executive-intelligence/executive-memory.ts`
  - Replace file-based memory with Postgres queries
  - Implement:
    - `createObjectiveRun(input)` → INSERT into `objective_runs`
    - `storeIntent(runId, intent)` → INSERT hypotheses
    - `storePlan(runId, plan)` → INSERT plan
    - `getRecentExecutiveContext(objective)` → SELECT recent briefs + claims
    - `finalizeRun(runId, payload)` → UPDATE run status + INSERT brief
    - `upsertMemoryItem(item)` → INSERT/UPDATE with embedding
    - `searchMemory(query, embedding)` → Hybrid search (keyword + vector)
    - `storeClaim(claim)` → INSERT claim with evidence refs
    - `getContradictions(claimText)` → Find conflicting claims
  - Keep old `executive-memory.ts` as legacy fallback (don't delete)

- [ ] **2.4 Build Evidence Store**
  - File: `server/src/executive-intelligence/evidence-store.ts`
  - Immutable file storage at `EVIDENCE_ROOT` (default: `data/evidence/`)
  - Path convention: `{EVIDENCE_ROOT}/{runId}/{sha256}.{ext}`
  - Methods:
    - `persistEvidence(runId, packet)` → compute SHA256, write file, INSERT metadata
    - `getEvidence(evidenceId)` → read metadata + file
    - `listEvidence(runId)` → all evidence for a run
    - `verifyIntegrity(evidenceId)` → recompute SHA256, compare
  - All writes are append-only (no overwrite)

- [ ] **2.5 Build Compiled Executive Wiki**
  - File: `server/src/executive-intelligence/executive-wiki.ts`
  - Directory: `data/wiki/`
  - Store curated facts as markdown + JSON:
    - Domain pages: `services.md`, `projects.md`, `finance.md`, `incidents.md`, `ceo-priorities.md`
    - Each page has: title, claims, evidence refs, contradictions, open questions, last updated
  - Methods:
    - `upsertPage(domain, page)` → write markdown + JSON
    - `getPage(domain)` → read + parse
    - `searchClaims(query)` → keyword search across all pages
    - `getStaleClaims(maxAge)` → find claims needing refresh

- [ ] **2.6 Wire Active Memory before Intent**
  - Modify `executive-intent-engine.ts` to call `executiveMemory.getRecentExecutiveContext()` BEFORE LLM call
  - Inject: recent incidents, recurring failures, priorities, previous briefs, unresolved risks
  - Pattern from OpenClaw: "active memory blocking sub-agent"

- [ ] **2.7 Create `data/evidence/` and `data/wiki/` directories**
  - Add `.gitkeep` files
  - Update `.gitignore` to exclude evidence artifacts

- [ ] **2.8 Unit tests for memory + evidence**
  - Test Postgres CRUD operations (use test DB or mock)
  - Test evidence SHA256 integrity
  - Test wiki page CRUD
  - Test vector search recall

---

## Week 3: Decision, Reflection, Brief Generator

- [ ] **3.1 Build Business Reasoning Engine**
  - File: `server/src/executive-intelligence/business-reasoning-engine.ts`
  - Accepts: `{ objective, intent, plan, runId }`
  - Produces: reasoning frames with hypotheses, signals, evidence summaries
  - Pulls from: evidence store, memory, connectors (finance, ops)
  - Uses structured LLM with reasoning system prompt
  - Stores reasoning frames in `reasoning_frames` table

- [ ] **3.2 Build Executive Decision Engine**
  - File: `server/src/executive-intelligence/executive-decision-engine.ts`
  - Accepts: `{ objective, intent, reasoning, runId }`
  - Produces: prioritized actions with impact scores
  - Uses structured LLM with `decision.schema.json`
  - Stores decisions in `decision_records` table
  - Considers: risk level, evidence confidence, CEO priorities from memory

- [ ] **3.3 Build Executive Reflection Engine**
  - File: `server/src/executive-intelligence/executive-reflection.ts`
  - Accepts: `{ runId, objective, intent, plan, decision, qa, evidence }`
  - Produces: `ReflectionResult` with:
    - `confidence` score
    - `assumptions` — what we assumed without evidence
    - `alternativeExplanations` — other ways to interpret data
    - `missingEvidence` — what we wish we had
    - `contradictions` — conflicting signals found
  - Uses structured LLM with `reflection.schema.json`
  - Self-critique: "What could make this answer wrong?"

- [ ] **3.4 Build Executive Brief Generator**
  - File: `server/src/executive-intelligence/executive-brief.ts`
  - Accepts: `{ runId, objective, intent, decision, qa, reflection, evidence }`
  - Produces: `ExecutiveBrief` following schema:
    - `headline` — one-line summary
    - `whatChanged` — bullet list of changes
    - `whyItMatters` — business impact
    - `risks` — identified risks
    - `recommendedActions` — prioritized actions with owner/due
    - `confidence` — overall confidence
    - `evidenceRefs` — links to evidence packets
  - Uses structured LLM with `brief.schema.json`
  - Format for WhatsApp (short) and Dashboard (detailed)
  - Store in `executive_briefs` table + `data/wiki/` as compiled page

- [ ] **3.5 Enhance QA Gates (6 hard gates)**
  - File: `server/src/executive-intelligence/qa-gates.ts`
  - Implement all 6 gates as hard gates:
    1. `schema_valid` — all JSON outputs parse against schemas
    2. `evidence_freshness` — evidence timestamps within SLA
    3. `traceability` — every conclusion maps to evidence
    4. `policy_safety` — read-only / approval rules enforced
    5. `contradiction_check` — evidence contradictions surfaced
    6. `executive_quality` — brief has actions, not raw logs
  - Each gate returns pass/fail + details; any fail blocks brief delivery
  - Integrate with existing `server/src/jarvis/evidence-gate-runtime.ts`

- [ ] **3.6 Wire full orchestrator loop**
  - File: `server/src/executive-intelligence/executive-orchestrator.ts`
  - Pipeline: `createRun → intent → plan → reason → decide → dispatch → evidence → qa → reflect → brief → finalize`
  - All steps stored in Postgres via executive memory
  - Error handling: if any step fails, store error state + partial evidence, still generate brief with lower confidence

- [ ] **3.7 Wire orchestrator to `/api/executive/objective` endpoint**
  - Update `executive-routes.ts` to call `ExecutiveOrchestrator.handleObjective()`
  - Add `GET /api/executive/objectives/:id` for run status retrieval
  - Add `POST /api/executive/memory/upsert` and `POST /api/executive/memory/search`

- [ ] **3.8 Update intent engine to use full memory context**
  - Ensure active memory pulls from: `memory_items`, `memory_claims`, recent `objective_runs`, `executive_briefs`
  - Inject unresolved contradictions and open questions into intent analysis

- [ ] **3.9 Unit tests for decision, reflection, brief**
  - Test each engine independently with mock LLM
  - Test orchestrator integration with mock dependencies
  - Verify QA gates catch common failures

---

## Week 4: Skill System + Policy + OpenClaw Extraction

- [ ] **4.1 Create SKILL.md format and directory structure**
  - Directory: `server/src/executive-intelligence/skills/`
  - Subdirectories per skill: `executive-audit/`, `business-triage/`, `incident-review/`, `dashboard-audit/`, `connectivity-review/`
  - Each contains: `SKILL.md` (markdown + YAML frontmatter) + `skill.manifest.json`

- [ ] **4.2 Create initial SKILL.md files**
  - `executive-audit/SKILL.md` — read-only audit of runtime, services, incidents (from blueprint)
  - `business-triage/SKILL.md` — triage finance connectivity issues
  - `incident-review/SKILL.md` — review and classify incidents
  - `dashboard-audit/SKILL.md` — audit dashboard routes and health
  - `connectivity-review/SKILL.md` — review QuickBooks/Toast/DoorDash connectivity

- [ ] **4.3 Build Skill Registry (governed)**
  - File: `server/src/executive-intelligence/skill-registry.ts`
  - Load skills from `skills/` directory
  - Validate: SKILL.md exists, manifest is valid JSON, hash matches, `approved: true`
  - Methods:
    - `listApprovedSkills()` → return only approved + validated skills
    - `loadSkill(name)` → load + validate + inject into prompt
    - `validateSkill(name)` → verify hash, policy, approval
    - `executeSkill(name, context)` → run skill with policy enforcement
  - Keep old `server/src/skills/skill-registry.ts` as legacy (don't break existing skills)

- [ ] **4.4 Build Skill Policy Engine**
  - File: `server/src/executive-intelligence/skill-policy.ts`
  - Enforce per-skill:
    - `mode: read-only` or `controlled-write`
    - `allowed_connectors` list
    - `denied_actions` list
    - `approval_required_for_write` flag
  - Block any skill action that violates policy
  - Log all skill executions to `skill_runs` table

- [ ] **4.5 Wire skills into execution dispatch**
  - Modify orchestrator to look up applicable skill before executing tasks
  - If task type matches a skill capability, load and use skill instructions
  - Skills inject system-prompt context, not arbitrary code execution

- [ ] **4.6 Session routing by ingress surface**
  - Add session namespace logic:
    - `whatsapp:ceo` — CEO WhatsApp DM
    - `dashboard:executive` — Dashboard API
    - `cron:morning-brief` — Scheduled daily brief
    - `webhook:qbo` — QuickBooks Online webhook
    - `incident:<service>` — Incident-triggered
  - Store session namespace in `objective_runs.channel`
  - Different context window sizes per namespace

- [ ] **4.7 Unit tests for skill system**
  - Test skill loading, validation, policy enforcement
  - Test that unapproved skills are rejected
  - Test policy blocks write actions without approval

---

## Week 5: Connectors + Benchmark Harness + Scenario Suite

- [ ] **5.1 Build FinanceReadAdapter interface**
  - File: `server/src/executive-intelligence/connectors/finance-read-adapter.ts`
  - Interface:
    - `getBalanceReport()` → standardized balance data
    - `getProfitLoss()` → standardized P&L
    - `getRecentTransactions()` → last N transactions
    - `getHealthStatus()` → connector health + freshness

- [ ] **5.2 Build QBO Adapter**
  - File: `server/src/executive-intelligence/connectors/quickbooks/qbo-adapter.ts`
  - OAuth 2.0 flow, REST API, sandbox support
  - Implement FinanceReadAdapter for QBO
  - Reports API integration

- [ ] **5.3 Build QBD Bridge Adapter**
  - File: `server/src/executive-intelligence/connectors/quickbooks/qbd-bridge-adapter.ts`
  - Desktop SDK/QBXML integration via existing bridge
  - Web Connector communication pattern
  - Implement FinanceReadAdapter for QBD

- [ ] **5.4 Build Toast Read Adapter**
  - File: `server/src/executive-intelligence/connectors/toast/toast-read-adapter.ts`
  - Read-only: sales data, labor costs, menu performance
  - Health check integration

- [ ] **5.5 Build DoorDash Read Adapter**
  - File: `server/src/executive-intelligence/connectors/doordash/doordash-read-adapter.ts`
  - Read-only: order data, ratings, delivery metrics
  - Health check integration

- [ ] **5.6 Create benchmark scenario suite**
  - File: `server/src/executive-intelligence/benchmarks/phase21-scenarios.json`
  - All 50 scenarios from blueprint (S01-S50)
  - Categories: Operations (10), Finance (10), Engineering (10), Infrastructure (10), Strategy (5), Executive (5)
  - Each has: id, category, prompt, evidence_surface, pass_condition

- [ ] **5.7 Build benchmark runner**
  - File: `server/src/executive-intelligence/benchmarks/run-phase21-benchmark.mjs`
  - CLI-runnable: `node run-phase21-benchmark.mjs`
  - Calls `/api/executive/objective` for each scenario
  - Measures: latency, QA pass, confidence, brief headline
  - Outputs: `phase21-results.json` + console summary

- [ ] **5.8 Build benchmark scorer**
  - File: `server/src/executive-intelligence/benchmarks/score-phase21.mjs`
  - Reads `phase21-results.json`
  - Scores on 5 traxes: intent, planning, evidence, reflection, executive usefulness
  - Compares against acceptance thresholds (PARTIAL vs OPERATIONAL)
  - Outputs: Markdown report with pass/fail per metric

- [ ] **5.9 Wire connectors into orchestrator**
  - Modify orchestrator to use adapters for finance data
  - Evidence packets from connector reads get stored in evidence store
  - Connector health feeds into intent analysis context

- [ ] **5.10 Run initial benchmark**
  - Execute 50 scenarios against local Mi
  - Document baseline scores
  - Identify top 10 failure cases for remediation

---

## Week 6: PM2 Deploy, Monitoring, Rollback Rehearsal, Final CEO Test

- [ ] **6.1 Update PM2 ecosystem config for Phase 21**
  - File: `ecosystem.phase21.config.cjs` (from blueprint)
  - Add `mi-executive-jobs` process for background workers
  - Configure env vars for Postgres, Redis, Ollama, evidence paths
  - Verify `pm2 startup` + `pm2 save` workflow

- [ ] **6.2 Set up Postgres database**
  - `createdb mi_exec`
  - `psql mi_exec -c "CREATE EXTENSION IF NOT EXISTS vector;"`
  - Run migrations: `node dist/db/migrate.js`
  - Seed approved skill manifests

- [ ] **6.3 Pull Ollama models**
  - `ollama pull qwen3:8b` (verify existing)
  - `ollama pull qwen3:14b` (verify existing)
  - `ollama pull qwen3-embedding` (new for executive memory)
  - Optional: `ollama pull qwen3.6:27b` (premium route)

- [ ] **6.4 Build monitoring dashboard additions**
  - `GET /api/executive/health` — comprehensive health check
  - `GET /api/executive/metrics` — executive-specific counters:
    - intent ambiguity rate
    - evidence completeness
    - QA pass rate
    - contradiction rate
    - human intervention count
    - brief acceptance rate
    - actions escalated count
  - Technical metrics: request count, p50/p95 latency, Ollama token/latency, memory hit rate, queue depth

- [ ] **6.5 Set up Tailscale policy**
  - Create HuJSON policy file (from blueprint)
  - Tag devices: `tag:mi-core`, `tag:exec-db`, `tag:qb-bridge`, `tag:ops-runner`
  - Grants: mi-core → exec-db (5432, 6379), mi-core → qb-bridge (3211, 4001), ops → mi-core (4001)
  - Verify all executive endpoints are tailnet-only

- [ ] **6.6 Implement rollback plan**
  - 3-layer rollback:
    1. App: `pm2 restart` with previous tag, lock model route
    2. Data: Postgres dump/restore, keep evidence files
    3. Skills: disable manifest approval flag
  - Create rollback script: `scripts/phase21-rollback.sh`
  - Test rollback rehearsal

- [ ] **6.7 Run full benchmark suite**
  - Execute all 50 scenarios
  - Score against OPERATIONAL thresholds:
    - Intent correctness ≥ 88%
    - Planning quality ≥ 85%
    - Evidence completeness ≥ 92%
    - Reflection quality ≥ 85%
    - Executive usefulness ≥ 90%
    - Human interventions: 0 on final CEO tests
    - p95 latency ≤ 12s

- [ ] **6.8 Final CEO test on WhatsApp**
  - CEO sends ambiguous objectives via WhatsApp
  - Mi processes end-to-end: intent → plan → execute → brief
  - Verify brief quality, confidence, evidence traceability
  - Test at least 5 real scenarios from the 50-scenario suite

- [ ] **6.9 Create final report**
  - File: `server/src/executive-intelligence/reports/PHASE_21_EXECUTIVE_INTELLIGENCE_FINAL_REPORT.md`
  - Document: benchmark scores, failure cases, rollback rehearsal results, CEO test results
  - Acceptance criteria checklist
  - Handoff notes for maintenance

- [ ] **6.10 Update CLAUDE.md and project docs**
  - Add Phase 21 architecture overview
  - Document executive API endpoints
  - Document skill authoring guide (SKILL.md format)
  - Document benchmark running procedure

---

## Post-Phase 21 (Future)

- [ ] Add Qdrant as scale-up vector store (when retrieval outgrows pgvector)
- [ ] Add Redis BullMQ for async job queue (when async execution needed)
- [ ] Add Qwen3.6:27b premium reasoning route
- [ ] Add real-time WebSocket streaming for executive briefs
- [ ] Add multi-region failover for Postgres
- [ ] Add automated daily/weekly/monthly briefing cron via PM2
- [ ] Add executive voice summary (TTS briefing)
- [ ] Add mobile push notifications for critical briefs

---

## Key Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Express (existing) | Don't rewrite to Fastify mid-project |
| Persistence | Postgres + pgvector | Production-grade, already available via bigdata client |
| Memory fallback | Keep JSON file memory as legacy | Don't break existing features |
| Model routing | qwen3:14b for exec, qwen3:8b for tools | Per benchmark data in blueprint |
| Skill system | Hybrid SKILL.md + manifest.json | Governance + readability |
| Evidence storage | Immutable files on disk | Provenance, integrity, no DB bloat |
| Wiki storage | Markdown + JSON on disk | Human-readable, auditable |
| Redis | Queue/cache only | Not source of truth |
| Session routing | Namespace by channel | Context isolation, benchmarkable |

---

## File Tree (New Files Created)

```
server/src/executive-intelligence/
├── types.ts
├── structured-llm.ts
├── model-router.ts
├── executive-intent-engine.ts
├── executive-planner.ts
├── executive-reflection.ts
├── business-reasoning-engine.ts
├── executive-decision-engine.ts
├── executive-brief.ts
├── executive-orchestrator.ts
├── executive-memory.ts          (Postgres-backed, replaces file-based)
├── executive-wiki.ts
├── evidence-store.ts
├── qa-gates.ts
├── skill-registry.ts            (governed version)
├── skill-policy.ts
├── executive-routes.ts          (Express router)
├── schemas/
│   ├── intent.schema.json
│   ├── plan.schema.json
│   ├── decision.schema.json
│   ├── reflection.schema.json
│   └── brief.schema.json
├── db/
│   └── migrations/
│       └── 001_executive_tables.sql
├── connectors/
│   ├── finance-read-adapter.ts
│   ├── quickbooks/
│   │   ├── qbo-adapter.ts
│   │   └── qbd-bridge-adapter.ts
│   ├── toast/
│   │   └── toast-read-adapter.ts
│   └── doordash/
│       └── doordash-read-adapter.ts
├── skills/
│   ├── executive-audit/
│   │   ├── SKILL.md
│   │   └── skill.manifest.json
│   ├── business-triage/
│   │   ├── SKILL.md
│   │   └── skill.manifest.json
│   ├── incident-review/
│   │   ├── SKILL.md
│   │   └── skill.manifest.json
│   ├── dashboard-audit/
│   │   ├── SKILL.md
│   │   └── skill.manifest.json
│   └── connectivity-review/
│       ├── SKILL.md
│       └── skill.manifest.json
├── benchmarks/
│   ├── phase21-scenarios.json
│   ├── run-phase21-benchmark.mjs
│   └── score-phase21.mjs
├── reports/
│   └── PHASE_21_EXECUTIVE_INTELLIGENCE_FINAL_REPORT.md
└── __tests__/
    ├── intent-engine.test.ts
    ├── planner.test.ts
    ├── memory.test.ts
    ├── evidence.test.ts
    └── orchestrator.test.ts

ecosystem.phase21.config.cjs

data/
├── evidence/                    (immutable evidence files)
├── wiki/                        (compiled executive wiki)
└── exports/

scripts/
└── phase21-rollback.sh
```
