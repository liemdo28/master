# MI MASTER ARCHITECTURE V1
**Date:** 2026-06-09
**Status:** TARGET — Not yet fully implemented
**Version:** 1.0.0

---

## System Philosophy

> Mi is not a chatbot. Mi is an Executive Operating System.

Every architectural decision flows from this principle:

1. **Proactive, not reactive** — Mi anticipates needs, doesn't wait for commands
2. **Unified, not fragmented** — All business data flows through one brain
3. **Safe by default** — Every action is risk-assessed before execution
4. **Omnipresent** — Works from phone, MacBook, PC, and eventually API

---

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    L1: OWNER BRAIN (Executive Context)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Profile  │  │Personality│  │  Modes   │  │ Executive        │   │
│  │ Engine   │  │  Engine   │  │ (7+1)    │  │ Reasoning Chain  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                    L2: MEMORY SYSTEM                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │Executive │  │  Personal│  │  Business│  │ Vector Memory    │   │
│  │ Memory V2│  │(Consent) │  │ Memory   │  │(Embeddings)      │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │
│  │ Decision │  │Workflows │  │ Consent  │                          │
│  │ Log      │  │ & Lessons│  │ Log      │                          │
│  └──────────┘  └──────────┘  └──────────┘                          │
├─────────────────────────────────────────────────────────────────────┤
│                    L3: KNOWLEDGE FEDERATION                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Unified Knowledge Bus                       │   │
│  ├────────────────┬────────────────┬────────────────────────────┤   │
│  │ SQLite FTS5    │ Embedding      │ Agent-Engine KB             │   │
│  │ (Server)       │ Vector Search  │ (DOMAIN / MDN / SEED)      │   │
│  └────────────────┴────────────────┴────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Knowledge Packs Engine                      │   │
│  │  [Business] [Health] [Technology] [Restaurant] [Finance]     │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                    L4: UNIVERSAL VISIBILITY                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Visibility Hub                              │   │
│  │       [Connector Registry] [Sync Engine] [Cache Layer]       │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │   │
│  │  │ Daily    │  │ Platform │  │Health    │  │  Action      │ │   │
│  │  │Snapshot  │  │ Health   │  │Dashboard │  │  Items Gen   │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                    L5: PROJECT REGISTRY                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Scanner  │  │ Dependency│  │  Git     │  │ Build / CI/CD    │   │
│  │ Engine   │  │ Analyzer  │  │ Tracker  │  │ Status Reporter  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
│  ┌──────────┐  ┌──────────┐                                         │
│  │ Report   │  │  Watch   │                                         │
│  │ Finder   │  │  Mode    │                                         │
│  └──────────┘  └──────────┘                                         │
├─────────────────────────────────────────────────────────────────────┤
│                    L6: CONNECTOR LAYER                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Connector Router (NLP Intent → Connector)   │   │
│  ├─────────┬─────────┬──────────┬──────────┬───────────────────┤   │
│  │ Website │ Dashboard│ Remote  │ Accounting│ Food Safety      │   │
│  │(Raw/Baku)│ (PHP)   │ Proxy   │ Engine   │ Gateway          │   │
│  ├─────────┼─────────┼──────────┼──────────┼───────────────────┤   │
│  │ Google  │ Asana   │ Health  │ Slack    │ Jira/GitHub       │   │
│  │(Mail/Cal)│         │ (Export)│ (Future) │ (Future)          │   │
│  └─────────┴─────────┴──────────┴──────────┴───────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                    L7: APPROVAL GATE                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Level 1  │  │ Level 2  │  │ Level 3  │  │ Persistence &    │   │
│  │ Auto     │  │ Single   │  │ Double   │  │ Recovery         │   │
│  ├──────────┤  │ Approve  │  │ Confirm  │  ├──────────────────┤   │
│  │ Read-only│  ├──────────┤  ├──────────┤  │ Escalation Path  │   │
│  │ No queue │  │Write/Edit│  │Delete/Dply│  │ Timeouts         │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                    L8: EXECUTION ENGINE                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Agent Engine Bridge (Port 4003)            │   │
│  ├─────────┬─────────┬──────────┬──────────┬───────────────────┤   │
│  │ Patch   │ Patch   │ Patch    │ Git      │ Deployment        │   │
│  │ Planner │ Validator│ Applier │ Tracker  │ Executor          │   │
│  ├─────────┴─────────┴──────────┴──────────┴───────────────────┤   │
│  │                    Autonomous Workflow Engine                 │   │
│  │  [Decision Engine] [Workflow Runner] [Goal Tracker]         │   │
│  │  [Learning Loop] [Failure Stopper] [Safe Coordinator]      │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                    L9: QA + SECURITY                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    QA Pipeline                                │   │
│  │  [Route Crawler] [Screenshot] [A11y] [SEO] [Post-Patch QA]  │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │                    Security Layer                              │   │
│  │  [Helmet] [Rate Limit] [IP Guard] [PIN Auth] [Audit Log]    │   │
│  │  [CORS] [Session Mgmt] [Device Tracking]                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                    L10: REMOTE CONTROL                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Remote Auth Gateway                        │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │ mi-remote-   │  │ mi-remote-   │  │ iPad/MacBook     │   │   │
│  │  │ agent        │  │ agent        │  │ iPhone Safari    │   │   │
│  │  │ (Integration)│  │ (WhatsApp)   │  │ (Mobile UI)      │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│  └─────────────────��────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
CEO Request (any device)
    │
    ▼
┌─────────────────────┐
│  L1: Owner Brain    │─── Parse Intent ─── Detect Mode ─── Build Context
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  L2: Memory System  │─── Get Relevant Memory ─── Check Preferences
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  L3: Knowledge Fed  │─── Search Knowledge DB ─── Check Agent KB
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  L4: Visibility Hub │─── Daily Snapshot ─── Connector Health
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  L5: Project Reg.   │─── Project Status ─── Git State ─── Issues
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  L6: Connector Layer│─── Route to right connector ─── Fetch data
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Response Pipeline  │─── Assemble context ─── Build prompt ─── AI call
└─────────┬───────────┘
          │
          ▼
      Reply to CEO
```

---

## Execution Flow

```
CEO: "Apply this fix to RawSushi"
    │
    ▼
┌─────────────────────┐
│  L7: Approval Gate  │─── Level 2 → Needs CEO approval
└─────────┬───────────┘
          │
          ▼
    [CEO approves on mobile]
          │
          ▼
┌─────────────────────┐
│  L8: Execution Eng. │─── Route to Agent Engine Bridge
│  /patch/plan        │─── CodePatchPlanner analyzes code
│  /patch/validate    │─── PatchValidator checks safety
│  /patch/apply       │─── SafeFileEditor applies changes
│  git/diff           │─── GitChangeTracker records diff
│  PostPatchQA        │─── QA validates the result
│  EvidenceStore      │─── Log evidence for audit
└─────────────────────┘
          │
          ▼
    CEO notified of result
```

---

## Approval Flow

```
                    ┌──────────────┐
                    │ Action Request│
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Risk Assess   │
                    └──────┬───────┘
                           │
      ┌────────────────────┼────────────────────┐
      │                    │                    │
      ▼                    ▼                    ▼
┌───────────┐      ┌───────────┐      ┌───────────┐
│ Level 1   │      │ Level 2   │      │ Level 3   │
│ Auto-allow│      │ Needs 1   │      │ Needs 2   │
│ No queue  │      │ approval  │      │ approvals │
└───────────┘      └─────┬─────┘      └─────┬─────┘
      │                  │                  │
      ▼                  ▼                  │
┌───────────┐      ┌───────────┐            │
│ Execute   │      │ Wait for  │            │
│           │      │ approval  │            │
└───────────┘      └─────┬─────┘            │
                         │                  │
                         ▼                  ▼
                  ┌──────────────┐  ┌──────────────┐
                  │ 1st Approve  │  │ 1st Approve  │
                  └──────┬───────┘  └──────┬───────┘
                         │                  │
                         ▼                  ▼
                  ┌──────────────┐  ┌──────────────┐
                  │ Execute      │  │ Wait for 2nd │
                  └──────────────┘  │ approval    │
                                     └──────┬───────┘
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │ 2nd Approve  │
                                    └──────┬───────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │ Execute      │
                                    └──────────────┘
```

---

## Sync Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Sync Scheduler                            │
│                  (node-cron, every 15min)                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. syncAll() triggered                                       │
│     │                                                         │
│     ├─▶ syncLocalProjects()  ───▶ Cache JSON                  │
│     ├─▶ syncDashboard()      ───▶ Cache JSON                  │
│     ├─▶ syncGmail()          ───▶ Cache JSON (if auth OK)    │
│     ├─▶ syncCalendar()       ───▶ Cache JSON (if auth OK)    │
│     ├─▶ syncDrive()          ───▶ Cache JSON (if auth OK)    │
│     ├─▶ syncAsana()          ───▶ Cache JSON (if token set)  │
│     ├─▶ syncAccounting()     ───▶ Cache JSON (if service up) │
│     └─▶ syncFoodSafety()     ───▶ Cache JSON                  │
│                                                               │
│  2. Generate Daily Snapshot                                    │
│     └─▶ Write daily-snapshot.json + sync_log.json             │
│                                                               │
│  3. Push updates to connected UI via WebSocket                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ (TypeScript 5.4) |
| Server | Express 4.19 + http + ws |
| AI Backend | Python 3.11+ / FastAPI / Ollama |
| Database | SQLite (better-sqlite3) + JSON files |
| Security | Helmet, express-rate-limit, crypto |
| Agent Engine | Node.js ESM (bridge.mjs) |
| Remote Agent | Node.js ESM (index.mjs) |
| UI | Vanilla JS + CSS (no framework) |
| Mobile | PWA (mobile.html, safe-area) |
| Knowledge | FTS5 text search (+ planned vector) |
| CI/CD | GitHub Actions (planned) |

---

## Port Allocation

| Service | Port | Protocol | Access |
|---------|------|----------|--------|
| Mi Server (TypeScript) | 4001 | HTTP + WS | LAN/Tailscale only |
| Python AI Service | 4002 | HTTP | Localhost only |
| Agent Engine Bridge | 4003 | HTTP | Localhost only |
| Remote Agent (per machine) | 4005 | HTTP | LAN/Tailscale only |
| Ollama | 11434 | HTTP | Localhost only |
| Accounting Engine | 8844 | HTTP | Localhost only |

---

## Design Decisions

### Why Vanilla JS (no framework)?
- Zero build step — edit HTML, reload, done
- CEO can modify UI without toolchain knowledge
- All UI logic fits in single files
- PWA works without service worker complexity
- Faster development