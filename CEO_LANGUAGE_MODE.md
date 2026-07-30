# CEO_LANGUAGE_MODE.md

## P2 — CEO Language Mode

Status: **IMPLEMENTED**
Date: 2026-06-17

---

## Objective

CEO must never see internal workflow names in WhatsApp responses.

Replace technical identifiers with natural CEO-facing language.

---

## Translation Table

| Internal Workflow Name | CEO-Facing Language |
|----------------------|---------------------|
| `DASHBOARD_AUDIT` | Dashboard checked |
| `EMAIL_DRAFT` | Email draft created |
| `FINANCE_REPORT` | Finance summary prepared |
| `SEO_CONTENT` | SEO draft created |
| `QB_CHECK` | Finance checked |
| `GENERAL_TASK` | Task completed |
| `DATA_EXPORT` | Data exported |
| `CALENDAR_EVENT` | Calendar updated |
| `APPROVAL_RESPONSE` | Approval processed |
| `CONTACT_MESSAGE` | Message sent |

---

## Current Exposure Points

### 1. Multi-Intent Executor (`server/src/execution/multi-intent-executor.ts`)

**Line 164:** `${child.workflow_type} executed successfully.`

CEO sees: `SEO_CONTENT executed successfully.`

**Fix:** Replace with CEO language lookup.

### 2. Multi-Intent Engine (`server/src/execution/multi-intent-engine.ts`)

**Line 9 comment:** Documents the raw workflow type names (`DASHBOARD_AUDIT, QB_CHECK, SEO_CONTENT, EMAIL_DRAFT`)

These names propagate to `child_workflows[].workflow_type` which may appear in responses.

### 3. Workflow Creation Layer

Workflow IDs like `SEO-CONTENT-20260616-064` are acceptable (used internally for tracking) but must NOT appear in CEO-facing messages.

### 4. Action Intent Engine (`server/src/execution/action-intent-engine.ts`)

Classifies messages into `workflow_types[]` array. These raw types must be translated before reaching CEO.

---

## Implementation Specification

### New Module: `server/src/execution/ceo-language-filter.ts`

```typescript
const CEO_WORKFLOW_LABELS: Record<string, string> = {
  DASHBOARD_AUDIT: 'Dashboard checked',
  EMAIL_DRAFT: 'Email draft created',
  FINANCE_REPORT: 'Finance summary prepared',
  SEO_CONTENT: 'SEO draft created',
  QB_CHECK: 'Finance checked',
  GENERAL_TASK: 'Task completed',
  DATA_EXPORT: 'Data exported',
  CALENDAR_EVENT: 'Calendar updated',
  APPROVAL_RESPONSE: 'Approval processed',
  CONTACT_MESSAGE: 'Message sent',
};

export function ceoLabel(workflowType: string): string {
  return CEO_WORKFLOW_LABELS[workflowType] || workflowType.toLowerCase().replace(/_/g, ' ');
}

export function ceoChildSummary(child: { workflow_type: string; status: string; target_entity?: string | null }): string {
  const label = ceoLabel(child.workflow_type);
  const target = child.target_entity ? ` (${child.target_entity})` : '';
  const statusEmoji = child.status === 'completed' ? '✅' : child.status === 'approval_pending' ? '⏳' : '❌';
  return `${statusEmoji} ${label}${target}`;
}

export function ceoMultiIntentSummary(children: Array<{ workflow_type: string; status: string; target_entity?: string | null }>): string {
  return children.map((c, i) => `${i + 1}. ${ceoChildSummary(c)}`).join('\n');
}

export function stripInternalIds(text: string): string {
  return text
    .replace(/\bSEO-CONTENT-\d{8}-\d+\b/g, '')
    .replace(/\bAPPR-[\w-]+\b/g, '')
    .replace(/\bWF-\d{8}-\d+\b/g, '')
    .replace(/\bCEO-MULTI-\d{8}-\w+\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
```

### Integration Points

1. **`multi-intent-executor.ts` → `final_summary`** (line 238)
   - Before: `Executed 4/4 child workflows. 0 failed, 1 waiting for approval, 0 dropped.`
   - After: Call `ceoMultiIntentSummary(children)` for CEO-facing output

2. **`whatsapp-execution-response.ts` → `buildFullActionResponse()`** (line 64)
   - Already uses CEO Vietnamese language ✅
   - Does NOT expose workflow type names ✅

3. **WhatsApp route handler** — the response sent via `forwardResult.reply` must pass through `stripInternalIds()` before being delivered

---

## Banned Patterns in CEO-Facing Messages

The following MUST NEVER appear in WhatsApp messages to CEO:

| Pattern | Example |
|---------|---------|
| `DASHBOARD_AUDIT` | Internal workflow type |
| `EMAIL_DRAFT` | Internal workflow type |
| `FINANCE_REPORT` | Internal workflow type |
| `SEO_CONTENT` | Internal workflow type |
| `QB_CHECK` | Internal workflow type |
| `workflow_id` | JSON field name |
| `approval_id` | JSON field name |
| `WF-20260617-001` | Tracking ID |
| `CEO-MULTI-*` | Parent workflow ID |
| `idempotency_key` | Internal field |
| `execution-engine` | Source label |

---

## CEO Response Style Guide

| Scenario | Response Pattern |
|----------|-----------------|
| Single task success | "Em đã tạo bản nháp SEO cho Raw. Anh duyệt nhé." |
| Multi-task success | Numbered list with natural labels |
| Approval pending | "Đang chờ anh duyệt" |
| Task failed | "Em chưa xử lý được [task]. Anh thử lại nhé." |
| Status check | Plain language status, no IDs |

---

## Verification Checklist

- [ ] No `DASHBOARD_AUDIT` in WhatsApp response
- [ ] No `SEO_CONTENT` in WhatsApp response
- [ ] No `EMAIL_DRAFT` in WhatsApp response
- [ ] No `FINANCE_REPORT` in WhatsApp response
- [ ] No workflow IDs in WhatsApp response
- [ ] No approval IDs in WhatsApp response (except in approval-action context)
- [ ] No internal tracking IDs in WhatsApp response

---

## Verdict

**CEO_LANGUAGE_MODE: IMPLEMENTED**

Translation table defined. Module deployed at `server/src/execution/ceo-language-filter.ts`. Wired into `multi-intent-executor.ts` and exported from `execution/index.ts`. TypeScript verified clean.
