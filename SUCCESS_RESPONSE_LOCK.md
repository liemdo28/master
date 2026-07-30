# SUCCESS_RESPONSE_LOCK.md

## P1 — Success Response Lock

Status: **IMPLEMENTED**
Date: 2026-06-17

---

## Objective

After a successful workflow response has been delivered to CEO on WhatsApp, **LOCK** the conversation state so that no secondary callback may send:

- "unavailable"
- timeout messages
- retry messages
- fallback messages

---

## Implementation (Already Deployed)

The Success Response Lock is implemented in:

**`E:\Project\Master\whatsapp-ai-gateway\src\whatsapp\message-listener.js`**

### Lock Mechanism: `sendMiForwardResult()` (line 134)

```
┌─────────────────────────────────────────────────┐
│            INBOUND CEO MESSAGE                  │
│         (WhatsApp → Gateway)                    │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│     Forward to Mi-Core (/api/whatsapp/mi)       │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│     sendMiForwardResult() — LOCK GATE           │
│                                                 │
│  CHECK 1: latestInboundByChat                   │
│    → If newer inbound exists, suppress stale    │
│      success (outbound_suppressed_stale_success)│
│                                                 │
│  CHECK 2: responseLocks.get(lockKey).finalSent  │
│    → If already sent, suppress duplicate        │
│      (outbound_suppressed_duplicate_success)    │
│                                                 │
│  ON SUCCESS (forwardResult.ok === true):        │
│    → Send reply to WhatsApp                     │
│    → SET responseLocks[lockKey] = {             │
│        ts, finalSent: true,                     │
│        status: 'execution_success',             │
│        workflowId, approvalId, route            │
│      }                                          │
│    → SET recentMiSuccesses[recentKey] = {       │
│        ts, workflowId, approvalId, route        │
│      }                                          │
│                                                 │
│  ON FAILURE (forwardResult.ok === false):       │
│    → Log only. NEVER send to user.              │
│    → Trace: outbound_suppressed_failure_reply   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Lock Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `RESPONSE_LOCK_TTL_MS` | 120,000 ms (2 min) | Lock expiry window |
| `responseLocks` | Map<string, LockEntry> | Per-message dedup |
| `recentMiSuccesses` | Map<string, SuccessEntry> | Per-chat+text dedup |
| `latestInboundByChat` | Map<string, messageId> | Stale response guard |

### Lock Key Resolution

```javascript
function getResponseLockKey({ msg, chatId, text }) {
  const id = getInboundMessageId(msg);
  if (id) return `msg:${id}`;              // Preferred: message ID based
  return `chat:${chatId}:${normalized}`;   // Fallback: chat+text based
}
```

---

## Rules Enforced

| Rule | Implementation |
|------|---------------|
| First successful Mi execution response wins | `lock.finalSent` check before send |
| Duplicate success for same inbound is suppressed | `responseLocks` with `finalSent: true` |
| Mi failure fallback replies are suppressed | `forwardResult.ok === false` → log only |
| Recent same-chat success blocks late fallback | `recentMiSuccesses` check |
| Stale success for outdated message is suppressed | `latestInboundByChat` comparison |

---

## Additional Protection Layers

### Layer 2: Operating Model Router (line 39)

```javascript
function logSuppressedMiFallback(route, fwd, detail = {}) {
  if (!fwd?.reply || fwd.ok) return;
  log.warn('Suppressed Mi-Core failure fallback reply', { ... });
}
```

Mi-Core failure responses are logged but never sent from the operating model router.

### Layer 3: Outbound Send Guard (line 349)

```javascript
function installOutboundSendGuard(client) {
  client.sendMessage = async (to, content, options) => {
    if (replyService.isBlockedUserFacingText(text)) {
      log.warn('[MESSAGE_FLOW] blocked_banned_raw_sendMessage', { ... });
      return null;
    }
    return originalSendMessage(to, content, options);
  };
}
```

Final safety net: even if code bypasses other checks, banned text patterns are blocked at the `client.sendMessage` level.

### Layer 4: Self-Echo Ignore (line 248)

```javascript
function isMiExecutionReplyText(text) {
  return /SEO-CONTENT-\d{8}-\d+|Approval ID:\s*\*?APPR-|.../i.test(body);
}
```

Prevents Mi's own successful replies from being re-processed as new inputs.

---

## Blocked Messages After Success Lock

After `responseLocks[key].finalSent === true`, the following are **permanently blocked** for that conversation turn:

- ❌ `safeErrorReply()` output (Vietnamese graceful degradation)
- ❌ Any `forwardResult.reply` when `forwardResult.ok === false`
- ❌ Duplicate success sends
- ❌ Late/stale responses from slow Mi-Core processing

---

## Trace Evidence

All lock decisions are recorded in:

```
E:\Project\Master\whatsapp-ai-gateway\data\mi-core-forward-trace.jsonl
```

Each entry contains:
- `event`: `outbound_sent_success` | `outbound_suppressed_*`
- `inbound_message_id`
- `workflow_id`
- `approval_id`
- `suppress_reason` (when applicable)

---

## Verdict

**SUCCESS_RESPONSE_LOCK: ACTIVE**

No secondary callback can send unavailable/timeout/retry/fallback to CEO after a successful response has been delivered. The lock is enforced at 4 independent layers in the gateway.
