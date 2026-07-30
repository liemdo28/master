# MI_GROUP_MODE_REPORT

Generated: 2026-06-12
Status: PASS

## Summary

Mi stays silent in group chats unless a message starts with `/mi`.
Activated by `/mi` from any group member (CEO or staff).

## Behavior

| Scenario | Behavior |
|---|---|
| Group message without /mi | Silent `reply: ""` — `intent: group_silent` |
| Group message with /mi prefix | Mi processes and replies |
| Non-CEO group /mi | Mi replies (group mode allows all members to invoke) |
| CEO gate | CEO gate only applies to private chat (`is_group=false`) |

## Flow

```
is_group=true + text has no /mi prefix
  → normalizeMessage(text).isMiCommand = false
  → return { reply: '', intent: 'group_silent' }

is_group=true + text starts with /mi
  → normalizeMessage strips /mi prefix
  → continues to skill routing → human assistant → pipeline
```

## Payload Fields

- `is_group: boolean` — required for group mode
- `group_id: string` — group identifier (optional)

## Validation

- Group message without /mi → `reply:""`, `intent:group_silent` ✅
- Group message with `/mi tóm tắt tình hình` → non-empty reply ✅
- Non-CEO in group with /mi → non-empty reply ✅

## Verdict: PASS
