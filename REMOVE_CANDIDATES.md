# REMOVE_CANDIDATES.md
**Date:** 2026-06-17 22:05 VN Time

---

## P2 — Remove / Disable Candidates

### 🗑️ OLLAMA MODELS — Safe to Remove

| Model | Size | 7d calls | Reason to remove |
|-------|------|----------|-----------------|
| `qwen3:1.7b` | 1.4 GB | 1 test call | No ROLE_PRIORITY config. Was test-only. Currently being incorrectly selected over qwen3:8b due to fuzzy match bug — removing eliminates the bug for this model |
| `deepseek-r1:14b` | 9.0 GB | 1 call | Shadowed by qwen3:14b for deep_reasoning. 9.0 GB VRAM for a model used once in 7 days |

**Commands:**
```bash
ollama rm qwen3:1.7b
ollama rm deepseek-r1:14b
```

**RAM savings:** 10.4 GB disk freed. qwen3:1.7b removal also **fixes the fuzzy match bug** immediately (qwen3:8b will be selected correctly).

---

### ⚠️ OLLAMA MODELS — Keep (with notes)

| Model | Size | Decision | Reason |
|-------|------|----------|--------|
| `qwen3:8b` | 5.2 GB | **KEEP** | Primary fast_chat/qa_review — core model |
| `qwen3:14b` | 9.3 GB | **KEEP** | deep_reasoning — called 14x in 7d |
| `nomic-embed-text` | 0.3 GB | **KEEP** | Embeddings — BigData + knowledge search |
| `qwen2.5-coder:7b` | 4.7 GB | **KEEP (monitor)** | Coding role configured, 0 calls this week — but it's the only coding model. Keep 14 more days |
| `gemma3:12b` | 8.1 GB | **KEEP (external)** | Used by Cline IDE — not mi-core's decision |

---

### 🗑️ MI-CORE MODULES — Disable or Stub

| Module | Status | Action |
|--------|--------|--------|
| `Council (Phase 21)` | INSTALLED_NOT_USED | **Stub OK** — Keep code, no runtime cost. Triggered only on risky decisions |
| `Digital Twin (Phase 24)` | INSTALLED_NOT_USED | **Stub OK** — Keep code, no runtime cost |
| `Health Intelligence (Phase 23)` | INSTALLED_NOT_USED | **Stub OK** — Keep code. Would activate when health-export data arrives |
| `mi-ceo-observer` | NOT IN PM2 | **Start or remove** — Define: is CEO self-chat observer needed? If yes, add to PM2 startup |
| `agent-coding-api-keys` | NOT RUNNING | **Start or remove** — Port 3100 dead. Gateway has it configured as AGENT_CODING_URL. If unused → remove from gateway .env |

---

### 🔴 MI-CORE — Broken (Fix Required, Not Remove)

| Issue | Fix |
|-------|-----|
| Model fuzzy match selecting qwen3:1.7b | Fix `selectModel()` in `ollama-router.ts` — exact match first |
| Gateway `/api/stats` — `getStatus is not defined` | Fix reference in `server.js:982` |

---

### 📦 Total Savings if Remove Candidates Applied

| Item | Saving |
|------|--------|
| ollama rm qwen3:1.7b | 1.4 GB disk, fixes model selection bug |
| ollama rm deepseek-r1:14b | 9.0 GB disk, 9.0 GB VRAM during use |
| Disable agent-coding-api-keys from gateway config | Removes dead ECONNREFUSED noise |
| **Total** | **10.4 GB disk freed** |

---

## Company OS Source Recruitment Policy — Removal Test

Per `source-inventory.ts`, a source is marked `REMOVE` if ANY of the following are true:

1. No ACTIVE department lists it in `tools[]`
2. Installed but zero usage in last 30 days
3. Superseded by another tool with same or better capability
4. Adds VRAM/CPU cost with no measurable output improvement
5. Import exists in source code but function never called
6. Breaks on current Node.js / Python runtime and has no fix
7. License incompatible with commercial use (AGPL without exception, SSPLv1, etc.)

**Confirmed REMOVE sources:** `qwen3:1.7b`, `deepseek-r1:14b`
**Updated:** 2026-06-18
