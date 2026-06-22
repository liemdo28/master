# WHATSAPP OWNERSHIP ROUTER — Technical Specification
> Phase 21.6 CEO Directive P0 | Generated: 2026-06-22

---

## Executive Summary

The WhatsApp Ownership Router enforces **ONE MESSAGE → ONE OWNER → ONE RESPONSE** across all WhatsApp traffic handled by mi-core.

**File:** `services/whatsapp-ai-gateway/src/routing/whatsapp-ownership-router.ts`

---

## Architecture

```
Incoming WhatsApp Message
            │
            ▼
    ┌───────────────────┐
    │  1. DEDUP CHECK   │  ← message-dedup-store.ts (24h TTL)
    │  message_id seen? │
    └────────┬──────────┘
             │ blocked
             ▼
    ┌───────────────────┐
    │  2. GROUP POLICY  │  ← Resolve by group name
    │  RESOLVER         │    food_safety | marketing | team | admin | general
    └────────┬──────────┘
             ▼
    ┌───────────────────┐
    │  3. INTENT        │  ← Pattern matching on text + context
    │  DETECTION        │    mi_command | food_safety_submission | etc.
    └────────┬──────────┘
             ▼
    ┌───────────────────┐
    │  4. OWNERSHIP     │  ← ONE of:
    │  RESOLVER         │    mi_core | food_safety | marketing_preview
    └────────┬──────────┘    team_support | unknown_no_reply
             ▼
    ┌───────────────────┐
    │  5. DEDUP CLAIM   │  ← Atomic claim (race condition protection)
    └────────┬──────────┘
             │ claimed
             ▼
    ┌───────────────────┐
    │  6. HANDLER       │  ← Handler returns { owner, confidence,
    │  EXECUTION        │    response, shouldSend }
    └────────┬──────────┘
             │ proposed response
             ▼
    ┌───────────────────┐
    │  7. ROUTER SEND   │  ← ONLY router can send WhatsApp messages
    │                   │    replyFn(chatId, text, media?)
    └───────────────────┘
             │
             ▼
    ┌───────────────────┐
    │  8. TRACE LOG     │  ← routing-trace.jsonl
    └───────────────────┘
```

---

## Ownership Selection Rules

### mi_core

Triggered when ANY of:
- Message text matches: `/^mi\s+ơi/i`, `/^mi\s+$/i`, `/@mi\b/i`
- Sender is in `MI_CEO_WHATSAPP_IDS` env var
- Active mi_core session exists for this chatId
- Group policy = "admin" and sender is CEO

### food_safety

Triggered when ANY of:
- Group name includes: "food safety", "an toàn thực phẩm", "food-safety"
- Message has image AND group policy = food_safety
- Active food_safety session exists for this chatId

### marketing_preview

Triggered when ANY of:
- Message text matches: `/duyệt|approve|approved|đồng ý/i`
- Message text matches: `/draft.*preview|preview.*draft/i`
- Message text matches: `/bản\s+nháp/i`
- Active marketing_preview session exists for this chatId

### team_support

Triggered when ANY of:
- Message text matches: `/\bhelp\b/i`, `/\bsupport\b/i`, `/hỗ\s+trợ/i`

### unknown_no_reply

Everything else → NO RESPONSE.

---

## Allowed Owners (Enum)

```typescript
export type OwnerType =
  | 'mi_core'
  | 'food_safety'
  | 'marketing_preview'
  | 'team_support'
  | 'unknown_no_reply';
```

---

## Handler Contract

Handlers **MUST NOT** call `replyService.send()` directly.

Handlers **MUST** return:

```typescript
interface HandlerResponse {
  owner: OwnerType;
  confidence: number;      // 0.0 – 1.0
  response: string | null;
  evidence: string;        // Why this response was chosen
  shouldSend: boolean;
  mediaPath?: string;
  mediaCaption?: string;
}
```

Handler registration:

```typescript
import { registerHandler, routeMessage, type IncomingMessage } from './whatsapp-ownership-router';

registerHandler('mi_core', async (msg: IncomingMessage, decision) => {
  const response = await callMiCore(msg.text);
  return {
    owner: 'mi_core',
    confidence: 0.95,
    response,
    evidence: 'ceo_sender + mi_pattern',
    shouldSend: true,
  };
});
```

---

## Router API

```typescript
// Entry point — route a single message
const decision = await routeMessage(msg, async (chatId, text, media) => {
  await replyService.send(client, chatId, text);
  if (media?.path) {
    await replyService.sendMediaFile(client, chatId, media.path, media.caption);
  }
  return true;
});

// Query
const stats = getDedupStats(); // { size: number, ttl_ms: number }
```

---

## Dedup Rules

| Rule | Value |
|------|-------|
| TTL | 24 hours minimum |
| Key | `messageId` |
| Duplicate check | `isDuplicate()` — blocks reprocessing |
| Claim | `claim()` — atomic, race-condition safe |
| Status update | `updateStatus()` — tracks processing/completed/failed |
| Cleanup | Every 5 minutes, removes entries > 24h old |

---

## Session Isolation

Sessions are scoped by `chatId + owner`:

```
chatId::mi_core        → Mi-Core session only for this chat
chatId::food_safety    → Food Safety session only for this chat
chatId::marketing_preview → Marketing session only for this chat
```

**Cross-owner leakage is impossible** because each owner's session is a separate Map key.

---

## Runtime Logging

Every routing decision is written to `data/routing-trace.jsonl`:

```json
{
  "message_id": "...",
  "chat_id": "...",
  "sender": "...",
  "owner": "mi_core",
  "intent": "mi_command",
  "selected_handler": "mi_core",
  "response_sent": true,
  "timestamp": "2026-06-22T09:00:00.000Z",
  "decision_reason": "mi_pattern: /^mi\\s+ơi/i",
  "confidence": 1.0,
  "policy": "admin",
  "group_name": "CEO Chat",
  "is_group": false
}
```

---

## Migration Path

The existing `message-router-owner.js` (JS) will be deprecated in favor of `whatsapp-ownership-router.ts` (TypeScript).

**Phase 1:** Deploy `whatsapp-ownership-router.ts` alongside existing code. Register handlers for each owner. Validate with trace logs.

**Phase 2:** Update `message-listener.js` to call `routeMessage()` instead of calling handlers directly.

**Phase 3:** Remove direct `replyService.send()` calls from all handlers.

**Phase 4:** Remove `message-router-owner.js` once no consumers remain.

---

## Hard Rules (Non-Negotiable)

1. **ONE response per message_id.** Dedup gate is non-bypassable.
2. **Only router sends.** Handlers return; router dispatches.
3. **Owner is final.** Once claimed, no other handler may respond.
4. **Session isolation.** `chatId + owner` scope prevents cross-contamination.
5. **TTL enforced.** 24h minimum, automatic cleanup.
