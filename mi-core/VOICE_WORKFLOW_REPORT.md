# VOICE_WORKFLOW_REPORT.md

**Phase 4: Workflow Voice**
**Date:** 2026-06-16
**Status:** ✅ COMPLETE

---

## Requirement

SEO, Payroll, QB, Dashboard workflows must generate contextual voice evidence.

## Implementation

### `workflowToVoiceText(workflow_name, status, details)`

```typescript
export function workflowToVoiceText(workflow_name: string, status: string, details: string): string {
  const statusMap = {
    completed: 'hoàn thành',
    running: 'đang thực hiện',
    failed: 'thất bại',
    pending: 'đang chờ',
  };
  const statusVi = statusMap[status.toLowerCase()] || status;
  return `Cập nhật quy trình ${workflow_name}: ${statusVi}. ${details.slice(0, 100)}`;
}
```

### Workflow Contexts

| Workflow | Voice Pattern | Example |
|----------|--------------|---------|
| **SEO** | `Cập nhật quy trình SEO: hoàn thành. Bakudan Ramen page optimized.` | Voice: ~5 sec |
| **Payroll** | `Cập nhật quy trình Payroll: đang thực hiện. Processing 15 employees.` | Voice: ~5 sec |
| **QuickBooks** | `Cập nhật quy trình QuickBooks: hoàn thành. Monthly reconciliation done.` | Voice: ~5 sec |
| **Dashboard** | `Cập nhật quy trình Dashboard: hoàn thành. All metrics refreshed.` | Voice: ~5 sec |

### API Usage

```bash
# SEO workflow voice evidence
curl -X POST http://localhost:4001/api/voice/output/send \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Cập nhật quy trình SEO: hoàn thành. Bakudan Ramen page optimized for local search.",
    "is_ceo": true,
    "workflow_id": "seo-bakudan-001"
  }'

# Payroll workflow voice evidence
curl -X POST http://localhost:4001/api/voice/output/send \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Cập nhật quy trình Payroll: đang thực hiện. Processing 15 employees for Stone Oak, Bandera, Rim.",
    "is_ceo": true,
    "workflow_id": "payroll-weekly-001"
  }'

# QuickBooks sync voice evidence
curl -X POST http://localhost:4001/api/voice/output/send \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Cập nhật quy trình QuickBooks: hoàn thành. Monthly reconciliation — all 3 stores synced.",
    "is_ceo": true,
    "workflow_id": "qb-monthly-sync-001"
  }'
```

### Evidence with Workflow ID

Every workflow voice note saves:
- `workflow_id` — links to specific workflow execution
- `audio_path` — MP3 file on disk
- `approval_status` — CEO exempt or pending
- `text_content` — what was spoken
- `created_at` — timestamp

### Integration Points

Workflow voice notes can be triggered by:
1. **Direct API call** — `POST /api/voice/output/send`
2. **Orchestrator** — `orchestrateVoiceOutput()` handles TTS + gate + send + evidence
3. **WhatsApp command** — CEO sends "Mi đọc báo cáo SEO" → daily brief with SEO focus

## Files

| File | Purpose |
|------|---------|
| `server/src/voice/voice-personality.ts` | `workflowToVoiceText()` |
| `server/src/voice/voice-evidence-store.ts` | Persists voice evidence per workflow |
