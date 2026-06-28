# 🔴 STRESS CONVERSATION REPORT — Track R9

**Date:** 2026-06-15
**Target:** Mi-Core (mi-core)
**Red Team Status:** HIGH — IN-MEMORY ARCHITECTURE GUARANTEES DEGRADATION

---

## Executive Summary

Mi-Core's conversation storage is entirely in-memory (JavaScript Maps). At 100+ turns, memory pressure increases. At 200+ turns, the system risks OOM on long-lived sessions. At 500+ turns, context drift, duplicate replies, and wrong entity selection are **architecturally guaranteed** due to single-entity tracking, short TTLs, and FIFO trimming.

---

## ARCHITECTURE LIMITS

### Memory Storage Analysis

| Store | Max Entries | Eviction | Memory Per Entry |
|-------|-------------|----------|-----------------|
| `conversation-store.ts` (Jarvis) | Unlimited | TTL (10 min) | ~2KB per session |
| `conversation-memory.ts` (WhatsApp) | 20 turns per phone | FIFO trim + TTL (4 hr) | ~1KB per turn |
| `routes/chat.ts` (API) | 40 turns per session | FIFO trim | ~1KB per turn |
| Approval queue (gate.ts) | Unlimited | Manual | ~0.5KB per entry |
| Memory API (executive-memory) | Disk-based | None | Unlimited |

### Critical Bottleneck: In-Memory Maps

```
Server memory usage at various conversation lengths:
- 100 conversations × 20 turns = ~4MB (manageable)
- 500 conversations × 40 turns = ~20MB (noticeable)
- 1000 conversations × 40 turns = ~40MB (concerning)
- Plus: concurrent LLM context windows × Qwen3 model = GPU VRAM pressure
```

---

## STRESS TEST SCENARIOS

### Scenario 1: 100+ Turn Marathon Session

**Setup:** Single CEO, continuous conversation, 100 turns over 30 minutes

**Expected failures:**

| Turn Range | Issue | Impact |
|-----------|-------|--------|
| 1-20 | Normal operation | ✅ Working within conversation-memory limit |
| 21-40 | FIFO trim kicks in | ⚠️ Turn 1 data lost from conversation-memory |
| 41-60 | Conversation-store (10 min TTL) expired for early turns | ⚠️ Context lost for turns 1-30 |
| 61-80 | Entity confusion — 80+ entity switches | ❌ last_entity is unreliable |
| 81-100 | Duplicate responses possible | ❌ LLM generates similar responses to similar prompts |

**Specific failure pattern:**
```
Turn 1: "Raw Sushi status" → context: Raw Sushi
Turn 45: "Dashboard status" → context: Dashboard (Raw Sushi lost from FIFO)
Turn 70: "cái đó sao?" → Mi answers about Dashboard (correct)
Turn 90: "còn Raw Sushi?" → Mi CAN answer (explicit entity) but has no history context
```

---

### Scenario 2: 200+ Turn Multi-Day Conversation

**Setup:** CEO messages over 2 days, 200 total turns

**Expected failures:**

| Issue | Turn | Root Cause |
|-------|------|-----------|
| Session TTL expiration | Every 10+ min gap | conversation-store resets |
| Cross-day context loss | Day 1 → Day 2 | 4hr TTL means overnight context gone |
| Entity drift | 50+ entity switches | Only last_entity tracked |
| Duplicate replies | Similar prompts → similar responses | No dedup mechanism |
| Wrong entity selection | 9 entities confused across 200 turns | Keyword matching is unreliable at scale |
| Memory leak risk | Unbounded Map growth if TTL fails | No max-size cap on Maps |

**Key failure:** After 200 turns across 2 days, Mi has effectively zero context from Day 1. The CEO must re-explain everything.

---

### Scenario 3: 500+ Turn Stress Test

**Setup:** Heavy usage over 1 week, 500 total turns

**Expected failures:**

| Issue | Severity | Root Cause |
|-------|----------|-----------|
| Complete context loss for old topics | 🔴 Critical | TTL expiration + FIFO trimming |
| Duplicate responses to same question | 🔴 Critical | No response deduplication |
| Wrong entity selection | 🔴 Critical | 9-entity keyword matching breaks down |
| Memory pressure on Node.js | 🟠 High | Unbounded Map growth between TTL sweeps |
| Conversation-history FIFO at 20 turns | 🟠 High | 480 turns of history permanently lost |
| Cross-session contamination | 🟠 High | Multiple users on same phone number |

**Specific failure pattern at 500 turns:**
```
CEO asks: "Tóm tắt tuần này" (Summarize this week)
Mi responds: "Tuần này bạn đã hỏi về Raw Sushi và Dashboard." 
Reality: CEO asked about 15+ different topics across 500 turns. 
Mi only knows about the last entity and topic.
```

---

### Scenario 4: Concurrent Multi-User Stress

**Setup:** 5 different people messaging Mi simultaneously via WhatsApp groups

**Expected failures:**

| Issue | Root Cause |
|-------|-----------|
| Session collision | conversation-store keyed by sender, but group messages share context |
| Context bleeding | User A's context may influence User B's response |
| Rate limiter exhaustion | 5 concurrent users × rapid messages = rate limit hits |
| Memory pressure | 5 concurrent LLM sessions × context windows |

---

### Scenario 5: Rapid Message Burst

**Setup:** 50 messages in 1 minute (simulating voice-to-text rapid fire)

**Expected failures:**

| Issue | Root Cause |
|-------|-----------|
| Message ordering | No guaranteed ordering in async Express handlers |
| TTL clock reset | Each message resets the 10-min TTL, but old context is stale |
| Entity thrashing | last_entity changes 50 times in 1 minute |
| LLM queue backup | If using local Ollama, 50 rapid requests queue up |

---

## MEMORY LEAK ANALYSIS

### Potential Leak Points

1. **conversation-store.ts** — Map grows with each new sender. No max-size cap. If 10,000 unique senders message over weeks, the Map holds 10,000 entries until TTL sweep.

2. **conversation-memory.ts** — Capped at 20 turns per phone, but the Map itself grows with each unique phone number. No cleanup of old phone entries.

3. **approval/gate.ts** — Unbounded Map. If approvals are never completed, they accumulate forever.

4. **Session tokens (auth.ts)** — In-memory Set grows with each login. No expiry sweep.

### Memory Sweep Reliability

The TTL-based sweeps depend on:
- `setInterval()` calls running regularly
- No server overload preventing sweeps
- No clock skew issues

If the server is under heavy load, TTL sweeps may lag, causing memory to grow beyond expected limits.

---

## DUPLICATE REPLY ANALYSIS

### When Duplicates Occur

1. **Similar prompts → similar LLM responses:** If the CEO asks "Raw Sushi status" twice in 10 minutes, Mi may give nearly identical responses because the LLM has the same context.

2. **No response caching/dedup:** The system doesn't track what it already said. Each request goes through the full pipeline.

3. **FIFO trim + re-ask:** If the CEO asks about X (turn 1), asks about Y (turn 25, X trimmed), then asks about X again (turn 30), Mi responds as if it's the first time — no reference to the earlier discussion.

---

## CONTEXT DRIFT ANALYSIS

### How Drift Happens

1. **Entity drift:** Over 500 turns, `last_entity` cycles through 9+ entities dozens of times. The CEO's mental model of "what we're discussing" diverges from Mi's `last_entity`.

2. **Topic drift:** `last_topic` only captures the most recent topic. Multi-topic discussions (common for CEOs) are impossible to track.

3. **Language drift:** As the CEO switches between Vietnamese and English, the intent classifier may route to different brains, causing inconsistent response styles.

4. **Confidence drift:** As context quality degrades (old data, expired sessions), Mi's responses become less grounded in actual data and more LLM-hallucinated.

---

## VERDICT

**Stress Conversation Score: 1/10**

Mi-Core's in-memory architecture guarantees degradation at scale:
- **100 turns:** Context loss after 10-minute gaps, FIFO trimming of early turns
- **200 turns:** Cross-day context completely gone, entity confusion dominant
- **500 turns:** Effectively zero useful context, duplicate responses, wrong entity selection
- **Concurrent users:** Session collision, context bleeding, memory pressure

**A CEO using Mi intensively for a full work day (200+ messages) will experience severe context loss, wrong entity references, and the feeling that Mi has "amnesia."**
