# MI_QUOTED_MESSAGE_MODE_REPORT

Generated: 2026-06-12
Status: PASS

## Summary

Mi reads quoted messages as context when CEO replies with `/mi` to a group message.

## Behavior

| Scenario | Behavior |
|---|---|
| Reply to message + /mi | Mi reads quoted text as context, enriches AI response |
| /mi phân tích with quoted | Quoted sender and text prepended to pipeline input |
| No quoted message + /mi | Mi processes plain message normally |

## Implementation

```
quoted_message: { sender: 'David', sender_name: 'David', text: '...' }
  → quotedContext = "[Quoted from David]: \"...\""
  → pipelineMessage = quotedContext + "\n\n" + normalized
  → runPipeline({ message: pipelineMessage, ... })
```

Quoted context is also passed to skill handlers via `context` field.

## Supported Payload

```json
{
  "source": "whatsapp",
  "is_group": true,
  "text": "/mi phân tích",
  "quoted_message": {
    "sender": "+84...",
    "sender_name": "David",
    "text": "Walk-in cooler broken, temp at 42F"
  }
}
```

## Validation

- POST with quoted_message + `/mi phân tích` → non-empty contextual reply ✅
- Skill `action-item-extraction` uses `context` field from quoted message ✅

## Verdict: PASS
