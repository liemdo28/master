# Food Safety AI — 5-Stage Rollout Plan

## Critical Guardrails

1. **NEVER set `FOOD_SAFETY_TEST_MODE=false` until Stage 2 is complete.**
2. **NEVER add the real Bakudan operations WhatsApp group to `FOOD_SAFETY_ALLOWED_CHAT_IDS` until Stage 3 is complete.**
3. **Always test with `FOOD_SAFETY_REPLY_MODE=warning_only` initially** — avoids spamming groups with PASS confirmations.
4. Monitor `logs/food-safety.log` and Dashboard after every deployment.
5. If any FAIL is unexpected, pause with `FOOD_SAFETY_ENABLED=false` immediately.

---

## Stage 1 — Isolated Test Chat ✅ (This Document)

**Objective:** Validate the entire pipeline in a completely isolated WhatsApp chat that no one on the floor uses.

**Duration:** Until all 10 test plan steps pass.

### Setup
```bash
# .env
FOOD_SAFETY_ENABLED=true
FOOD_SAFETY_TEST_MODE=true
FOOD_SAFETY_ALLOWED_CHAT_IDS=<test-chat-id>
FOOD_SAFETY_REPLY_MODE=warning_only
FOOD_SAFETY_SHEET_URL=https://docs.google.com/spreadsheets/d/12J9CRkTpDJ4boKClVaz0qiev9KV7dEyr-TK4KA1ugJs/edit?gid=195905283#gid=195905283
VISION_API_URL=<your-vision-endpoint>
VISION_API_KEY=<your-api-key>
```

### Actions
1. Create a dedicated WhatsApp group called `🍜 FS Test — DO NOT USE FOR OPS`
2. Add only: CEO + 1 manager
3. Run test plan (docs/FOOD_SAFETY_IMAGE_TEST_PLAN.md)
4. Fix any failures before proceeding

### Success Criteria
- 10/10 test plan steps pass
- Dashboard shows correct PASS/FAIL/REVIEW counts
- Logs are clean (no unhandled errors)
- Team member can send image → gets warning in < 10 seconds

### Exit Gate
- [ ] All 10 test plan steps verified
- [ ] Dashboard data consistent with test images sent
- [ ] Log output verified
- [ ] Two team members have tested

---

## Stage 2 — Manager Test Group

**Objective:** Let managers use the system with a small closed group. Floor staff still not affected.

**Duration:** 1–2 weeks.

### Setup
```bash
# .env — add manager test group
FOOD_SAFETY_ALLOWED_CHAT_IDS=<test-chat-id>,<manager-group-id>
```

### Actions
1. Create a WhatsApp group: `🍜 FS Manager Pilot`
2. Add: 1 manager from each store
3. Brief managers on how to send food safety board images
4. Collect feedback daily for first 3 days
5. Monitor dashboard for false positives

### Success Criteria
- Managers successfully use the system in daily operations
- Zero false alarms from legitimate PASS readings
- Managers report system is useful
- No complaints about spam/warnings

### Exit Gate
- [ ] 1 week of clean operation
- [ ] Zero unexpected warnings
- [ ] Manager sign-off from all 3 stores
- [ ] VISION_API latency acceptable (< 5s per image)

---

## Stage 3 — One-Store Pilot

**Objective:** Deploy to one store's WhatsApp group for live operations.

**Duration:** 2 weeks.

### Setup
```bash
# .env — add one store group, REMOVE test chat restrictions
FOOD_SAFETY_ENABLED=true
FOOD_SAFETY_TEST_MODE=true   # Keep true — still restrict to allowed chats
FOOD_SAFETY_ALLOWED_CHAT_IDS=<one-store-group-id>
FOOD_SAFETY_REPLY_MODE=warning_only
```

### Actions
1. Select pilot store (recommend: Stone Oak — mid-size, manageable)
2. Brief store manager and team leads
3. Establish escalation protocol: when FAIL warning fires, who responds?
4. Daily dashboard review for first week
5. Weekly review call with store manager

### Success Criteria
- Warnings are accurate (no false FAIL on good readings)
- Team knows how to respond to warnings
- Dashboard shows expected activity (multiple checks per shift)
- Store manager confirms system adds value

### Exit Gate
- [ ] 2-week clean run
- [ ] Store manager written approval
- [ ] Threshold accuracy verified (spot-check readings vs warnings)

---

## Stage 4 — All-Store Pilot

**Objective:** Deploy to all three Bakudan store groups simultaneously.

**Duration:** 2–4 weeks.

### Setup
```bash
# .env — all three stores
FOOD_SAFETY_ALLOWED_CHAT_IDS=<bandera-group-id>,<stone-oak-group-id>,<medical-center-group-id>
```

### Actions
1. Brief all store managers in a group call
2. Publish escalation protocol to all stores
3. Monitor all 3 dashboard feeds daily
4. Weekly cross-store review

### Success Criteria
- All 3 stores using system consistently
- Threshold accuracy holds across all stores
- Telegram forwarding still working (ensure AI control still applies to text messages)
- No performance degradation

### Exit Gate
- [ ] 2-week all-store clean run
- [ ] All 3 store manager sign-offs
- [ ] Threshold accuracy verified across all store images
- [ ] Performance acceptable (< 5s response time per image)

---

## Stage 5 — Real Operations Group

**Objective:** Add the real Bakudan WhatsApp operations group. System is now live for all food safety checks.

**Duration:** Permanent.

### Setup
```bash
# .env — add real ops group
FOOD_SAFETY_ALLOWED_CHAT_IDS=<real-ops-group-id>
# Remove FOOD_SAFETY_TEST_MODE restriction
FOOD_SAFETY_TEST_MODE=false
```

### Actions
1. CEO sends announcement to real ops group explaining the system
2. Publish runbook: what to do when a FAIL warning arrives
3. Add dashboard monitoring to morning checklist
4. Set up weekly automated report (from `/api/food-safety/stats`)

### Success Criteria
- Real ops group receives live warnings
- Floor staff can act on warnings without manager intervention
- System has been running for 1 month with zero critical failures
- Dashboard is the source of truth for food safety compliance

---

## Rollback Procedure

If any stage shows problems:

1. **Immediate:** Set `FOOD_SAFETY_ENABLED=false` in `.env` → restart
2. **Assess:** Review `logs/food-safety.log` and Dashboard
3. **Fix:** Address root cause (threshold accuracy, VISION_API issues, etc.)
4. **Test:** Re-run Stage 1 test plan
5. **Resume:** Continue from the last successful stage

---

## Vision API Recommendations

For production, use one of:

| Provider | Model | Pros |
|---|---|---|
| OpenAI | GPT-4o | Best accuracy for temperature OCR |
| Azure AI Vision | gpt-4o | Enterprise SLA, HIPAA-ready |
| Local LM Studio | llava/llama-vision | No API cost, self-hosted |

**Recommended:** Start with OpenAI GPT-4o for fastest time-to-value. Migrate to Azure for enterprise SLA if needed.

---

## Governance

- **Owner:** CEO / designated Food Safety Manager
- **Review cadence:** Weekly dashboard review until Stage 4, monthly thereafter
- **Threshold changes:** Only via Google Sheet update — no code changes needed
- **Audit trail:** All checks stored in SQLite — retain for 12 months minimum
