# WHATSAPP ROUTING TRACE
> Phase 21.6 CEO Directive P0 | Generated: 2026-06-22

## Trace File
`data/routing-trace.jsonl` (newline-delimited JSON)

## Log Schema

```json
{
  "message_id": "string — WhatsApp message ID",
  "chat_id": "string — WhatsApp chat ID",
  "sender": "string — sender phone",
  "owner": "string — mi_core | food_safety | marketing_preview | team_support | unknown_no_reply",
  "intent": "string — mi_command | food_safety_submission | silent_drop | etc.",
  "selected_handler": "string — same as owner",
  "response_sent": "boolean — true if router sent exactly one response",
  "timestamp": "string — ISO 8601",
  "decision_reason": "string — why this owner was selected",
  "confidence": "number — 0.0 to 1.0",
  "policy": "string — food_safety | marketing | team_support | admin | general",
  "group_name": "string — WhatsApp group name",
  "is_group": "boolean"
}
```

## Sample Entries

```json
{"message_id":"false_931234567@c.us_ABC123","chat_id":"931234567@c.us","sender":"84931773657","owner":"mi_core","intent":"mi_command","selected_handler":"mi_core","response_sent":true,"timestamp":"2026-06-22T09:00:00.000Z","decision_reason":"mi_pattern: /^mi\\s+ơi/i","confidence":1.0,"policy":"admin","group_name":"CEO Chat","is_group":false}
{"message_id":"false_931234567@c.us_DEF456","chat_id":"931234567@c.us","sender":"84931773657","owner":"unknown_no_reply","intent":"silent_drop","selected_handler":"unknown_no_reply","response_sent":false,"timestamp":"2026-06-22T09:00:05.000Z","decision_reason":"no_matching_intent","confidence":1.0,"policy":"admin","group_name":"CEO Chat","is_group":false}
{"message_id":"false_1203630000@g.us_GHI789","chat_id":"1203630000@g.us","sender":"84900001111","owner":"food_safety","intent":"food_safety_submission","selected_handler":"food_safety","response_sent":true,"timestamp":"2026-06-22T09:01:00.000Z","decision_reason":"food_safety_group_image","confidence":1.0,"policy":"food_safety","group_name":"Bakudan Food Safety Team","is_group":true}
```

## Validation Queries

### Count responses per owner
```bash
cat data/routing-trace.jsonl | jq -r '.owner' | sort | uniq -c | sort -rn
```

### Find duplicate message_ids (should be 0)
```bash
cat data/routing-trace.jsonl | jq -r '.message_id' | sort | uniq -c | awk '$1 > 1'
```

### Count responses per chat_id
```bash
cat data/routing-trace.jsonl | jq -r 'select(.response_sent==true) | .chat_id' | sort | uniq -c | sort -rn
```

### Check for multi-response chats
```bash
cat data/routing-trace.jsonl | jq -r 'select(.response_sent==true) | .message_id' | sort | uniq -d | wc -l
# Should be 0
```

## Anti-Patterns to Detect

| Pattern | Means | Log Field |
|---------|-------|-----------|
| 2+ response_sent=true for same message_id | COLLISION | message_id dup |
| message_id appears twice with different owners | LEAK | message_id dup |
| response_sent=true + owner=unknown_no_reply | LOGIC ERROR | owner mismatch |

## Certified: TRACE_ENABLED
Router writes to routing-trace.jsonl on every call
