# MI_APPROVAL_REPORT

Generated: 2026-06-12
Status: PASS

## Approval Rules

### Auto-approved (no approval needed)

| Action Type | Examples |
|---|---|
| Summarize | "tóm tắt tình hình", "summarize", "daily briefing" |
| Analyze | "phân tích", "action items", "food safety summary" |
| Draft | "draft email", "suggest", "gợi ý" |
| Recommend | General AI chat, store status, compliance summary |

### Single Approval Required

| Trigger | Examples |
|---|---|
| Skill with `approval_required: true` | task-proposal |
| Keywords: tạo/create/giao/assign/gửi/send/update/sửa/edit/delete/xóa | "gửi email cho team", "tạo meeting" |
| Task-related actions | "book", "cancel", "schedule", "invoice" |

### Double Approval Required

| Category | Examples |
|---|---|
| Payroll/Financial | "payroll", "financial report" |
| Production/Deploy | "deploy production", "database migration" |
| Permission changes | "role change", "permission change" |
| Private/Health data | "health records", "private export" |

## Approval Flow

```
CEO sends action message
  → Mi drafts response + enqueues approval
  → Reply: "Approval ID: APP-xxx\nReply: /mi approve APP-xxx"

CEO sends "/mi approve APP-xxx"
  → approve(approvalId) in gate
  → Action executed
  → Reply: "✅ Approved. Action executed."

CEO sends "/mi reject APP-xxx"
  → reject(approvalId)
  → Reply: "❌ Rejected. Action canceled."
```

## TTL

- Approval items expire after 30 minutes if not actioned.

## Validation

- "tóm tắt tình hình hôm nay" → `approval_required: false` ✅
- "tạo task cho Maria..." → `approval_required: true`, approval_id set ✅
- "/mi approve APP-xxx" → intent: `approval_not_found` (correct for nonexistent ID) ✅
- Skill `task-proposal` always requires approval ✅

## Verdict: PASS
