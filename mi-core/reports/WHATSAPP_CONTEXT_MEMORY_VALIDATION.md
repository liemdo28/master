# WhatsApp Context Memory Validation

**Date:** 2026-06-15T03:14:35.436Z

## Conversation Test Results

### Conversation A
```json
{
  "conv": "A",
  "raw_sushi_seo_then_la_sao": {
    "r1_handled": true,
    "session_entity": "Raw Sushi",
    "r2_replied": true
  }
}
```

### Conversation B
```json
{
  "conv": "B",
  "dashboard_then_task_due": {
    "r1_handled": true,
    "session": {
      "topic": "general",
      "entity": "Dashboard"
    }
  }
}
```

### Conversation C
```json
{
  "conv": "C",
  "stone_oak_then_ke_them": {
    "r1_handled": true,
    "session_entity": "Stone Oak"
  }
}
```

### Conversation D
```json
{
  "conv": "D",
  "briefing_then_con_gi_nua": {
    "r1_handled": false,
    "r2_replied": false,
    "note": "briefing engine requires warm DB"
  }
}
```

### Conversation E
```json
{
  "conv": "E",
  "three_turn": {
    "r1_handled": false,
    "r3_replied": false,
    "note": "LLM-bound follow-up — requires full pipeline in production"
  }
}
```

## Summary

Session store (conversation-store.ts) maintains per-sender context in-memory with 10-minute TTL.
Follow-up detection patterns: "là sao?", "rồi sao?", "kể thêm", "còn gì nữa?", "hả", "sao anh", etc.
Entity extraction: Raw Sushi, Stone Oak, Dashboard, Bakudan, Asana, WhatsApp Gateway, Review Automation.
Context injection: follow-up messages get [Chủ đề trước: X] [Em vừa trả lời: Y] prepended before routing.