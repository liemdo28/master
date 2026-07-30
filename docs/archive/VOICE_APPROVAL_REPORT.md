# VOICE_APPROVAL_REPORT.md

**Phase 3: Approval Voice**
**Date:** 2026-06-16
**Status:** ✅ COMPLETE

---

## Requirement

Every approval workflow must generate:
- Text summary (already exists)
- **Voice summary** (20-second explanation)

Example: SEO Raw Sushi approval → 20-second voice explanation.

## Implementation

### `approvalToVoiceText(description, category)`

```typescript
export function approvalToVoiceText(description: string, category: string): string {
  const clean = description
    .replace(/\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
  return `Yêu cầu phê duyệt. ${clean}. Vui lòng xác nhận để tiến hành.`;
}
```

### Flow

```
Action enqueued → Approval Gate (Level 2/3)
  → Voice: approvalToVoiceText(description, category)
    → VieNeu-TTS → MP3
      → WhatsApp voice note to CEO (with approval request)
```

### Example: SEO Raw Sushi

**Raw approval:**
```
[L3] Approval required: SEO Raw Sushi — deploy new page on bakudanramen.com
```

**Voice text:**
```
Yêu cầu phê duyệt. SEO Raw Sushi — deploy new page on bakudanramen.com. Vui lòng xác nhận để tiến hành.
```

**Audio:** ~8 seconds, concise, executive tone.

### Integration with Voice Orchestrator

The `orchestrateVoiceOutput()` already handles approval:
- **CEO recipient:** `skipped_ceo` — sends voice note immediately
- **Non-CEO:** `pending_approval` — text notification sent to CEO, voice note held

### API Endpoint

```bash
# Generate approval voice note
curl -X POST http://localhost:4001/api/voice/output/send \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Yêu cầu phê duyệt. SEO Raw Sushi — deploy new page. Vui lòng xác nhận để tiến hành.",
    "is_ceo": true,
    "workflow_id": "approval-seo-raw-sushi-001"
  }'
```

### Evidence Record

```json
{
  "workflow_id": "approval-seo-raw-sushi-001",
  "approval_status": "skipped_ceo",
  "voice": "vi-VN-HoaiMyNeural",
  "text_content": "Yêu cầu phê duyệt. SEO Raw Sushi — deploy new page..."
}
```

## Approval Gate Integration

| Recipient | Voice Behavior |
|-----------|---------------|
| CEO | Voice note sent immediately with approval summary |
| Non-CEO | Voice note queued; CEO gets text notification with approve/reject command |

## Files

| File | Purpose |
|------|---------|
| `server/src/voice/voice-personality.ts` | `approvalToVoiceText()` |
| `server/src/voice/voice-output-orchestrator.ts` | Uses personality for approval messages |
