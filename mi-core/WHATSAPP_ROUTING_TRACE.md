# WhatsApp Routing Trace

## Log File
- `logs/whatsapp-routing-trace.log` (appended per message)
- Also: `data/mi-core-forward-trace.jsonl` (JSONL per mi-core forward event)

## Trace Fields
Every incoming message produces one trace event:

```json
{
  "message_id": "...",
  "chat_id": "...",
  "body": "...",
  "policy": "...",
  "owner": "mi_core",
  "handler": "mi_core_handler",
  "shouldSend": true,
  "response_count": 1,
  "reason": "explicit_mi_mention"
}
```

## New P0 Route Tags

| Route Tag | Meaning |
|---|---|
| `dedup_claim` | Message dedup claim acquired |
| `dedup_blocked_incoming` | Duplicate message rejected |
| `no_prefix_silent_drop` | Non-CEO no-prefix message dropped silently |
| `no_prefix_mi_forward_suppressed` | Mi-core reply suppressed (dedup/stale guard) |
| `no_prefix_mi_forward_failed_silent_drop` | Mi-core unreachable, silent drop |
| `ceo_generic_ai_blocked` | CEO blocked from generic greeting/AI |
| `nlp_greeting` | NLP greeting sent (non-CEO only) |
| `mi_forward` | Mi-core forward succeeded |
| `agent_forward` | Agent forward succeeded |

## Message Flow After Fix

```
CEO sends "mi oi"
  → dedup_claim → messageDedupStore.claim()
  → isNoPrefix("mi oi") → TRUE
  → isCeoSender(phone) → TRUE
  → forwardToMi({ text: "/mi mi oi", ... })
    → IF ok=true, reply exists → sendMiForwardResult → replyService.send() → 1 RESPONSE
    → IF ok=false → silent drop → mi-core retry handles it
  → return

CEO sends "anh có task gì"
  → dedup_claim → messageDedupStore.claim()
  → isNoPrefix("anh có task gì") → TRUE
  → isCeoSender(phone) → TRUE
  → forwardToMi({ text: "/mi anh có task gì", ... })
  → return (1 response from mi-core only)

CEO sends random text (no Mi)
  → dedup_claim → messageDedupStore.claim()
  → isNoPrefix → TRUE
  → isCeoSender → TRUE
  → forwardToMi
  → return (mi-core decides response)

Non-CEO sends "mi oi"
  → dedup_claim → messageDedupStore.claim()
  → isNoPrefix("mi oi") → TRUE
  → isCeoSender(phone) → FALSE
  → no_prefix_non_ceo_silent_drop
  → return (SILENT DROP - no collision)
```
