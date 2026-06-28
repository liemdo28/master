# CALENDAR_ACTION_WORKFLOW_REPORT
**Generated:** 2026-06-09

## Test: T4 — "Tạo meeting với Maria 2PM mai"

```
Input: "Tao meeting voi Maria 2PM mai"
Mode: visibility_calendar
Route: chat.ts visibility_calendar handler → action pattern detected → pipeline
Action: CalendarActionService.createEvent()

NLP Extraction:
  title: "Meeting với Maria"
  attendees: ["Maria"] → resolvePerson("Maria") → { email: "maria@rawsushibar.com" }
  date: "mai/tomorrow" → 2026-06-10
  time: "2PM" → "14:00"
  duration: 60min (default)

Approval Draft:
  type: create-event
  risk: L2 (WRITE)
  description: "Create calendar event: Meeting với Maria on 2026-06-10 at 14:00"
  rollback: "Delete event from Google Calendar"

Response: "📅 Tạo event: Meeting với Maria
  📆 Ngày: Thứ Ba 2026-06-10
  🕑 Giờ: 14:00 (1 giờ)
  👥 Attendees: Maria (maria@rawsushibar.com)
  [Approve] [Edit] [Reject]"

✅ PASS — Real pipeline response, not built-in calendar stub
```

## Key Fix Applied: Intent Pre-routing

Original bug: `visibility_calendar` intent returned early with built-in response before pipeline reached.

Fix in `chat.ts`:
```typescript
if (intent === 'visibility_calendar') {
  const msg = message.toLowerCase();
  if (/t.o|create|schedule|meeting|l.ch/.test(msg)) {
    // Route to pipeline for action
    const pipelineOut = await runPipeline({ message, mode, history, intent: 'action' });
    return { reply: pipelineOut.reply, intent: 'action', ... };
  }
  // Otherwise: return calendar visibility snapshot
}
```

## CalendarActionService Date/Time Resolution

| Input | Resolved |
|---|---|
| "mai" / "tomorrow" / "ngày mai" | today + 1 day |
| "hôm nay" / "today" | today |
| "thứ 2" / "Monday" | next Monday |
| "10/6" / "June 10" | 2026-06-10 |
| "2PM" / "2 giờ chiều" | 14:00 |
| "9:30am" | 09:30 |
| "noon" / "trưa" | 12:00 |

## Free Slot Detection

`findFreeSlots(daysAhead=3)`:
1. Fetch `events_cache.json` for next N days
2. Work hours: 09:00–17:00
3. Mark busy times from existing events
4. Return 30-min free slots

Returns `CONNECTOR_NOT_CONFIGURED` if calendar cache absent.

## createEvent vs updateEvent vs cancelEvent

| Action | Level | Approval |
|---|---|---|
| createEvent | L2 | CEO approve once |
| updateEvent | L2 | CEO approve once |
| cancelEvent | L3 | Double approval required |

---
CALENDAR_ACTION_WORKFLOW_COMPLETE
