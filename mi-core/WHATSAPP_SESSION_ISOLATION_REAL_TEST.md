# WhatsApp Session Isolation — Real WhatsApp Test Plan

## Phase 21.7 — Date: 2026-06-22

---

## Pre-Test: Restart Gateway

```bat
cd e:\Project\Master\mi-core\services\whatsapp-ai-gateway
pm2 restart mi-whatsapp-gateway
pm2 logs mi-whatsapp-gateway --lines 10
```

Verify: `WhatsApp Session Manager initialized` appears in logs.

---

## Test A: "mi oi"

**Input:** CEO sends `mi oi` in direct chat

**Expected:**
- ONLY Mi-Core greeting response ("Dạ anh, em đây" or similar)
- NO Food Safety text
- NO Marketing preview image
- NO Approval checklist
- `response_count = 1`

**Trace log:** `MI_CORE_PRIORITY_LOCK` with `closedOwners: all_others`

---

## Test B: "task anh hôm nay có gì"

**Input:** CEO sends `task anh hôm nay có gì` in direct chat

**Expected:**
- ONLY task/Mi-Core response
- NO Food Safety rejection
- NO Marketing preview image
- `response_count = 1`

**Trace log:** `SESSION_SET` with `owner: mi_core`, `workflow: ceo_no_prefix`

---

## Test C: "nay anh có task gì"

**Input:** CEO sends `nay anh có task gì` in direct chat

**Expected:**
- ONLY task/Mi-Core response
- NO Food Safety rejection
- `response_count = 1`

---

## Test D: "lại nữa"

**Input:** CEO sends `lại nữa` in direct chat

**Expected:**
- EITHER Mi-Core contextual response OR no reply
- NO Approval checklist unless approval session explicitly active
- `response_count <= 1`

**Reasoning:** "lại nữa" is a no-prefix message from CEO → claims mi_core owner.
No approval session should be active for this chat+sender.

---

## Test E: "service nào down?"

**Input:** CEO sends `service nào down?` in direct chat

**Expected:**
- ONLY Mi-Core service status response
- `response_count = 1`

---

## Test F: Food Safety Image

**Input:** Send food safety image in FOOD SAFETY GROUP (not CEO DM)

**Expected:**
- ONLY Food Safety response (warning or PASS notice)
- `response_count = 1`

---

## Test G: Marketing Command Without Active Draft

**Input:** Send `preview` in CEO direct chat WITHOUT an active draft session

**Expected:**
- NO marketing image
- `response_count <= 1`
- Either Mi-Core response or no reply

**Reasoning:** No active marketing_preview session → marketing cannot claim owner.

---

## Test H: Duplicate Message

**Input:** Same message sent twice (same message_id)

**Expected:**
- First message: normal response
- Second message: BLOCKED by send guard
- `response_count = 1` total

---

## Certification Criteria

All tests must pass with:
- ✅ No Food Safety rejection in CEO chat
- ✅ No Marketing preview image in CEO chat
- ✅ No unexpected Approval checklist
- ✅ No duplicate responses
- ✅ Correct owner trace in logs

Until all pass:

```
CEO PRODUCTION CHANNEL NOT CERTIFIED
```
