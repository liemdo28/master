# TRUE_ACTIVE_STACK.md
**Date:** 2026-06-17 22:05 VN Time  
**Definition:** Only components with confirmed runtime invocations (logs, DB writes, API responses)

---

## TIER 1 — ALWAYS ON (continuous runtime)

| Component | Process | Calls/day | Evidence |
|-----------|---------|-----------|----------|
| **Mi-Core Express Server** | PM2 id=1 PID 33100 | 24/7 | Port 4001 LISTENING |
| **WhatsApp Gateway** | PM2 id=2 PID 36432 | 24/7 | Port 3211 LISTENING |
| **Proactive Monitor** | Thread in mi-core | Every 15min | `mi-core-out.log` |
| **Scheduler** | Thread in mi-core | Every 30min | Visibility sync confirmed |
| **Self-Heal O9** | Thread in mi-core | Every 5min | `mi-core-error.log` |
| **Burn-in O5** | Thread in mi-core | Every 60min | `mi-core-error.log` |
| **Daily Briefing** | Thread in mi-core | 07:00 + 20:00 | Boot log confirmed |
| **Leader Lock** | Thread in mi-core | On boot | `mi-core-out.log` |
| **QB Watcher** | Thread in mi-core | On event | Watching qb-laptop-01 |

---

## TIER 2 — ON DEMAND (WhatsApp → Mi-Core)

| Component | Caller | Calls 7d | Evidence |
|-----------|--------|----------|----------|
| **Jarvis Phase 30** | WhatsApp message | 521 | response `"source":"jarvis-evolution"` |
| **GStack Intent Router** | WhatsApp message | 521 | All messages route through NLP |
| **qwen3:8b** (Ollama) | provider-router → ollama | ~710 chat | Ollama server logs |
| **qwen3:14b** (Ollama) | provider-router → deep_reasoning | 14 loads | Ollama server-1..5.log |
| **nomic-embed-text** (Ollama) | BigData memory-indexer | 12 loads | Ollama server logs |

> ⚠️ **Active bug:** qwen3:1.7b currently being selected instead of qwen3:8b due to fuzzy match issue. Fix: remove qwen3:1.7b OR fix `selectModel()` in `ollama-router.ts`.

---

## TIER 3 — DATA LAYER (passive, always available)

| Component | Size | State | Evidence |
|-----------|------|-------|----------|
| **Knowledge DB** | 7,455 docs | LIVE | SQLite FTS active |
| **Operational Memory** | 177 exec / 92 incidents | LIVE (just recovered) | memory.db + WAL |
| **QB Agent DB** | 7 tables | LIVE | heartbeats + sync_cycles |
| **Work Orders dir** | 118 WOs (Jun 13–) | LIVE | `.local-agent-global/work-orders/` |
| **Execution Ledger** | 545 entries | LIVE | `ledger.jsonl` |
| **SEO Images** | SVG outputs | LIVE | Referenced in gateway media sends |

---

## TIER 4 — EXTERNAL (outside mi-core, confirmed active)

| Component | Owner | Evidence |
|-----------|-------|----------|
| **gemma3:12b** (Ollama) | Cline/Claude Dev IDE | 12 vision loads Jun 15–16 via `--mmproj` |
| **Ollama daemon** | System | Always running, serves all above |

---

## NOT IN TRUE ACTIVE STACK

| Component | Classification | Note |
|-----------|----------------|------|
| Council (Phase 21) | INSTALLED_NOT_USED | No trigger in 7d |
| Digital Twin (Phase 24) | INSTALLED_NOT_USED | No trigger in 7d |
| Health Intelligence (Phase 23) | INSTALLED_NOT_USED | No health data ingest |
| mi-ceo-observer | NOT RUNNING | Not in PM2 |
| agent-coding-api-keys | NOT RUNNING | Port 3100 dead |
| qwen2.5-coder:7b | INSTALLED_NOT_USED | coding role, 0 calls |
| qwen3:1.7b | DEPRECATED | Remove → fixes model selection bug |
| deepseek-r1:14b | INSTALLED_NOT_USED | 1 call 7d, 9GB wasted |
