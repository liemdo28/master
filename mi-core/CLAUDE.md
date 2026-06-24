# Mi-Core Central Command — CLAUDE.md
> Project guide for AI-assisted development. Read this before touching any code.

## What This Is

Mi-Core is Liem Do's personal CEO OS — a self-hosted AI command center that:
- Receives orders via WhatsApp → executes across all systems
- Sends a proactive morning briefing at 07:00 VN time
- Monitors services, manages multi-device nodes, simulates failures
- Runs a multi-agent council before risky decisions

The server runs on a Windows PC (`mi-core-primary`). The CEO uses an iPhone. Secondary devices (laptop, Mac) run `node-agent.mjs` to join the node network.

## Architecture

```
CEO iPhone (WhatsApp)
    ↓
WhatsApp Gateway (port 3211, separate process)
    ↓
Mi-Core Server (port 4001)  ←── this repo: mi-core/server/
    ├── GStack + Intent Router    (routes NLP → work orders)
    ├── Jarvis Phase 30           (personality + executive layer)
    ├── Phase 14: Graph           (ownership, SPOF detection)
    ├── Phase 15: Memory          (operational memory runtime)
    ├── Phase 16: Task Intel      (personal task queries)
    ├── Phase 17: Briefing        (daily 07:00 WhatsApp report)
    ├── Phase 18: Strategic Mem   (months/years trends)
    ├── Phase 19: AgenView        (CEO dashboard /agenview)
    ├── Phase 20: Autonomous      (FULL_AUTO / BLOCKED boundary)
    ├── Phase 21: Council         (6-agent consensus)
    ├── Phase 22: Self-Improve    (skill effectiveness loop)
    ├── Phase 23: Health Intel    (Apple/Huawei Health data)
    ├── Phase 24: Digital Twin    (failure simulation)
    ├── Phase 25: Jarvis Final    (integration certification)
    ├── Phase 6:  Node Agent      (multi-device registry)
    └── Phase 7:  Leader Lock     (single-writer election)
```

## Critical Rules — DO NOT VIOLATE

1. **DO NOT modify** `/api/execution-package` contract
2. **DO NOT modify** Dev3 Role Engine, Skill Engine, or Approval Engine
3. **Graph layer is ADVISORY** — intelligence-only, never blocks execution
4. **No LLM required** for task intelligence or daily briefing — pure SQLite
5. **CommonJS TypeScript** — use `require()` for lazy loading, not `import()` in engine files
6. **Single-quotes in SQL** — `better-sqlite3` uses synchronous SQLite with WAL mode

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 18+ / TypeScript (CommonJS) |
| DB | SQLite (`better-sqlite3`, WAL mode) |
| Server | Express 4 |
| Real-time | WebSocket (`ws`) |
| Process mgr | PM2 (`ecosystem.config.js`) |
| SQLite DBs | `graph.db`, `memory.db`, `knowledge.db`, `qb-agent.db` |
| Health export | `.local-agent-global/health-export/` (Apple/Huawei JSON) |
| Nodes | `.local-agent-global/nodes/registry.json`, `leader.json` |

## Key File Locations

```
mi-core/
├── server/src/              ← TypeScript source
│   ├── index.ts             ← main server, all route mounts
│   ├── gstack/              ← GStack runtime + intent-router
│   ├── jarvis/              ← proactive monitor, briefing scheduler
│   │   ├── phase30-jarvis/  ← Jarvis orchestration layer (WhatsApp NLP)
│   │   └── executive/       ← executive personality engine
│   ├── graph/               ← Phase 14 ownership graph
│   ├── operational-memory/  ← Phase 15 memory runtime
│   ├── task-intelligence/   ← Phase 16 personal task queries
│   ├── executive-briefing/  ← Phase 17 daily briefing engine
│   ├── strategic-memory/    ← Phase 18 trend analysis
│   ├── agenview/            ← Phase 19 CEO dashboard API
│   ├── autonomous/          ← Phase 20 execution boundary
│   ├── council/             ← Phase 21 multi-agent council
│   ├── self-improvement/    ← Phase 22 effectiveness loop
│   ├── health-intelligence/ ← Phase 23 biometric data
│   ├── digital-twin/        ← Phase 24 failure simulation
│   └── nodes/               ← Phase 6/7 node registry + leader lock
├── server/dist/             ← compiled JS (run: npx tsc in server/)
├── ui/                      ← static HTML dashboards
│   ├── agenview.html        ← CEO system dashboard
│   ├── liveboard.html       ← live ops board
│   └── mobile.html          ← mobile UI
├── tests/                   ← acceptance tests (run with node, not jest)
│   ├── ceo-os-master-validation.mjs   ← 77-check master test
│   ├── phase18-25-acceptance-test.mjs ← phase acceptance tests
│   └── ceo-final-audit.mjs            ← 10-section CEO audit
├── node-agent.mjs           ← standalone secondary-device agent
├── ecosystem.config.js      ← PM2 process config
├── .env.example             ← ALL required env vars documented
└── reports/                 ← certification reports
    ├── JARVIS_V1_FINAL_CERTIFICATION.md
    └── CEO_OS_MASTER_VALIDATION_REPORT.md
```

## Data Directories (`.local-agent-global/`)

```
.local-agent-global/           ← at E:/Project/Master/ (NOT mi-core/)
├── graph/graph.db             ← Phase 14: entities + edges (WAL)
├── operational-memory/memory.db ← Phase 15: executions, incidents
├── knowledge-db/knowledge.db  ← knowledge base (WAL)
├── executive-briefing/        ← cached daily briefing JSON
├── nodes/registry.json        ← persistent node registry
├── nodes/leader.json          ← leader lock state
├── health-export/             ← CEO health data (sleep/hrv/steps JSON)
├── visibility/connector-registry.json ← connector status
└── work-orders/               ← active work order JSON files
```

## How to Build

```bash
cd mi-core/server
npx tsc              # compile
npx tsc --noEmit     # type-check only
```

## How to Run

```bash
# Development
cd mi-core
node server/dist/index.js

# Production (PM2)
pm2 start ecosystem.config.js
pm2 save && pm2 startup

# Secondary device (laptop/Mac)
MI_SERVER_URL=http://192.168.1.x:4001 MI_NODE_NAME="MacBook" node node-agent.mjs
```

## How to Test

```bash
cd mi-core
node tests/ceo-os-master-validation.mjs    # full 77-check suite
node tests/phase18-25-acceptance-test.mjs  # phases 18-25
node tests/ceo-final-audit.mjs             # CEO 10-section audit
```

## NLP Intent Categories

Key intents in `server/src/gstack/intent-router.ts`:
- `query_personal_tasks` — "hôm nay có việc gì", "hnay co viec gi"
- `check_status` — "dashboard đâu", "pm2 status"
- `audit_project` — "rv auto on kh", "review automation"
- `build_feature` — "tạo flyer", "viết bài SEO"
- `search_knowledge` / `search_knowledge` — "tìm tài liệu"
- `send_message` — "nhắn tin cho"

All patterns use NFD-normalized Vietnamese (đ→d, strip diacritics).

## WhatsApp → Jarvis Routing Order

1. `jarvis-core.ts` — Mi Intelligence layer (Ph16-25 queries)
2. `executive-personality.ts` — P1-P8 executive personality
3. Phase 28-30 handlers — briefing, twin, workflows, knowledge
4. `processGStackRequest()` — work order creation for actionable tasks

## Certification Status (2026-06-13)

- **CEO Final Audit:** 93% — JARVIS_FOR_LIEM_DO_CERTIFIED
- **Phase 18-25 Acceptance:** 59/59 PASS
- **CEO OS Master Validation:** 77/77 PASS — MI_OS_MASTER_CERTIFIED
- **NLP Accuracy:** 96%+ (Vietnamese fuzzy input)
- **TypeScript:** Zero compile errors
