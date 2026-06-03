# System Dependency Map

**Date:** 2026-06-01  
**Scope:** `E:\Project\Master`  
**Purpose:** Map all inter-project dependencies and shared resources

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     E:\Project\Master                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────┐                    │
│  │         AGENT CORE (Brain)              │                    │
│  │   agent-coding/ (Node.js + Python)      │                    │
│  │     └── apps/agency/ (FastAPI)          │                    │
│  └──────────┬──────────────────────────────┘                    │
│             │                                                   │
│      DEPENDS ON                                                 │
│             │                                                   │
│             ▼                                                   │
│  ┌──────────────────────┐                                       │
│  │ agent-coding-api-keys │  ← Provider Gateway (port 3456)     │
│  │ (Anthropic + OpenAI)  │                                      │
│  └──────────────────────┘                                       │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  INDEPENDENT APPS (share API keys but NO direct API calls)      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                 │
│  ┌────────────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ review-automation   │  │ packing-list │  │ phuyen-2026  │    │
│  │ (OpenAI direct)     │  │ (Anthropic)  │  │ (OpenAI)     │    │
│  └────────────────────┘  └──────────────┘  └──────────────┘    │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  QA LAYER (monitors everything)                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                 │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐                     │
│  │ qa-system│  │ Tester-QA │  │ qa_runner │                     │
│  └──────────┘  └───────────┘  └──────────┘                     │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  STANDALONE APPS (no AI dependency)                             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                 │
│  bakudanramen.com │ dashboard │ LinkTreeHL │ RawWebsite         │
│  integration-system │ growth-dashboard │ mobile_taskflow        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dependency Tree

```
Agent Core (agent-coding/)
├── Provider Gateway (agent-coding-api-keys/)
│   └── External: Anthropic API, OpenAI API, Ollama (local)
├── Shared Workspace (Agent/shared-workspace/)
├── AI Search Tool (Agent/ai-search-tool/)
└── Review Management MCP (Agent/review-management-mcp/)
    └── Links to: Bakudan/review-automation-system/

Product Apps (independent):
├── Bakudan/review-automation-system/
│   └── External: OpenAI API (direct, own key)
├── Bakudan/bakudanramen.com-current/
│   └── External: DreamHost (static deploy)
├── Bakudan/dashboard.bakudanramen.com/
│   └── External: DreamHost
├── Bakudan/integration-system/
│   └── External: ToastTab API, QuickBooks API
├── Bakudan/packing-list/
│   └── External: Anthropic API (direct, own key), Telegram API
├── Other/LinkTreeHL/
│   └── External: Vercel, Prisma DB
├── RawSushi/RawWebsite/
│   └── External: DreamHost (static deploy)
└── Other/phuyen-2026/
    └── External: OpenAI API, Render, Telegram API

QA Layer (monitors all):
├── QA/qa-system/
│   └── Config: projects.json (references all project paths)
├── QA/Tester-QA/
│   └── Tests: provider failures, security audits
├── QA/qa_runner/
└── QA/PC-QA-Stability-Certification/

Infrastructure Scripts:
├── sync-master-to-portable.ps1 → Syncs to F:\Projects
├── git-status-all.ps1 → Checks git status across repos
├── _cleanup_after_restart.bat → Pending folder moves
└── compare-projects.ps1 → Diff between E: and F:
```

---

## Connection Details

| # | From | To | Connection Type | Direction | Strength |
|---|------|----|----------------|-----------|----------|
| 1 | agent-coding | agent-coding-api-keys | API proxy, shared env | DEPENDS ON | Strong |
| 2 | agent-coding | Agent/shared-workspace | Shared Node.js infra | USES | Medium |
| 3 | agent-coding | Agent/ai-search-tool | Search capability | USES | Weak |
| 4 | review-management-mcp | review-automation-system | MCP integration | EXTENDS | Medium |
| 5 | review-automation-system | OpenAI API | Direct API call | EXTERNAL | Strong |
| 6 | packing-list | Anthropic API | Direct API call | EXTERNAL | Medium |
| 7 | QA/qa-system | All projects | Config monitoring | MONITORS | Weak |
| 8 | QA/Tester-QA | All projects | Security/stability testing | TESTS | Weak |
| 9 | sync-master-to-portable.ps1 | All projects | File sync | INFRASTRUCTURE | Weak |
| 10 | integration-system | ToastTab + QuickBooks | Data pipeline | EXTERNAL | Strong |

---

## Shared Resources Analysis

### Shared API Keys

| Key | Used By | Same Key? | Risk |
|-----|---------|-----------|------|
| `ANTHROPIC_API_KEY` | agent-coding/apps/agency, packing-list | YES (same key `sk-ant-api03-xZw...`) | HIGH — key rotation affects multiple apps |
| `OPENAI_API_KEY` | agent-coding/apps/agency, review-automation-system | YES (same key `sk-proj-g9h...`) | HIGH — key rotation affects multiple apps |
| `OPENAI_API_KEY` | phuyen-2026 | DIFFERENT key (`sk-proj-puei...`) | LOW — isolated |

### Shared Git Remote

| Remote | Projects |
|--------|----------|
| `github.com/liemdo28/agent-coding.git` | agent-coding |
| `github.com/liemdo28/review-automation-system.git` | review-automation-system |
| `github.com/liemdo28/LinkTreeHL.git` | LinkTreeHL |
| `github.com/liemdo28/bakudanramen.com.git` | bakudanramen.com (WP, archived) |
| `github.com/liemdo28/intergration-full.git` | integration-system |
| `github.com/liemdo28/qa-system.git` | qa-system |
| `github.com/heoventure/BakudanWebsite.git` | bakudanramen.com-current |

### NOT Shared (Each Project Independent)

| Resource | Status |
|----------|--------|
| Database | ❌ Each project has own DB (SQLite, Prisma, etc.) |
| Message Queue | ❌ No shared queue (each has own APScheduler/workers) |
| Webhooks | ❌ No shared webhook endpoints |
| Auth System | ❌ Each app has own auth (NextAuth, session-based, etc.) |