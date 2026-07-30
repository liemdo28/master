# Food Safety Image AI — Test Plan

## Purpose

Validate the Phase 3 Food Safety AI module by sending real food safety board images into the test WhatsApp chat and confirming correct behavior (warning on FAIL/NEEDS_REVIEW, silent log on PASS).

**Do NOT test in the real Bakudan operations group yet.**

---

## Prerequisites

- [ ] `FOOD_SAFETY_ENABLED=true` set in `.env`
- [ ] `FOOD_SAFETY_TEST_MODE=true` set in `.env`
- [ ] `FOOD_SAFETY_ALLOWED_CHAT_IDS` set to the test chat/group ID (not the real group)
- [ ] Optional: `VISION_API_URL` and `VISION_API_KEY` configured for real OCR. Without it, every image returns NEEDS_REVIEW (also validates the test path).
- [ ] App restarted after `.env` changes
- [ ] Dashboard accessible at `http://localhost:3210`
- [ ] Test WhatsApp chat/group ID known

---

## Step 1: System Health Check

```bash
curl http://localhost:3210/health
```

Expected response includes:
```json
{
  "food_safety_enabled": true,
  "ok": true
}
```

---

## Step 2: Check Food Safety API

```bash
curl http://localhost:3210/api/food-safety/status
```

Expected:
```json
{
  "enabled": true,
  "test_mode": true,
  "allowed_chat_ids": ["12001234567-987654321@g.us"],
  "reply_mode": "warning_only",
  "last_synced": "2026-06-03T..."
}
```

---

## Step 3: Check Dashboard

Open `http://localhost:3210` in browser.

Verify:
- "Food Safety Checks" section visible near top
- Shows "ENABLED" badge and "TEST MODE" chip
- PASS / FAIL / REVIEW counters show 0

---

## Step 4: Test Image — No Vision API (Fallback Path)

Without `VISION_API_URL` configured, every image triggers NEEDS_REVIEW. This tests the entire pipeline except the vision call.

**Action:** Send any image (even a random photo) to the test WhatsApp chat.

**Expected in test chat:**
```
⚠️ NEEDS REVIEW
Store: Unknown

The image was received but could not be fully analyzed.
Please retake the photo and try again.

If the problem persists, please contact your manager.
```

**Expected on Dashboard:** New row in Food Safety Checks with:
- Result: NEEDS_REVIEW
- Store: Unknown
- Warning text visible in "Latest Warning Sent" panel

**Expected in logs:** `logs/YYYY-MM-DD/food-safety.log`:
```
[...INFO]: Food safety pipeline started { imagePath: "...", chatId: "...", sender: "..." }
[...WARN]: Food safety NEEDS_REVIEW { store: "Unknown", items: ["*"] }
[...INFO]: Food safety pipeline complete { checkId: "FS...", result: "NEEDS_REVIEW", warningSent: true }
```

---

## Step 5: With Vision API — PASS Scenario

Configure `VISION_API_URL` and `VISION_API_KEY` in `.env`. Restart app.

**Action:** Take or obtain a food safety board image where ALL readings are clearly within threshold (e.g., Walk-in Cooler 38°F, Fryer 353°F). Send it to the test chat.

**Expected in test chat:** Nothing (silent PASS with `warning_only` mode).

**Expected in Dashboard:** New row with:
- Result: PASS
- All readings show green PASS badge
- PASS count increments

**Expected in logs:**
```
[...INFO]: Food safety PASS { store: "Bandera Road" }
[...INFO]: Food safety pipeline complete { checkId: "FS...", result: "PASS", warningSent: false }
```

---

## Step 6: With Vision API — FAIL Scenario

**Action:** Obtain or create an image showing at least one out-of-threshold reading (e.g., Walk-in Cooler 44°F, Pork Broth 190°F). Send to test chat.

**Expected in test chat:**
```
⚠️ FOOD SAFETY WARNING
Store: Stone Oak
Item: Walk-in Cooler
Reading: 44°F
Target: <= 40°F
Action: Close door, re-temp in 10 min, alert MOD if still high.

Please re-temp and confirm.
```

If multiple failures exist:
```
⚠️ FOOD SAFETY WARNING
Store: Stone Oak
Item: Walk-in Cooler
Reading: 44°F
Target: <= 40°F
Action: Close door, re-temp in 10 min, alert MOD if still high.

Please re-temp and confirm.

Other failures:
• Walk-in Freezer: 10°F (<= 0°F)
• Pork Broth: 190°F (>= 200°F)
```

**Expected on Dashboard:** FAIL count increments. Last image and readings table update.

---

## Step 7: With Vision API — NEEDS_REVIEW Scenario

**Action:** Send an image where some readings are blurry or partially visible.

**Expected in test chat:**
```
⚠️ NEEDS REVIEW
Store: Medical Center

The image was received, but some readings were unclear.
Please retake the photo or manually confirm:
• Walk-in Cooler
• Fryer 1

If the problem persists, please contact your manager.
```

---

## Step 8: Test Mode Chat Restriction

**Action:** Send an image from a WhatsApp chat NOT in `FOOD_SAFETY_ALLOWED_CHAT_IDS`.

**Expected:** Image is silently ignored. No warning sent. No error shown to sender.

**Verify:** Dashboard / logs show no activity from that chat.

---

## Step 9: Test Mode Disabled (Production Gate)

**Action:** Set `FOOD_SAFETY_TEST_MODE=false` in `.env`. Restart. Send image from non-real chat.

**Expected:** `FOOD_SAFETY_ALLOWED_CHAT_IDS` restriction is bypassed only after `FOOD_SAFETY_TEST_MODE=false`; system accepts images from any chat only in non-test mode with an empty allow-list.

---

## Step 10: `always_reply` Mode

**Action:** Set `FOOD_SAFETY_REPLY_MODE=always_reply`. Restart. Send a clearly PASS image.

**Expected in test chat:**
```
✅ Food safety check passed.
Store: Bandera Road

All readings were within acceptable ranges.
```

---

## Test Image Preparation

Obtain or create these images:

| Image | Description | Expected Result |
|---|---|---|
| `test-fail-walkin.jpg` | Walk-in Cooler reading 44°F | FAIL warning |
| `test-pass-all.jpg` | All readings within range | PASS (silent) |
| `test-blurry.jpg` | Partial/blurry readings | NEEDS_REVIEW warning |
| `test-multi-fail.jpg` | Multiple out-of-range items | FAIL with multiple violations |

---

## Sign-off Checklist

- [ ] Test chat sends image → warning received in < 10 seconds
- [ ] Dashboard shows updated check count
- [ ] SQLite tables populated (visible via API)
- [ ] Logs contain pipeline trace
- [ ] Non-allowed chat images are silently ignored
- [ ] All 3 result types (PASS/FAIL/NEEDS_REVIEW) trigger correct behavior
- [ ] `FOOD_SAFETY_TEST_MODE` enforcement verified

**Once all steps pass:** Move to Stage 2 of the Rollout Plan.
