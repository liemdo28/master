# ACTION_APPROVAL_VALIDATION
**Generated:** 2026-06-09

## Approval Gate Architecture

### Location: `local-agent/action-layer/ApprovalRequiredAction.mjs`

```javascript
RISK = { READ: 1, WRITE: 2, DANGEROUS: 3 }

ACTION_LEVELS = {
  'send-email': 2,
  'create-event': 2,
  'upload-file': 2,
  'create-task': 2,
  'update-task': 2,
  'schedule-post': 2,
  'update-menu': 2,
  'update-seo': 2,
  'share-file': 2,
  'delete-file': 3,
  'deploy-production': 3,
  'publish-website': 3,
  'cancel-event': 3,
  'financial-export': 3,
  'db-migration': 3,
  'kill-process': 3
}
```

### L2 Approval Flow (single approval)
```
CEO message → isDailyWorkAction → handleDailyWorkAction
  → Service.create(params) → ApprovalRequiredAction.create(L2)
  → Save to pending_actions.json
  → Log to action_log.json (action_drafted)
  → Return formatted string with [Approve] [Edit] [Reject]
  
CEO: "Approve"
  → approve(actionId)
  → Log action_approved
  → Execute action (Gmail send / Calendar create / Drive upload)
  → Log action_executed
  → Return success confirmation
```

### L3 Approval Flow (double approval — CEO confirms twice)
```
CEO: "Hủy event XYZ"
  → CalendarActionService.cancelEvent(id)
  → RISK = DANGEROUS
  → "⚠️ ĐÂY LÀ HÀNH ĐỘNG NGUY HIỂM. Xác nhận lần 1?"
  
CEO: "Xác nhận"
  → "Xác nhận lần 2 — nhập: XÁC NHẬN ĐỂ TIẾP TỤC"
  
CEO: "XÁC NHẬN ĐỂ TIẾP TỤC"
  → Execute cancelEvent
  → Log action_executed (dangerous)
```

## Approval Validation Tests

### Test A: L2 action creates proper draft
```
Action: createTask("Kiểm tra Dashboard", assignee="Nguyên")
→ pending_actions.json entry:
  { id: "act_...", type: "create-task", risk: 2, status: "pending",
    created_at: "...", description: "...", rollback: "..." }
✅ PASS
```

### Test B: Sensitive file blocked before approval gate
```
Action: prepareAttachment(".env")
→ checkFileBlocked(".env") → BLOCKED
→ Approval gate never reached
✅ PASS — security check happens before queue
```

### Test C: All actions have rollback plan
```
Every ApprovalRequiredAction.create() call includes:
- type (what action)
- description (human-readable)
- rollback (how to undo)
- risk level
✅ PASS — all 7 service modules verified
```

### Test D: Audit log written for every action event
```
Events: action_drafted, action_approved, action_rejected, 
        action_executed, action_failed, action_blocked
Location: .local-agent-global/action-audit/action_log.json
Max entries: 1000 (auto-pruned)
✅ PASS
```

### Test E: Read-only actions bypass approval
```
"Tim file payroll" → searchLocalFiles() → auto-return (L1)
"Task nào overdue?" → getOverdue() → auto-return (L1)
"Calendar hôm nay?" → getTodayEvents() → auto-return (L1)
✅ PASS — no approval required for L1 operations
```

---
ACTION_APPROVAL_VALIDATION_COMPLETE
