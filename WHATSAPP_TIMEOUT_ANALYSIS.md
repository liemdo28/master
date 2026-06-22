# WhatsApp Timeout Analysis

**Date**: 2026-06-18  
**Status**: COMPLETE — TIMEOUTS IDENTIFIED

---

## Timeout Chain

```
CEO WhatsApp Message
        │
        ▼ (WhatsApp protocol — real-time)
WhatsApp AI Gateway (session-manager + message-listener)
        │
        ▼ HTTP POST (TIMEOUT_MS = 15,000ms)
agent-mi-forwarder.js → http://localhost:4001/api/whatsapp/mi
        │
        ▼ (chat-queue: max wait 90s)
Mi-Core /api/whatsapp/mi → enqueueChat()
        │
        ▼ (pipeline execution — Ollama call)
runPipeline() → ai-service (port 4002) → Ollama (port 11434)
```

---

## Measured Timeouts

| Hop | Timeout | Source | Retries |
|---|---|---|---|
| Gateway → Mi-Core | **15,000ms** | `agent-mi-forwarder.js:19` | 0 (for mi-core) |
| Chat Queue wait + execution | **90,000ms** | `chat-queue.ts:14` | N/A |
| Mi-Core → Ollama (via ai-service) | **Inherited from Ollama config** | External process | N/A |
| WhatsApp heartbeat | **60,000ms** interval | `session-manager.js:377` | Continuous |
| WhatsApp auth timeout | **120,000ms** | `session-manager.js:266` | N/A |
| Reconnect delays | **15s → 30s → 60s → 120s** | `session-manager.js:33` | Unlimited |

---

## Concurrency Limits

| Resource | Limit | Source |
|---|---|---|
| Concurrent AI calls | **3** | `chat-queue.ts:10` `MAX_CONCURRENT` |
| Max queued requests | **20** | `chat-queue.ts:11` `MAX_QUEUED` |
| Rate limit per client | Per-config | `whatsapp-key-manager.ts` |

---

## Error Responses by Timeout Type

### 1. Gateway → Mi-Core timeout (15s)

**Trigger**: Mi-Core process not running or overloaded  
**Code**: `agent-mi-forwarder.js:123` — `'Request timeout after ' + timeoutMs + 'ms'`  
**User impact**: For mi-core client, `reply: null` is returned (no fallback sent to user)  
**Result**: CEO gets NO response (silent failure)

### 2. Chat Queue Full (>20 requests waiting)

**Trigger**: More than 20 concurrent WhatsApp queries  
**Code**: `chat-queue.ts:36` — `ChatQueueFullError`  
**User response**: `'Em đang bận xử lý nhiều việc cùng lúc — anh thử lại sau vài giây nhé.'`

### 3. Chat Queue Timeout (90s total)

**Trigger**: AI call takes too long (Ollama overloaded)  
**Code**: `chat-queue.ts:59` — `ChatTimeoutError`  
**User response**: `'Em đang bị chậm lúc này — AI engine mất quá lâu. Anh thử lại nhé, em vẫn đang hoạt động.'`

### 4. Generic timeout (regex match)

**Trigger**: Any error containing `timeout|aborted|timed out|ETIMEDOUT`  
**Code**: `whatsapp.ts:1096`  
**User response**: `'Em đang bị chậm lúc này — có thể do AI engine đang tải. Anh thử lại sau vài giây nhé. Em vẫn đang hoạt động.'`

### 5. LLM/Provider error

**Trigger**: Ollama/AI engine connection failure  
**Code**: `whatsapp.ts:1098`  
**User response**: `'Em chưa kết nối được AI engine lúc này. Em vẫn nhận được tin nhắn của anh — anh thử lại hoặc hỏi em câu khác nhé.'`

---

## Why "Mi-Core is temporarily unavailable" Was Returned

Based on code analysis, this specific text:
1. Is **NOT** present in current codebase
2. Was in a **previous version** of `safeErrorReply()` in `agent-mi-forwarder.js`
3. Current version returns Vietnamese graceful degradation messages
4. The text is now **actively blocked** by `BLOCKED_USER_FACING_PATTERNS` in both `reply-service.js` and `session-manager.js`

The most likely scenario:
- Gateway was running an **older version** that used English error messages
- Mi-Core was either down or timed out (15s threshold)
- Gateway's `safeErrorReply('mi-core')` returned the English error text
- This was before the outbound send guard was implemented

---

## Latency Estimates (from code analysis)

| Path | Average | P95 | Failure Threshold |
|---|---|---|---|
| Gateway → Mi-Core (healthy) | ~50ms (local HTTP) | ~200ms | 15,000ms |
| Mi-Core → Jarvis (deterministic) | ~5ms | ~20ms | N/A (sync) |
| Mi-Core → Ollama (AI pipeline) | ~2-10s | ~30-60s | 90,000ms |
| Mi-Core → Asset Registry | ~5ms | ~50ms | N/A (sync, SQLite) |
| Mi-Core → Department Runtime | ~5ms | ~50ms | N/A (sync, in-process) |

---

## Critical Finding

The **15-second gateway timeout** is the primary production risk:
- If Mi-Core takes >15s to respond (e.g., Ollama cold start), the gateway times out
- For mi-core forwards, `reply: null` is returned (no error message sent)
- CEO receives **no response at all** — appears as system dead

**Recommendation**: Increase `TIMEOUT_MS` to 95s (slightly above chat-queue's 90s max) to allow Mi-Core's internal queue to manage timeouts gracefully.
