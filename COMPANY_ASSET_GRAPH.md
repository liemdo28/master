# COMPANY_ASSET_GRAPH.md
> Mi Company OS — Single source of truth asset graph.
> CEO → Departments → Projects → Services → Sources
> Updated: 2026-06-18

---

```
CEO (Liem Do — iPhone WhatsApp)
│
├─ WhatsApp AI Gateway [3211] ──────────────────────────────────────────┐
│    └─ food-safety-gateway (library)                                   │
│                                                                        │
└─ Mi CEO Observer [3212]                                               │
     └─ WhatsApp Session A (read-only)                                  │
                                                                         ▼
                                                            Mi-Core Central Command [4001]
                                                            ├─ GStack + Intent Router
                                                            ├─ Jarvis Phase 30
                                                            ├─ Company OS Pipeline (19 depts)
                                                            └─ All API routes
                                                                 │
     ┌───────────────────┬───────────────────┬───────────────────┼───────────────────┬─────────────────────┐
     │                   │                   │                   │                   │                     │
     ▼                   ▼                   ▼                   ▼                   ▼                     ▼
DISPATCH             EXECUTIVE           FINANCE          RESTAURANT          MARKETING          INFRASTRUCTURE
     │               ASSISTANT               │            INTELLIGENCE              │               & PLATFORM
     │                   │                   │                   │                   │                     │
     ├─ mi-ai-svc    ├─ mi-ceo-obs     ├─ accounting-    ├─ food-safety-    ├─ review-auto    ├─ PM2 (6 svcs)
     │  [4002]       │  [3212]         │  engine [8844]  │  gateway         │  system [8000]  ├─ Docker (3)
     └─ Ollama       ├─ Gmail          ├─ qb-ops-agent   ├─ bakudan-        ├─ doordash-     ├─ Ollama
        [11434]      ├─ G-Drive        └─ QuickBooks ←── │  integration     │  agent          ├─ Tailscale
                     ├─ G-Calendar          (laptop1)    │  system          └─ Google/Yelp    └─ Backups
                     └─ Apple Health                     ├─ Toast POS              reviews
                                                         └─ DoorDash
                                                              merchant

ENGINEERING          REPORT CENTER       LIBRARY             QA              BRAND & CREATIVE
     │                   │                   │                │                     │
     ├─ antigravity-  ├─ AgenView         ├─ knowledge-db  ├─ evidence.db    ├─ bakudan-website
     │  gateway [3456] ├─ briefing         ├─ Qdrant*       └─ gemma3:12b    └─ rawsushi-website
     └─ qwen2.5-      ├─ strategic-mem    └─ Outline*          (independent)
        coder:7b       └─ visibility
```

`*` = PLANNED, not yet active

---

## Data Flow: CEO WhatsApp Command

```
iPhone (CEO)
    │ WhatsApp message
    ▼
WhatsApp AI Gateway [3211]
    │ POST /api/whatsapp/mi
    ▼
Mi-Core [4001]
    │ jarvis-core → dispatch-center
    ▼
12-Step Pipeline
    ├─ 1-5: Dispatch (intent, dept, decompose)
    ├─ 6: Source Truth Check (library/knowledge-db)
    ├─ 7: Dept Execution (correct brain + tools)
    ├─ 8: Evidence Collection (evidence.db)
    ├─ 9: QA Verification (gemma3:12b)
    ├─ 10: Report Center (CEO-safe summary)
    ├─ 11: Mi Final Review (confidence ≥ 95%)
    └─ 12: CEO Response
         │ WhatsApp reply
         ▼
    iPhone (CEO) ✅
```

---

## Service Dependency Map

```
mi-core [4001]
    ├── REQUIRES: Ollama [11434]
    ├── REQUIRES: mi-accounting [8844] (for finance queries)
    ├── CALLS: whatsapp-ai-gateway [3211] (outbound messages)
    ├── READS: .local-agent-global/* (SQLite DBs)
    └── OPTIONAL: review-automation-system [8000]

whatsapp-ai-gateway [3211]
    └── CALLS: mi-core [4001] POST /api/whatsapp/mi

mi-ceo-observer [3212]
    └── CALLS: mi-core [4001] POST /api/whatsapp/mi

accounting-engine [8844]
    └── READS: qb-agent.db (synced from laptop1 via qb-ops-agent)

antigravity-gateway [3456]
    └── USED BY: Claude Code, Cline, qb-ops-agent [AGENT_OS_API_URL]

review-automation-system [8000]
    ├── USES: postgres [5432]
    └── USES: redis [6379]
```

---

## Port Allocation Graph

```
:3211 ─── WhatsApp AI Gateway (inbound CEO + food-safety)
:3212 ─── CEO Observer (WhatsApp Session A)
:3456 ─── Antigravity AI Gateway (Claude Code / Cline)
:4001 ─── Mi-Core Central (MASTER)
:4002 ─── Mi AI Python Service (Ollama wrapper)
:4004 ─── Mi Node Agent (device registry)
:5432 ─── PostgreSQL (review system)
:6379 ─── Redis (review system)
:8000 ─── Review Automation API
:8844 ─── Accounting Engine (127.0.0.1 only)
:11434 ── Ollama LLM Runtime
```

---

## Source Truth Hierarchy

```
PRIMARY (CEO trusts as ground truth)
    QuickBooks Desktop → accounting-engine [8844]
    Toast POS → bakudan-integration-system
    DoorDash Merchant Portal → doordash-agent
    Gmail / G-Calendar → mi-core connectors
    WhatsApp → whatsapp-ai-gateway
    Google Reviews / Yelp → review-automation-system
    Apple Health → health-export JSONs

DERIVED (computed from PRIMARY)
    Accounting Engine SQLite ← QuickBooks
    Operational Memory ← executions
    Company OS Evidence DB ← pipeline runs
    Mi Knowledge DB ← ingest from docs

SUPPLEMENTAL (enrichment only)
    Google Drive
    Google Sheets (food-safety auto-sync)
```
