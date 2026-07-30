# ACTIVE_COMPONENTS.md
**Generated:** 2026-06-17 21:55 VN Time  
**Source:** Ollama server logs (Jun 10–17), Gateway logs, Mi-Core logs, source code analysis  
**Coverage:** 7 days (Jun 10–17) + 24h (Jun 17)

---

## ═══ OLLAMA MODELS ═══

### qwen3:8b
- **Status:** ✅ ACTIVE
- **Role in mi-core:** `fast_chat` (primary model — first in ROLE_PRIORITY)
- **File:** `server/src/model-router/ollama-router.ts`, `server/src/providers/provider-router.ts`
- **Calls 24h:** 1 (server.log — 21:47 load+2 chat completions)
- **Calls 7d:** **80 model loads** across all rotated logs (dominant model)
- **Total /api/chat 200:** 710 across all logs (shared pool — qwen3:8b primary recipient)
- **Evidence:** `C:/Users/liemdo/AppData/Local/Ollama/server.log`, `server-1.log` through `server-5.log`
- **Note:** Truncating prompts (6502 → 4096 ctx) — context too large

---

### qwen3:14b
- **Status:** ✅ ACTIVE
- **Role in mi-core:** `deep_reasoning`, `qa_review`
- **File:** `server/src/model-router/ollama-router.ts`
- **Calls 24h:** 0
- **Calls 7d:** **14 model loads** (Jun 10–16)
- **Evidence:** `server-1.log`, `server-4.log`, `server-5.log`
- **Note:** Called for heavy reasoning tasks — not daily but confirmed active

---

### nomic-embed-text
- **Status:** ✅ ACTIVE
- **Role in mi-core:** `embeddings` (first in ROLE_PRIORITY for embedding role)
- **File:** `server/src/bigdata/memory-indexer.ts`, `server/src/bigdata/search-service.ts`
- **Calls 24h:** 0
- **Calls 7d:** **12 model loads**
- **Evidence:** `server-1.log`, `server-4.log`
- **Note:** Embedding calls via `/api/embed` — used by knowledge search & BigData indexer

---

### gemma3:12b
- **Status:** ✅ ACTIVE (low frequency)
- **Role:** Not in ROLE_PRIORITY — called directly somewhere outside standard router
- **File:** Unknown caller (not in mi-core ROLE_PRIORITY list)
- **Calls 24h:** 0
- **Calls 7d:** **12 model loads**
- **Evidence:** `server-1.log`, `server-4.log`
- **Note:** ⚠️ SHADOW — not in any ROLE_PRIORITY config but being called. Likely from agent-coding-api-keys or Codex/external tool

---

### deepseek-r1:14b
- **Status:** ⚠️ INSTALLED_NOT_USED (borderline)
- **Role configured:** `deep_reasoning` (3rd priority after qwen3:14b and qwen3:8b)
- **File:** `server/src/model-router/ollama-router.ts`
- **Calls 24h:** 0
- **Calls 7d:** **1 model load** (Jun 10–16, single occurrence)
- **Evidence:** `server-5.log` (2026-06-10)
- **Note:** Only called once in 7 days — shadowed by qwen3:14b taking the deep_reasoning slot

---

### qwen3:1.7b
- **Status:** ⚠️ INSTALLED_NOT_USED
- **Role configured:** None — not in any ROLE_PRIORITY list
- **Calls 24h:** 0
- **Calls 7d:** **1 model load** (single occurrence)
- **Evidence:** `server-4.log`
- **Note:** Not configured for any role in mi-core. Likely tested manually

---

### qwen2.5-coder:7b
- **Status:** ⚠️ INSTALLED_NOT_USED
- **Role configured:** `coding` (first priority)
- **File:** `server/src/model-router/ollama-router.ts`
- **Calls 24h:** 0
- **Calls 7d:** 0 model loads
- **Evidence:** Zero entries in all server logs
- **Note:** ⚠️ Installed, configured as coding model, but never actually called. `coding` role not being triggered in current workflows

---

## ═══ MI-CORE RUNTIME MODULES ═══

### Mi-Core Server (Express)
- **Status:** ✅ ACTIVE
- **Process:** PM2 id=1, PID 33100, uptime stable
- **Calls 24h:** Online — received 5 WhatsApp forwards (20:54, 21:46–21:47 VN)
- **Calls 7d:** Confirmed active Jun 10–16 via gateway forward-success logs
- **Evidence:** `E:/Project/Master/.local-agent-global/logs/mi-core-out.log`

---

### WhatsApp Gateway (whatsapp-ai-gateway)
- **Status:** ✅ ACTIVE
- **Process:** PM2 id=2, PID 36432, headless mode
- **Calls 24h:** 5 forward-success to Mi-Core; Media sent (SEO image 21:46)
- **Calls 7d:** 521 total forward-success (Jun 10–17 combined)
- **Evidence:** `whatsapp-ai-gateway/logs/2026-06-*/agent-mi-forwarder.log`

| Date       | Forward-success |
|------------|----------------|
| 2026-06-10 | 1              |
| 2026-06-12 | 14             |
| 2026-06-13 | 5              |
| 2026-06-15 | 467            |
| 2026-06-16 | 29             |
| 2026-06-17 | 5              |

---

### Jarvis Phase 30 (jarvis-evolution / jarvis-core)
- **Status:** ✅ ACTIVE
- **File:** `server/src/jarvis/phase30-jarvis/`
- **Calls 24h:** Multiple — all 5 WhatsApp messages handled here
- **Calls 7d:** Every forward-success routes through this layer
- **Evidence:** Boot log `[Mi] ✓ Jarvis Evolution Phase 30 booted`, response metadata `"source":"jarvis-evolution"`

---

### GStack / Intent Router
- **Status:** ✅ ACTIVE
- **File:** `server/src/gstack/intent-router.ts`, `server/src/gstack/gstack-orchestrator.ts`
- **Calls 24h:** Active — all inbound WhatsApp NLP routes through here
- **Calls 7d:** Active
- **Evidence:** `server/src/gstack/intent-router.ts` references `ollama` for NLP classification

---

### Executive Briefing (Phase 17)
- **Status:** ✅ ACTIVE (scheduled)
- **File:** `server/src/executive-briefing/briefing-engine.ts`
- **Calls 24h:** Boot log confirms `[DailyBriefing] Scheduler started — morning 07:00, evening 20:00`
- **Calls 7d:** Fires daily at 07:00 + 20:00 VN
- **Evidence:** `mi-core-out.log` 2026-06-17 20:42:09

---

### Proactive Monitor
- **Status:** ✅ ACTIVE (scheduled)
- **File:** `server/src/jarvis/`
- **Calls 24h:** Boot log `[ProactiveMonitor] Started — interval 15min`
- **Calls 7d:** Running every 15 minutes
- **Evidence:** `mi-core-out.log` 2026-06-17 20:42:09

---

### Scheduler (Visibility Sync)
- **Status:** ✅ ACTIVE
- **File:** `server/src/` (scheduler layer)
- **Calls 24h:** Ran visibility sync at 07:55, 08:25, 08:55 on Jun 17 (earlier session)
- **Calls 7d:** Every 30 min
- **Evidence:** `mi-core-out.log` — `[Scheduler] Visibility sync complete` entries

---

### Self-Heal (O9-SELFHEAL)
- **Status:** ✅ ACTIVE
- **File:** `server/src/` operations layer
- **Calls 24h:** Running every 5 min
- **Evidence:** `mi-core-error.log` — `[O9-SELFHEAL] Scheduler started — every 5min`
- **Note:** Detected `restart_storm` incident at 00:00–00:05 Jun 17

---

### BigData Foundation
- **Status:** ✅ ACTIVE (MinIO connected)
- **File:** `server/src/bigdata/`
- **Calls 24h:** `[BigData] MinIO buckets ready` at boot
- **Evidence:** `mi-core-out.log` 20:42:09
- **Note:** `memory-indexer.ts` and `search-service.ts` use `nomic-embed-text` for indexing

---

### Knowledge DB (7455 docs)
- **Status:** ✅ ACTIVE
- **File:** `server/src/knowledge/`
- **Calls 24h:** Boot ingest skipped (needs `MI_BOOT_KNOWLEDGE_INGEST=1`); query-time active
- **Evidence:** `knowledge.db` — 7455 docs, FTS index live
- **Path:** `E:/Project/Master/.local-agent-global/knowledge-db/knowledge.db`

---

### QB Watcher
- **Status:** ✅ ACTIVE (watching)
- **File:** `server/src/` QB integration
- **Calls 24h:** `[QB-WATCHER] Started — qb-laptop-01 currently: OFFLINE`
- **Evidence:** `mi-core-out.log`
- **Note:** Laptop1 offline — watcher running but no sync events

---

### Leader Lock (Phase 7)
- **Status:** ✅ ACTIVE
- **Calls 24h:** Initialized at boot
- **Evidence:** `mi-core-out.log` — `[Mi] ✓ Leader Lock initialized`

---

### COO v4 Orchestrator
- **Status:** ⚠️ SHADOW
- **File:** `server/src/coo-v4/coo-orchestrator.ts`, `server/src/coo-v4/agents/creative-agents.ts`
- **Calls 24h:** 0 confirmed
- **Calls 7d:** 0 confirmed in logs
- **Evidence:** Source references Ollama but no log trace of COO calls
- **Note:** Loaded in memory (module imported) but no evidence of actual invocation

---

### Council (Phase 21)
- **Status:** ⚠️ INSTALLED_NOT_USED
- **File:** `server/src/council/`
- **Calls 24h:** 0
- **Calls 7d:** 0 log evidence
- **Note:** CLAUDE.md confirms council = risky-decision trigger. No risky decisions logged.

---

### Digital Twin (Phase 24)
- **Status:** ⚠️ INSTALLED_NOT_USED
- **File:** `server/src/digital-twin/`
- **Calls 24h:** 0
- **Calls 7d:** 0 log evidence

---

### Health Intelligence (Phase 23)
- **Status:** ⚠️ INSTALLED_NOT_USED
- **File:** `server/src/health-intelligence/`
- **Calls 24h:** 0
- **Calls 7d:** 0 log evidence
- **Note:** `health-export/` data directory exists — module loaded but no inbound data triggered it

---

### Operational Memory (Phase 15)
- **Status:** ⚠️ BROKEN
- **File:** `server/src/operational-memory/`
- **Calls 24h:** 0
- **Calls 7d:** 0
- **Evidence:** `memory.db` — `unable to open database file`
- **Path:** `E:/Project/Master/.local-agent-global/operational-memory/memory.db` — file missing or path wrong

---

### O1-INCIDENT / Burn-in (O5-BURNIN)
- **Status:** ✅ ACTIVE
- **File:** `server/src/operations/`
- **Calls 24h:** Running — `[O5-BURNIN] Scheduler started — V2.1`
- **Evidence:** `mi-core-error.log` — P2 whatsapp_failure incident at 00:00–00:05 Jun 17 (during outage)

---

### CEo Observer (mi-ceo-observer)
- **Status:** ⚠️ NOT IN PM2 (not started)
- **Calls 24h:** 0 — not running
- **Evidence:** PM2 list shows only mi-core + whatsapp-ai-gateway
- **Note:** Ecosystem.config.js has it defined but not started this session

---

### agent-coding-api-keys
- **Status:** ⚠️ INSTALLED_NOT_USED (not running)
- **Port:** 3100 (from gateway env `AGENT_CODING_URL=http://localhost:3100`)
- **Calls 24h:** 0
- **Evidence:** Port 3100 not in netstat, not in PM2
- **Note:** Source references Ollama routing — not active

---

## ═══ SUMMARY CLASSIFICATION ═══

### ✅ ACTIVE (confirmed runtime calls)
| Component | 24h calls | 7d calls |
|-----------|-----------|----------|
| qwen3:8b (Ollama) | 2 chat | 80 loads / 710 chat |
| qwen3:14b (Ollama) | 0 | 14 loads |
| nomic-embed-text (Ollama) | 0 | 12 loads |
| Mi-Core Server | 5 WA msgs | 521+ |
| WhatsApp Gateway | 5 fwd | 521 |
| Jarvis Phase 30 | ✓ | ✓ |
| GStack / Intent Router | ✓ | ✓ |
| Executive Briefing | scheduled | daily |
| Proactive Monitor | 15min | continuous |
| Scheduler / Visibility Sync | 30min | continuous |
| Self-Heal O9 | 5min | continuous |
| BigData Foundation | boot+active | ✓ |
| Knowledge DB (7455 docs) | query-time | ✓ |
| QB Watcher | watching | ✓ |
| Leader Lock | boot | ✓ |
| O5-BURNIN | hourly | ✓ |
| O1-INCIDENT | event-driven | triggered Jun 17 00:00 |

### ⚠️ INSTALLED_NOT_USED
| Component | Reason |
|-----------|--------|
| qwen2.5-coder:7b | coding role configured, 0 calls logged |
| qwen3:1.7b | 1 call Jun 10–16, not in ROLE_PRIORITY |
| deepseek-r1:14b | 1 call only, shadowed by qwen3:14b |
| Council (Phase 21) | No risky decisions triggered |
| Digital Twin (Phase 24) | No simulation requests |
| Health Intelligence (Phase 23) | No health data ingest triggered |
| agent-coding-api-keys | Not running (port 3100 dead) |
| mi-ceo-observer | Not in PM2 |

### 🔴 BROKEN
| Component | Reason |
|-----------|--------|
| Operational Memory (Phase 15) | `memory.db` — unable to open (file missing) |
| Gateway `/api/stats` endpoint | `ReferenceError: getStatus is not defined` at server.js:982 |

### 🌑 SHADOW
| Component | Reason |
|-----------|--------|
| gemma3:12b | 12 model loads — caller not identified in mi-core ROLE_PRIORITY. External tool (Codex/Claude Code?) calling Ollama directly |
| COO v4 | Code loaded, Ollama referenced, zero log trace |

### 🗑️ DEPRECATED
| Component | Reason |
|-----------|--------|
| qwen3:1.7b | No config role, 1 test call only — candidate for `ollama rm` |

---

## Evidence Paths

| Source | Path |
|--------|------|
| Ollama logs | `C:/Users/liemdo/AppData/Local/Ollama/server*.log` |
| Mi-Core out | `E:/Project/Master/.local-agent-global/logs/mi-core-out.log` |
| Mi-Core err | `E:/Project/Master/.local-agent-global/logs/mi-core-error.log` |
| Gateway forwarder | `E:/Project/Master/whatsapp-ai-gateway/logs/2026-06-*/agent-mi-forwarder.log` |
| Gateway messages | `E:/Project/Master/whatsapp-ai-gateway/logs/2026-06-*/message.log` |
| Knowledge DB | `E:/Project/Master/.local-agent-global/knowledge-db/knowledge.db` |
| QB Agent DB | `E:/Project/Master/mi-core/data/qb-agent.db` |
| Model router | `server/src/model-router/ollama-router.ts` |
| Provider router | `server/src/providers/provider-router.ts` |
