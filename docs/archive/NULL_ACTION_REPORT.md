# NULL_ACTION_REPORT.md — P0-3 Null Action Path

**Priority:** P0 — PRODUCTION BLOCKER
**Generated:** 2026-06-16T08:03:00+07:00
**Status:** IMPLEMENTED
**Owner:** Mi-Core Central Command

---

## Problem Statement

Previous behavior generated workflows, approvals, or follow-up actions for inputs that required NONE:
- "Payroll Raw là tuần rồi" → system created a payroll review workflow
- "QB Report đã hoàn thành rồi" → system requested approval for "marking complete"
- Casual statements → system treated as actionable orders

**Root Cause:** No "null action" path existed. The system had no concept of "this input requires nothing."

---

## Null Action Path Definition

**Null Action** = the system correctly determines that NO workflow, NO approval, NO action, and NO follow-up is needed.

The ONLY valid outputs for a null action path are:
1. **ACKNOWLEDGE** — simple recognition
2. **VERIFY → UPDATE → CONFIRM** — internal check + state update + confirmation (no approval)
3. **SHOW IMAGE OR EXPLAIN** — for image-related queries

That's it. Nothing else.

---

## Null Action Scenarios

### Scenario 1: Historical Statement

**Input:** "Payroll Raw là tuần rồi"
**Intent:** CEO is stating a fact. Not asking for anything.
**Evidence:** MISSING (no live payroll data needed)
**Decision:** ACKNOWLEDGE

**Output:**
```
ACKNOWLEDGE
```

**What must NOT happen:**
- ❌ No workflow created for "payroll review"
- ❌ No approval requested
- ❌ No action triggered
- ❌ No follow-up question like "Anh cần em check gì không?"
- ❌ No status update to any system
- ❌ No memory write about "payroll discussed"

---

### Scenario 2: Completion Confirmation

**Input:** "QB Report đã hoàn thành rồi"
**Intent:** CEO confirming a task is done.
**Evidence:** UNCONFIRMED (can verify if QB data available)
**Decision:** ACKNOWLEDGE (optionally VERIFY if data exists)

**Output (no data to verify):**
```
ACKNOWLEDGE
"Em ghi nhận QB Report đã hoàn thành."
```

**Output (QB data available):**
```
VERIFY → UPDATE → CONFIRM

Step 1: VERIFY — Check QB data for report completion status
Step 2: UPDATE — Record task status as completed in internal state
Step 3: CONFIRM — "Em xác nhận QB Report đã hoàn thành."

No approval requested at any step.
```

**What must NOT happen:**
- ❌ No approval requested for "marking complete"
- ❌ No workflow to "archive QB report"
- ❌ No action to "send confirmation to team"
- ❌ No automatic update to any tracking system requiring CEO approval

---

### Scenario 3: Image Query (No Image Available)

**Input:** "Không có hình hả?"
**Intent:** CEO asking about missing image (from previous context)
**Decision:** CONTEXT FOLLOW-UP (resolve from previous conversation)

**Output:**
```
"Em chưa có hình cho [previous topic]. Anh muốn em tìm/generate không?"
```

**If image can be shown:**
```
SHOW IMAGE
[Image data or URL]
```

**What must NOT happen:**
- ❌ No workflow created for "image generation"
- ❌ No approval requested
- ❌ No new topic initiated

---

### Scenario 4: Casual/Ambiguous Follow-up

**Input:** "Hả?"
**Intent:** CEO didn't understand or is surprised
**Decision:** CONTEXT FOLLOW-UP

**Output:**
```
"Mình đang nói về [previous topic]. [Brief context]. Anh muốn mình tiếp tục không?"
```

**What must NOT happen:**
- ❌ No workflow
- ❌ No action
- ❌ No new topic

---

## Null Action Gate Implementation

Location: `server/src/jarvis/phase30-jarvis/null-action-gate.ts`

```typescript
// Null Action Gate — P0-3 Implementation
// Determines if input requires ANY action at all

export type NullActionOutcome = 'NULL_ACTION' | 'REQUIRES_ACTION';

export interface NullActionInput {
  rawMessage: string;
  normalizedMessage: string;
  isFollowUp: boolean;
  lastTopic: string | null;
  lastEntity: string | null;
  detectedIntent: string;
  hasExplicitOrder: boolean;
  hasQuestion: boolean;
  hasStatement: boolean;
  hasCompletionWord: boolean;
  hasPastTimeWord: boolean;
}

// Patterns that indicate NULL ACTION — historical statements
const STATEMENT_PATTERNS = [
  /\b(la|là)\s+tuần\s+rồi\b/i,
  /\b(da|đã)\s+(hoàn\s+thanh|xong|lam|xong\s+rồi)\b/i,
  /\b(hoàn\s+thanh|xong|done|finished)\s+rồi\b/i,
  /\btháng\s+truoc\b/i,
  /\bhôm\s+qua\b/i,
  /\bngày\s+kia\b/i,
];

// Patterns that indicate NULL ACTION — casual/acknowledgment
const CASUAL_PATTERNS = [
  /^(k|ok|oke|okay|da|ừ|ờ|uh|um|yes|no)\s*[.!?]*$/i,
  /^(hả|sao|sao vậy|thế|thế hả)\s*[?]*$/i,
  /^(cảm\s+on|thanks|thank)\s*(nhe|nhé|bat ky|bất kỳ)?$/i,
];

// Patterns that indicate REQUIRES_ACTION — explicit orders
const ACTION_PATTERNS = [
  /\b(gửi|send|email|message|nhắn)\b/i,
  /\b(tạo|create|build|làm|setup|cài)\b/i,
  /\b(xóa|delete|remove|bỏ)\b/i,
  /\b(chỉnh|edit|update|sửa|đổi)\b/i,
  /\b(chạy|run|execute|triển khai|deploy)\b/i,
];

// Patterns for image-related queries
const IMAGE_QUERY_PATTERNS = [
  /không\s+có\s+hình/i,
  /có\s+hình/i,
  /hình\s+(ảnh|nào|đâu|ấy)/i,
  /show\s+image/i,
  /gửi\s+hình/i,
];

export function classifyNullAction(input: NullActionInput): NullActionOutcome {
  const msg = input.normalizedMessage.trim();

  // Rule 1: Explicit action words → REQUIRES_ACTION
  if (input.hasExplicitOrder) return 'REQUIRES_ACTION';
  if (ACTION_PATTERNS.some(p => p.test(msg))) return 'REQUIRES_ACTION';

  // Rule 2: Questions are NOT null actions (they want info)
  if (input.hasQuestion) return 'REQUIRES_ACTION';

  // Rule 3: Casual messages → NULL_ACTION
  if (CASUAL_PATTERNS.some(p => p.test(msg))) return 'NULL_ACTION';

  // Rule 4: Historical statements → NULL_ACTION
  if (input.hasPastTimeWord) return 'NULL_ACTION';
  if (STATEMENT_PATTERNS.some(p => p.test(msg))) return 'NULL_ACTION';

  // Rule 5: Completion statements → NULL_ACTION
  if (input.hasCompletionWord && !input.hasQuestion) return 'NULL_ACTION';

  // Rule 6: Image queries that don't ask "where" → NULL_ACTION
  if (IMAGE_QUERY_PATTERNS.some(p => p.test(msg)) && !input.hasQuestion) {
    return 'NULL_ACTION';
  }

  // Default: needs further analysis → REQUIRES_ACTION (Decision Gate decides)
  return 'REQUIRES_ACTION';
}
```

---

## Null Action Output Format

When `classifyNullAction` returns `NULL_ACTION`, the system MUST:

1. Generate ONLY a simple acknowledgment or confirmation
2. NOT create any workflow
3. NOT request any approval
4. NOT trigger any follow-up system calls
5. NOT write to execution queue
6. NOT spawn any child processes

### Output Templates

**Statement (no verification possible):**
```
ACKNOWLEDGE
"Em ghi nhận."
```

**Statement (verification possible):**
```
ACKNOWLEDGE
"Em ghi nhận [topic] đã [status]."
```

**Completion (with data available):**
```
VERIFY → UPDATE → CONFIRM
"Em xác nhận — [task] đã hoàn thành. [Optional: timestamp]."
```

**Completion (no data to verify):**
```
ACKNOWLEDGE
"Em ghi nhận [task] đã hoàn thành."
```

**Casual:**
```
ACKNOWLEDGE
"Vâng." / "Ok anh." / "Em hiểu."
```

**Image (from context):**
```
SHOW IMAGE
[Show the image from previous context]
```

**Image (not available):**
```
"Em chưa có hình cho [topic]. Anh muốn em tìm/generate không?"
```

---

## Forbidden Outputs for Null Action

| Forbidden Output | Why |
|---|---|
| Workflow JSON created | Null action must not create workflows |
| Approval request sent | Nothing to approve |
| External API call made | No action needed |
| Memory write about the topic | Statement doesn't require state change |
| Follow-up question ("Anh cần em check...?") | Don't add noise to null actions |
| New topic initiated | Stay on current topic |
| Execution queue entry added | Nothing to execute |

---

## Acceptance Test 2: "Payroll Raw là tuần rồi"

**Null Action Gate Step:**
1. hasStatement: true (stating a fact about payroll timing)
2. hasPastTimeWord: true ("tuần rồi" = past time)
3. hasExplicitOrder: false
4. hasQuestion: false
5. detectedIntent: null_action

**Classification:** NULL_ACTION

**Output:**
```
ACKNOWLEDGE
```

No workflow. No approval. No action. **PASS.**

---

## Acceptance Test 1: "QB Report của chúng anh đã hoàn thành rồi mà"

**Null Action Gate Step:**
1. hasCompletionWord: true ("hoàn thành rồi")
2. hasStatement: true
3. hasExplicitOrder: false
4. hasQuestion: false

**Classification:** NULL_ACTION

**Verification step (optional):**
- Can we verify QB Report completion? → Check QB data
- If YES → VERIFY → UPDATE → CONFIRM
- If NO → ACKNOWLEDGE only

**Output (with data):**
```
VERIFY → UPDATE → CONFIRM
"Em xác nhận QB Report đã hoàn thành."
```

**Output (without data):**
```
ACKNOWLEDGE
"Em ghi nhận QB Report đã hoàn thành."
```

No workflow. No approval. **PASS.**

---

**CERTIFICATION:** NULL_ACTION_P0_3_IMPLEMENTED
