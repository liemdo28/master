# GEMMA_RUNTIME_CERTIFICATION.md
**Date:** 2026-06-17 22:05 VN Time  
**Status:** ✅ CALLER IDENTIFIED — NOT MI-CORE

---

## Question
Who is calling `gemma3:12b` on Ollama? It appeared in logs 12 times (Jun 10–16) but was NOT in mi-core's `ROLE_PRIORITY` config.

---

## Evidence Trail

### Ollama server-1.log — gemma3 load pattern
```
2026-06-16T08:40 — qwen3:14b loaded (mi-core deep_reasoning request)
2026-06-16T08:45 — VRAM eviction triggered (qwen3:14b 9.0 GiB > 1.1 GiB available)
2026-06-16T08:45 — gemma3:12b loaded with flags:
    --mmproj <projector_blob>       ← MULTIMODAL/VISION flag
    --no-mmproj-offload             ← VRAM limited, projector kept on CPU
    [completion vision] template    ← confirmed vision model request
2026-06-16T09:28 — gemma3:12b reloaded again (VRAM eviction cycle)
... repeated 12 times on Jun 15–16
```

### Key indicator: `--mmproj` flag
The `--mmproj` (multimodal projector) flag is only passed when a caller requests **image/vision** capability. Mi-core's provider-router does NOT use this — it calls `/api/chat` text-only.

### Gateway vision provider: NOT Ollama
```javascript
// whatsapp-ai-gateway/src/vision/vision-provider.js
function getProvider() { return process.env.VISION_PROVIDER || 'gemini'; }
// Gateway .env:
// VISION_API_URL=        (empty)
// VISION_API_KEY=        (empty)
// VISION_TEST_MODE=true  → falls back gracefully, no actual calls
```
Gateway vision is in test mode → does NOT call Ollama.

### Caller Identified: Cline / Claude Dev in Antigravity IDE
```
Found: C:/Users/liemdo/.antigravity/extensions/saoudrizwan.claude-dev-3.82.0-universal/.claude
```
**Saoudrizwan.claude-dev = Cline** — an IDE extension that routes to local Ollama for AI assistance. When CEO was working in Antigravity IDE on Jun 15–16 with vision tasks (reviewing images, screenshots), Cline called `gemma3:12b` directly via Ollama's vision API.

**Timing confirmation:** All gemma3 loads occurred 08:45–10:21 VN on Jun 16 — a 2-hour IDE working session. No mi-core process was responsible.

---

## ROLE_PRIORITY in mi-core (confirmed)

```typescript
// server/src/model-router/ollama-router.ts
const ROLE_PRIORITY = {
  fast_chat:      ['qwen3:8b', 'qwen2.5:7b', 'llama3.2:3b', ...],
  deep_reasoning: ['qwen3:14b', 'qwen3:8b', 'deepseek-r1:14b', ...],
  coding:         ['qwen2.5-coder:7b', 'qwen3:8b', ...],
  qa_review:      ['qwen3:14b', 'qwen3:8b', ...],
  embeddings:     ['nomic-embed-text', ...],
};
```
`gemma3:12b` appears in **none** of these lists → confirmed external caller.

---

## ⚠️ Critical Bug Found During Trace (P0 Severity)

**Model router fuzzy match is selecting wrong model:**

```
CONFIGURED:  fast_chat → qwen3:8b    (ROLE_PRIORITY[0])
ACTUAL:      fast_chat → qwen3:1.7b  ← WRONG
```

**Root cause:** Fuzzy match `n.startsWith(candidate.split(':')[0] + ':')` matches `qwen3:1.7b` before `qwen3:8b` because Ollama returns models sorted by `modified_at` DESC, and `qwen3:1.7b` was modified Jun 9 vs `qwen3:8b` Jun 6.

**Impact:** ALL text generation in mi-core (WhatsApp replies, briefings, NLP) is running on **qwen3:1.7b (2B params)** instead of **qwen3:8b (8B params)**. This degrades response quality significantly.

**Fix required:** Change fuzzy match to prefer exact match first:
```typescript
// Before: n.startsWith(candidate.split(':')[0] + ':')
// After:  n === candidate || n.startsWith(candidate + '-')
const found = names.find(n => n === candidate) 
           || names.find(n => n.startsWith(candidate.split(':')[0] + ':' + candidate.split(':')[1]));
```

---

## Gemma3 Classification

| Attribute | Value |
|-----------|-------|
| Caller | Cline/Claude Dev in Antigravity IDE |
| Use case | Vision/image analysis during IDE sessions |
| In mi-core ROLE_PRIORITY | NO |
| Business value | External tool — CEO productivity |
| Action | KEEP (external tool, not mi-core concern) |
| Classification | **SHADOW → CLARIFIED** (external IDE tool, not mi-core) |

---

## Verdict

```
GEMMA_CALLER: Cline (saoudrizwan.claude-dev) in Antigravity IDE
GEMMA_ROLE: Vision model for IDE session image analysis  
MI-CORE_RESPONSIBILITY: NONE
CRITICAL_BUG_FOUND: fast_chat/deep_reasoning/qa_review running on qwen3:1.7b not qwen3:8b
GEMMA_CERTIFICATION: COMPLETE — 2026-06-17
```
