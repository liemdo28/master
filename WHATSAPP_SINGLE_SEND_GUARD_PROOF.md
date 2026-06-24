# WhatsApp Single Send Guard — Phase 21.7 Proof

## Date: 2026-06-22

---

## Implementation

### File: `src/sessions/whatsapp-send-guard.js`

- In-memory Map keyed by inbound `message_id`
- TTL: 10 minutes per message
- Auto-cleanup every 60 seconds

### API

```js
beginMessage(messageId, owner, responseType)
  → { canSend: boolean, reason: string }

recordSend(messageId, owner, responseType)

canSend(messageId)
  → boolean
```

### Hard Rule

Each inbound `message_id` can trigger at most ONE outbound response.

If second send is attempted:
- `canSend` returns `false`
- Event logged: `SEND_BLOCKED_DUPLICATE`

---

## Integration Points

| Location | Purpose | Behavior |
|----------|---------|----------|
| `message-listener.js` → `sendMiForwardResult()` | Block duplicate text+image sends | If send guard rejects, response is suppressed |
| `message-listener.js` → no-prefix handler | Block duplicate local replies | Second send blocked before `replyService.send()` |
| `message-listener.js` → dedup gate (existing) | Pre-filter at message entry | Already blocks duplicate message processing |

---

## Defense Layers (Defense in Depth)

```
Layer 1: messageDedupStore.claim() — blocks duplicate message processing
Layer 2: centralSessionManager.assertOwner() — blocks wrong-owner handlers  
Layer 3: sendGuard.beginMessage() — blocks duplicate outbound sends
Layer 4: responseLocks (existing) — blocks stale success replies
```

---

## Trace Evidence

All blocks are traced to `mi-core-forward-trace.jsonl`:

```json
{
  "event": "outbound_blocked_send_guard",
  "messageId": "true_120363000000000000@g.us",
  "route": "no_prefix_mi_forward",
  "suppress_reason": "send_guard_duplicate"
}
```
