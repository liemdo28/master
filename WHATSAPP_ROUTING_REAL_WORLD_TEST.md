# WHATSAPP ROUTING REAL WORLD TEST
> Phase 21.6 CEO Directive P0 | Generated: 2026-06-22

## Certification Rule
Do NOT certify based on: curl | localhost | unit tests | mock messages
Certification requires: Real WhatsApp | Real group | Real CEO messages | Real routing logs | No duplicate replies

---

## Test 1: CEO says "Mi ơi"

**Command:** CEO sends "Mi ơi" to Mi-Core
**Expected:**
- Owner = mi_core
- 1 response max
- Response: mi-core executive reply
**Validation:** Check routing-trace.jsonl for message_id with owner=mi_core, response_sent=true

---

## Test 2: CEO says "nay anh có task gì"

**Command:** CEO sends "nay anh có task gì" (no prefix)
**Expected:**
- Owner = mi_core (CEO sender in MI_CEO_WHATSAPP_IDS)
- 1 response max
- NO marketing preview
- NO food safety rejection
**Evidence:** routing-trace.jsonl — owner must be mi_core, response_sent=true
**Anti-evidence:** Any entry with owner=food_safety or marketing_preview for this message_id

---

## Test 3: Food Safety image upload

**Command:** Team member uploads food safety form image to Food Safety group
**Expected:**
- Owner = food_safety
- 1 response max
- Response: OCR confirmation or warning
**Validation:** routing-trace.jsonl — owner=food_safety, response_sent=true, intent=food_safety_submission

---

## Test 4: Repeat same message (DEDUP TEST)

**Command:** Send exact same text twice
**Expected:**
- First message: 1 response (owner determined)
- Second message: 0 responses (duplicate blocked)
**Validation:** routing-trace.jsonl — message_id appears once with response_sent=true, never again

---

## Test 5: Marketing approval command

**Command:** Send "duyệt bản nháp" or "approve draft"
**Expected:**
- Owner = marketing_preview
- 1 response max
**Validation:** routing-trace.jsonl — owner=marketing_preview

---

## Test 6: Unknown message (no reply)

**Command:** Random person sends "hello" to a group
**Expected:**
- Owner = unknown_no_reply
- 0 responses
**Validation:** routing-trace.jsonl — owner=unknown_no_reply, response_sent=false

---

## Test 7: Concurrent messages (race condition)

**Command:** Send 3 different messages within 1 second
**Expected:**
- Each message gets exactly 1 response
- No message is assigned to 2 owners
**Validation:** routing-trace.jsonl — 3 entries, each response_sent=true, distinct message_ids

## Test 8: Food Safety group text (no image)

**Command:** Staff sends "check" in Food Safety group
**Expected:** 0 responses (text-only in food safety group needs active session)
**Validation:** routing-trace.jsonl — owner=food_safety, response_sent=false, intent=silent_drop

