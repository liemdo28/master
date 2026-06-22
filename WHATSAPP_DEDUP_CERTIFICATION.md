# WhatsApp Dedup Certification

## Dedup Store: `services/whatsapp-ai-gateway/src/routing/message-dedup-store.js`

### Implementation
- **Type**: In-memory Map with TTL cleanup
- **Class**: `MessageDedupStore`
- **Singleton**: `dedupStore` exported at line 157

### Claim Flow
```
messageDedupStore.claim(messageId, chatId, 'gateway_router')
  → If already claimed (within TTL) → { claimed: false, existing }
  → If not claimed → store entry, status='processing' → { claimed: true }
```

### TTL
- **24 hours** (24 * 60 * 60 * 1000 ms)
- **Cleanup interval**: Every 5 minutes
- **Expired entries**: Auto-deleted on check AND on cleanup

### Status Values
- `processing`: Message is being handled
- `completed`: Handler finished successfully
- `failed`: Handler encountered error

### Message Flow Integration
Called at line 591 of `message-listener.js`:
```js
const dedupResult = messageDedupStore.claim(inboundMessageId, chatId, 'gateway_router');
if (!dedupResult.claimed) {
  log.info('[MESSAGE_FLOW] dedup_blocked_incoming', { ...runtimeTraceBase, route: 'dedup_rejected' });
  return; // Exactly one response — this message already has its owner
}
```

### Dedup Key Priority
1. `message_id` (from WhatsApp message `msg.id._serialized`)
2. Fallback: `chat_id + timestamp_bucket + normalized_body` (via `getResponseLockKey`)

### Certification
- ✅ 24-hour TTL implemented
- ✅ Duplicate message returns immediately (no handler execution)
- ✅ Claim returns existing owner info
- ✅ Status tracking (processing/completed/failed)
- ✅ Periodic cleanup of expired entries
- ✅ Singleton pattern ensures global dedup across all message handlers
