# WhatsApp Entrypoint Proof

## Runtime Entrypoint

**File**: `services/whatsapp-ai-gateway/src/whatsapp/message-listener.js`
**Function**: `attach(client)` at line 381
**PM2 Process**: `mi-whatsapp-gateway`

### Entry Trace for "mi oi" message

```
client.on('message') fired [line 384]
  → handleTextMessage(client, msg) [line 395]
    → Dedup claim (line 591): messageDedupStore.claim(messageId, chatId, 'gateway_router')
    → Template OCR session check (line 611): no active session
    → Form photo session check (line 620): no active session
    → Voice check (line 632): not voice
    → handleAgentMiCommand (line 648): isMiCommand("mi oi") = FALSE
    → isNoPrefix("mi oi") = TRUE (line 830)
      → isCeoSender(phone) = TRUE → CEO admin confirmed
      → agentMiRouter.handleMiMessage({ text: '/mi mi oi', ... })
      → forwardToMi({ payload: { text: '/mi mi oi', client_id: 'mi-core', ... } })
        → HTTP POST http://localhost:4001/api/whatsapp/mi
        → Result: { ok: true/false, reply: "...", ... }
      → sendMiForwardResult({ forwardResult, ... })
        → sendMiForwardResult checks staleness/dedup
        → IF forwardResult.ok && forwardResult.reply → replyService.send(client, chatId, reply)
        → ELSE IF forwardResult.reply (error text) → sends error as fallback [COLLISION]
      → return (line 872)
    → IF no return (forward failed without fallback) → falls through
    → NLP GREETING block (line 877): nlp.intent === 'GREETING' = TRUE
      → replyService.send(client, chatId, nlp.greetingReply)
      → [COLLISION #2: Generic greeting sent]
      → return (line 884)
    → Safety gates (lines 890-956): passed
    → Generic AI reply (line 959): generateResponse('unknown', "mi oi")
      → [COLLISION #3 if GREETING didn't fire]
```

## Verified Entrypoint Files

| File | Function | Role |
|---|---|---|
| `services/whatsapp-ai-gateway/src/whatsapp/message-listener.js` | `attach(client)` | Main WA message entrypoint |
| `services/whatsapp-ai-gateway/src/whatsapp/message-listener.js` | `handleTextMessage(client, msg)` | Text message handler |
| `services/whatsapp-ai-gateway/src/whatsapp/message-listener.js` | `handleImageMessage(client, msg)` | Image message handler |
| `services/whatsapp-ai-gateway/src/whatsapp/message-listener.js` | `handleAgentMiCommand(...)` | `/mi` and `/agent` command routing |
| `services/whatsapp-ai-gateway/src/whatsapp/message-listener.js` | `sendMiForwardResult(...)` | Mi-core response dedup + send |
| `services/mi-ceo-observer/src/ceo-session.js` | `handleMessage(msg)` | CEO observer (read-only) |
| `server/src/routes/whatsapp.ts` | `POST /api/whatsapp/mi` | Mi-core WA endpoint |

## The Collision

When `forwardToMi` fails (mi-core unreachable), the code does NOT early-return.
The error-text reply (e.g., "Mi is not available on this bot...") gets sent as a
fallback greeting before mi-core has a chance to reply.

**Proof**: `sendMiForwardResult` at line 228-242 handles `forwardResult?.reply`
WITHOUT checking `forwardResult.ok` first. This means error replies get sent.

**Second collision**: `forwardResult.reply` (error text) populates the stale-guard
check (`latestInboundByChat`), so when mi-core eventually replies, the stale
message guard suppresses it.
