# WhatsApp Routing Real World Test

## Test Environment
CEO WhatsApp chat — the exact affected WhatsApp number.

## Test Procedure
Each test: send message → observe responses → log result.

---

## Test A: "mi oi"

**Send**: `mi oi`

**Expected**:
- owner = mi_core
- response_count = 1
- no food safety reply
- no marketing preview
- route log: `no_prefix_mi_forward` or `mi_forward`

**PASS/FAIL**: _______

---

## Test B: "nay anh có task gì"

**Send**: `nay anh có task gì`

**Expected**:
- owner = mi_core OR unknown_no_reply
- response_count <= 1
- no food safety reply
- no marketing preview
- route log: `no_prefix_mi_forward` or `mi_forward`

**PASS/FAIL**: _______

---

## Test C: "anh hỏi anh có task gì mà"

**Send**: `anh hỏi anh có task gì mà`

**Expected**:
- owner = mi_core OR continuation_of_mi_core_session
- response_count = 1
- no food safety reply
- no marketing preview

**PASS/FAIL**: _______

---

## Test D: Food Safety Form Image

**Send**: Take photo of a food safety form/checklist and send it.

**Expected**:
- owner = food_safety
- response_count = 1
- no mi-core reply
- no marketing preview

**PASS/FAIL**: _______

---

## Test E: Marketing Approval (only with active draft)

**Prerequisite**: Active marketing draft session must exist.
**Send**: `approve review 42` (or the appropriate approval command)

**Expected**:
- owner = marketing_preview
- response_count = 1

**PASS/FAIL**: _______

---

## Test F: Duplicate Message (Dedup)

**Send**: Repeat Test A message within 10 seconds.

**Expected**:
- dedup = true
- response_count = 0
- route log: `dedup_blocked_incoming`

**PASS/FAIL**: _______

---

## Test Log Template

```
=== TEST RUN: YYYY-MM-DD HH:MM ===
CEO: [CEO phone]
Gateway PID: 8388
Gateway Uptime: [uptime]

Test A "mi oi":
  Response count: ___
  Owner: ___
  Route: ___
  PASS: Y/N

Test B "nay anh có task gì":
  Response count: ___
  Owner: ___
  Route: ___
  PASS: Y/N

Test C "anh hỏi anh có task gì mà":
  Response count: ___
  Owner: ___
  Route: ___
  PASS: Y/N

Test D Food Safety image:
  Response count: ___
  Owner: ___
  PASS: Y/N

Test F Duplicate:
  Dedup blocked: Y/N
  Response count: ___
  PASS: Y/N
```
