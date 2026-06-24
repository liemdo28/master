# ACTIVE_BRAIN_CONSOLIDATION.md
**Date:** 2026-06-17 22:10 VN Time  
**Mission:** Eliminate installed-but-unused. Repair broken. Identify true brain.

---

## CLASSIFICATION TABLE

| Component | Installed | Loaded | Called | Business Value | Status | Action |
|-----------|-----------|--------|--------|----------------|--------|--------|
| **qwen3:8b** | ✅ | ✅ | ✅ 710 chats/7d | Primary AI brain for all WhatsApp | **ACTIVE** | Keep |
| **qwen3:14b** | ✅ | ✅ | ✅ 14 loads/7d | Deep reasoning, review | **ACTIVE** | Keep |
| **nomic-embed-text** | ✅ | ✅ | ✅ 12 loads/7d | Knowledge search, BigData indexing | **ACTIVE** | Keep |
| **gemma3:12b** | ✅ | ✅ | ✅ 12 loads/7d | Vision — IDE tool (Cline), NOT mi-core | **SHADOW→CLARIFIED** | Keep (external) |
| **qwen2.5-coder:7b** | ✅ | ❌ | ❌ 0 calls | Coding role — never triggered | **INSTALLED_NOT_USED** | Monitor 14d |
| **deepseek-r1:14b** | ✅ | ❌ | ⚠️ 1 call | Shadowed by qwen3:14b (9GB wasted) | **DEPRECATED** | **REMOVE** |
| **qwen3:1.7b** | ✅ | ❌ | ⚠️ 1 test | No config role. BREAKING model selection | **DEPRECATED** | **REMOVE NOW** |
| **Mi-Core Server** | ✅ | ✅ | ✅ 521 msgs/7d | CEO OS backbone | **ACTIVE** | Keep |
| **WhatsApp Gateway** | ✅ | ✅ | ✅ 521 fwd/7d | CEO communication layer | **ACTIVE** | Keep |
| **Jarvis Phase 30** | ✅ | ✅ | ✅ Every message | NLP + personality layer | **ACTIVE** | Keep |
| **GStack/Intent Router** | ✅ | ✅ | ✅ Every message | Vietnamese NLP routing | **ACTIVE** | Keep |
| **Executive Briefing** | ✅ | ✅ | ✅ 2x/day | Daily CEO report | **ACTIVE** | Keep |
| **Proactive Monitor** | ✅ | ✅ | ✅ Every 15min | System health watch | **ACTIVE** | Keep |
| **Scheduler** | ✅ | ✅ | ✅ Every 30min | Visibility sync | **ACTIVE** | Keep |
| **Self-Heal O9** | ✅ | ✅ | ✅ Every 5min | Auto-recovery | **ACTIVE** | Keep |
| **BigData Foundation** | ✅ | ✅ | ✅ At boot+query | Data pipeline | **ACTIVE** | Keep |
| **Knowledge DB** | ✅ | ✅ | ✅ Query-time | 7,455 doc store | **ACTIVE** | Keep |
| **Operational Memory** | ✅ | ✅ | ✅ Recovered | 177 exec / 92 incidents | **ACTIVE (restored)** | Keep |
| **Council (Phase 21)** | ✅ | ✅ | ❌ 0 triggers | Risky-decision gate | **INSTALLED_NOT_USED** | Stub OK |
| **Digital Twin (Phase 24)** | ✅ | ✅ | ❌ 0 triggers | Failure simulation | **INSTALLED_NOT_USED** | Stub OK |
| **Health Intel (Phase 23)** | ✅ | ✅ | ❌ 0 triggers | Biometric tracking | **INSTALLED_NOT_USED** | Stub OK |
| **mi-ceo-observer** | ✅ | ❌ | ❌ Not in PM2 | CEO chat observation | **SHADOW** | Start or drop |
| **agent-coding-api-keys** | ✅ | ❌ | ❌ Port dead | LLM API routing | **SHADOW** | Remove from gateway .env |
| **Gateway /api/stats** | ✅ | ✅ | ❌ BROKEN | Dashboard stats | **BROKEN** | Fix `getStatus` ref |

---

## P0 — Completed ✅

### Operational Memory Restored
- **Problem:** `memory.db` inaccessible — never initialized (mi-core was down)
- **Fix:** `POST /api/memory/sync` triggered `getDb()` → created DB → populated
- **Result:** 177 executions, 92 incidents, 545 ledger entries synced
- **Cross-session recall:** `GET /api/memory/trends` returns historical data across projects
- **Certification:** [MEMORY_RECOVERY_CERTIFICATION.md](MEMORY_RECOVERY_CERTIFICATION.md)

---

## P1 — Completed ✅

### Gemma Caller Traced
- **Caller:** Cline (saoudrizwan.claude-dev) in Antigravity IDE
- **How:** Cline calls Ollama directly with `--mmproj` (multimodal/vision) for image analysis during IDE sessions
- **Not mi-core:** Gateway vision is in test mode (VISION_TEST_MODE=true, no API keys)
- **Certification:** [GEMMA_RUNTIME_CERTIFICATION.md](GEMMA_RUNTIME_CERTIFICATION.md)

### Model Router Traced — Critical Bug Found

**ROLE_PRIORITY (configured):**
```
fast_chat      → qwen3:8b      (intended)
deep_reasoning → qwen3:14b     (intended)
coding         → qwen2.5-coder:7b
qa_review      → qwen3:14b     (intended)
embeddings     → nomic-embed-text
```

**ACTUAL RUNTIME SELECTION (broken):**
```
fast_chat      → qwen3:1.7b    ← WRONG (2B model)
deep_reasoning → qwen3:1.7b    ← WRONG (2B model)
coding         → qwen2.5-coder:7b ← correct
qa_review      → qwen3:1.7b    ← WRONG (2B model)
embeddings     → nomic-embed-text ← correct
```

**Bug:** Fuzzy match `startsWith('qwen3:')` hits `qwen3:1.7b` (modified Jun 9) before `qwen3:8b` (modified Jun 6) because Ollama returns models sorted by `modified_at` DESC.

**Fix:** Remove `qwen3:1.7b` (immediate fix) OR change `selectModel()` to exact-match first.

---

## P2 — Remove Candidates

| Action | Saving |
|--------|--------|
| `ollama rm qwen3:1.7b` | 1.4 GB disk + **fixes model selection bug** |
| `ollama rm deepseek-r1:14b` | 9.0 GB disk |
| Remove `AGENT_CODING_URL` from gateway .env | Eliminates dead ECONNREFUSED |
| **Total** | **10.4 GB freed** |

Full list: [REMOVE_CANDIDATES.md](REMOVE_CANDIDATES.md)

---

## Immediate Fix Required: Model Router Bug

```typescript
// server/src/model-router/ollama-router.ts
// CURRENT (broken):
const found = names.find(n => n === candidate || n.startsWith(candidate.split(':')[0] + ':'));

// FIXED:
const found = names.find(n => n === candidate)
           ?? names.find(n => n.startsWith(candidate.split(':')[0] + ':' + candidate.split(':')[1].charAt(0)));
```

Or simplest fix: `ollama rm qwen3:1.7b` removes the ambiguous prefix match immediately.

---

## Final State

```
TRUE_ACTIVE_STACK → [TRUE_ACTIVE_STACK.md]
REMOVE_CANDIDATES → [REMOVE_CANDIDATES.md]
MEMORY_CERTIFICATION → [MEMORY_RECOVERY_CERTIFICATION.md]
GEMMA_CERTIFICATION → [GEMMA_RUNTIME_CERTIFICATION.md]

ACTIVE_BRAIN_CONSOLIDATION — COMPLETE 2026-06-17
```
