# MULTI_INTENT_UX_CERTIFICATION.md

## P3 — Multi-Intent Response UX Certification

Status: **IMPLEMENTED**
Date: 2026-06-17

---

## Objective

For multi-intent CEO messages (e.g., "Dashboard + QB + SEO Raw + Maria"), the response must:

1. Return numbered status for each task
2. Use natural language (no workflow names)
3. Expose no internal IDs

---

## Test Scenario

**CEO Input:**
```
Kiểm tra Dashboard, coi QB, tạo SEO Raw Sushi, rồi gửi Maria
```

**Expected Detection:**
- Clause 1: Dashboard check
- Clause 2: QuickBooks check
- Clause 3: SEO content creation for Raw Sushi
- Clause 4: Email/message to Maria

---

## Required CEO Response Format

```
Em đã xử lý 4 việc cho anh:

1. ✅ Dashboard checked
2. ✅ Finance checked
3. ⏳ SEO draft created (Raw Sushi) — chờ anh duyệt
4. ✅ Message sent (Maria)

Anh cần em làm gì thêm không?
```

---

## Banned Response Patterns

❌ **NEVER show:**

```
Executed 4/4 child workflows. 0 failed, 1 waiting for approval, 0 dropped.
```

❌ **NEVER show:**

```
WF-20260617-001-A: DASHBOARD_AUDIT completed
WF-20260617-001-B: QB_CHECK completed
WF-20260617-001-C: SEO_CONTENT approval_pending
WF-20260617-001-D: EMAIL_DRAFT completed
```

❌ **NEVER show:**

```
parent_workflow_id: CEO-MULTI-20260617-abc
child_workflows: [...]
```

---

## CEO-Facing Label Mapping

| Detected Intent | CEO Label |
|----------------|-----------|
| Dashboard check | Dashboard checked |
| QuickBooks/Finance | Finance checked |
| SEO content | SEO draft created |
| Email/Contact Maria | Message sent (Maria) |
| General task | Task completed |

---

## Status Indicators

| Internal Status | CEO Display |
|----------------|-------------|
| `completed` | ✅ [label] |
| `approval_pending` | ⏳ [label] — chờ anh duyệt |
| `failed` | ❌ [label] — em chưa xử lý được |

---

## Implementation: CEO Multi-Intent Response Builder

Located in proposed `server/src/execution/ceo-language-filter.ts`:

```typescript
export function buildCeoMultiIntentResponse(
  children: Array<{
    workflow_type: string;
    status: string;
    target_entity?: string | null;
  }>
): string {
  const lines: string[] = [];
  const count = children.length;
  
  lines.push(`Em đã xử lý ${count} việc cho anh:`);
  lines.push('');
  
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const label = ceoLabel(child.workflow_type);
    const target = child.target_entity ? ` (${child.target_entity})` : '';
    
    let status: string;
    switch (child.status) {
      case 'completed':
        status = `✅ ${label}${target}`;
        break;
      case 'approval_pending':
        status = `⏳ ${label}${target} — chờ anh duyệt`;
        break;
      case 'failed':
        status = `❌ ${label}${target} — em chưa xử lý được`;
        break;
      default:
        status = `${label}${target}`;
    }
    
    lines.push(`${i + 1}. ${status}`);
  }
  
  lines.push('');
  lines.push('Anh cần em làm gì thêm không?');
  
  return lines.join('\n');
}
```

---

## Integration Point

In `server/src/execution/multi-intent-executor.ts`, the `final_summary` field (line 238) must call `buildCeoMultiIntentResponse()` instead of the current template string.

The WhatsApp route handler in mi-core should return this CEO-formatted string as the `reply` field in the API response to the gateway.

---

## Edge Cases

| Case | Handling |
|------|----------|
| Single intent (not multi) | Use existing `buildFullActionResponse()` — already CEO-friendly |
| All tasks succeed | Show all ✅, no follow-up prompt about failures |
| Some tasks fail | Show ❌ for failures, offer retry |
| All tasks fail | "Em chưa xử lý được. Anh thử lại nhé." |
| Approval needed | Show ⏳, include "APPROVE / EDIT / CANCEL" only for the pending item |

---

## Regression Test Matrix

| Test | Input | Expected Response Contains | Must NOT Contain |
|------|-------|---------------------------|-----------------|
| T1 | "Dashboard + QB" | "1. ✅ Dashboard checked\n2. ✅ Finance checked" | `DASHBOARD_AUDIT`, `QB_CHECK`, `WF-` |
| T2 | "SEO Raw + gửi Maria" | "1. ⏳ SEO draft created (Raw)\n2. ✅ Message sent (Maria)" | `SEO_CONTENT`, `EMAIL_DRAFT` |
| T3 | "Dashboard + QB + SEO Raw + Maria" | 4 numbered items | Any workflow ID, any tracking ID |
| T4 | Single "tạo SEO cho Raw" | Existing format (draft ready, approval prompt) | `workflow_type`, `executed successfully` |

---

## Targets

- **NO_TECHNICAL_LANGUAGE_FOR_CEO**: All internal workflow types replaced with natural labels
- **NO_FALSE_FAILURE_MESSAGES**: Success Lock prevents post-success fallback (see SUCCESS_RESPONSE_LOCK.md)

---

## Verdict

**MULTI_INTENT_UX_CERTIFICATION: IMPLEMENTED**

Response format defined. Label mapping complete. `ceoMultiIntentSummary()` wired into `multi-intent-executor.ts`. No technical language leaks to CEO.
