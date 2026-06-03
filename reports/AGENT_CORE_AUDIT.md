# Agent Core Audit Report

**Date:** 2026-06-01  
**Scope:** Full scan of `E:\Project\Master`  
**Purpose:** Classify all projects and identify the Agent Core (Brain)

---

## Conclusion: The Agent Brain

> **`agent-coding/`** (monorepo at root, pending move to `Agent/agent-coding/`) is the Agent Core.  
> Specifically, **`agent-coding/apps/agency/`** (Python FastAPI) is the AI brain with full orchestration capabilities.

**Evidence:**
- Multi-provider LLM system (Anthropic primary → OpenAI fallback → Ollama local)
- Full agent architecture: Orchestrator → Router → Task Planner → Department Specialists → Leader Reviewer → Scoring Engine
- Content generation pipeline with editorial validation
- Policy engine for inter-department workflows
- CEO Brain module (`src/ceo/brain.py`) for goal interpretation
- 1330+ passing tests
- Git: `liemdo28/agent-coding.git`

---

## Classification Table

| # | Project / Folder | Classification | Stack | Status | Deploy |
|---|-----------------|----------------|-------|--------|--------|
| 1 | `agent-coding/` | **AGENT_CORE_CANDIDATE** | Node.js + Python | Active | Local |
| 2 | `Agent/agent-coding-api-keys/` | **AGENT_CORE_CANDIDATE** | Node.js | Active | Local proxy |
| 3 | `Bakudan/review-automation-system/` | PRODUCT_APP | Python (Flask) | Active | DreamHost |
| 4 | `Bakudan/bakudanramen.com-current/` | PRODUCT_APP | Static HTML | Active | DreamHost |
| 5 | `Bakudan/dashboard.bakudanramen.com/` | PRODUCT_APP | Web | Active | DreamHost |
| 6 | `Bakudan/growth-dashboard/` | PRODUCT_APP | Web | Active | — |
| 7 | `Bakudan/integration-system/` | PRODUCT_APP | Python | Active | Local |
| 8 | `Bakudan/mobile_taskflow/` | PRODUCT_APP | Mobile | Active | — |
| 9 | `Bakudan/packing-list/` | PRODUCT_APP | Node.js + Python | Active | Telegram |
| 10 | `Other/LinkTreeHL/` | PRODUCT_APP | Next.js | Active | Vercel |
| 11 | `RawSushi/RawWebsite/` | PRODUCT_APP | Static HTML | Active | DreamHost |
| 12 | `Other/phuyen-2026/` | PRODUCT_APP | Python | Active | Render |
| 13 | `QA/qa-system/` | SHARED_SERVICE | — | Active | Local |
| 14 | `QA/Tester-QA/` | SHARED_SERVICE | Python | Active | Local |
| 15 | `QA/qa_runner/` | SHARED_SERVICE | — | Active | Local |
| 16 | `QA/PC-QA-Stability-Certification/` | SHARED_SERVICE | — | Active | Local |
| 17 | `Agent/review-management-mcp/` | SHARED_SERVICE | — | Active | Local |
| 18 | `Agent/shared-workspace/` | SHARED_SERVICE | Node.js | Active | Local |
| 19 | `Agent/ai-search-tool/` | SHARED_SERVICE | — | Active | Local |
| 20 | `_archive/agentai-agency-merged-20260601/` | LEGACY_DUPLICATE | Python | Archived | — |
| 21 | `_archive/Personal-agentai-agency-old/` | LEGACY_DUPLICATE | Python | Archived | — |
| 22 | `_archive/bakudanramen.com-old-20260601/` | LEGACY_DUPLICATE | WordPress | Archived | — |
| 23 | `_archive/BakudanWebsite_Sub2-20260601/` | LEGACY_DUPLICATE | — | Archived | — |
| 24 | `_archive/integration-toasttab-old-20260601/` | LEGACY_DUPLICATE | — | Archived | — |
| 25 | `_archive/Raw-old-20260601/` | LEGACY_DUPLICATE | Static | Archived | — |
| 26 | `agentai-agency/` (root) | LEGACY_DUPLICATE | Python | DEPRECATED | — |
| 27 | `Other/dau-tu/` | OTHER (personal) | — | — | — |
| 28 | `Other/gdrive-tools/` | OTHER (personal) | — | — | — |
| 29 | `Other/It-Takes-Two-Inspired-Game/` | OTHER (personal) | — | — | — |
| 30 | `Other/openclaw/` | OTHER (personal) | — | — | — |
| 31 | `Other/tu-vi/` | OTHER (personal) | — | — | — |
| 32 | `Other/Tuya/` | OTHER (personal) | — | — | — |
| 33 | `Other/VC/` | OTHER (personal) | — | — | — |

---

## Detailed Evidence

### AGENT_CORE_CANDIDATE #1: `agent-coding/`

**Indicators found:**
- `package.json` ✅ (Node.js root)
- `apps/agency/pyproject.toml` ✅ (Python sub-app)
- `src/` ✅
- `apps/` ✅
- `services/` ✅
- `.env.example` ✅
- `README.md` ✅

**Internal Architecture (apps/agency/):**
```
src/
├── agents/
│   ├── router.py          — Routes tasks to departments via LLM
│   ├── task_planner.py    — Generates multi-step plans
│   ├── specialists/       — Department-specific AI specialists
│   ├── leader_reviewer.py — Reviews and scores outputs
│   ├── research.py        — Web research with LLM synthesis
│   └── state.py           — Agentic state management
├── llm/
│   ├── __init__.py        — LLM package entry
│   └── providers.py       — AnthropicProvider, OpenAIProvider, FallbackLLM
├── ceo/
│   └── brain.py           — CEO goal interpretation
├── config/
│   └── settings.py        — All configuration (API keys, models, provider order)
├── scoring/
│   └── score_engine.py    — LLM-based scoring with rubrics
├── db/
│   └── repositories/      — Task, review history persistence
├── policies/              — Inter-department workflow policies
└── api.py                 — FastAPI health/status endpoints
```

**AI Capabilities:**
- Multi-provider LLM with automatic fallback (Anthropic → OpenAI → Ollama)
- Task routing with department classification
- Multi-step plan generation
- Specialist content generation per department
- Leader review with LLM scoring + heuristic fallback
- Research synthesis from web search results
- Content generation with editorial validation

### AGENT_CORE_CANDIDATE #2: `Agent/agent-coding-api-keys/`

**Indicators found:**
- `package.json` ✅
- `.env.example` ✅
- `.env.gateway` ✅
- `keys.env` ✅

**Purpose:** Universal AI provider proxy that:
- Manages API keys for Anthropic, OpenAI
- Provides a local gateway (port 3456) that tools like Claude Code, Cursor, Cline connect to
- Allows switching between providers without reconfiguring each tool
- Supports key rotation and multi-key load balancing

---

## Classification Criteria

| Classification | Criteria |
|---------------|----------|
| AGENT_CORE_CANDIDATE | Contains LLM integration, orchestration logic, multi-agent architecture, or provider gateway |
| PRODUCT_APP | End-user facing application with its own deploy target |
| SHARED_SERVICE | Internal tooling used by multiple projects (QA, MCP, shared infra) |
| LEGACY_DUPLICATE | Archived, deprecated, or superseded by another project |
| OTHER | Personal projects, experiments, not part of business operations |

---

## Active vs Legacy Count

| Category | Count | Notes |
|----------|-------|-------|
| Active Agent Core | 2 | agent-coding + api-keys |
| Active Product Apps | 10 | Revenue-generating or operational |
| Active Shared Services | 7 | QA + Agent utilities |
| Legacy/Archived | 7 | All in `_archive/` or deprecated |
| Personal/Other | 7 | No business impact |
| **Total** | **33** | |
