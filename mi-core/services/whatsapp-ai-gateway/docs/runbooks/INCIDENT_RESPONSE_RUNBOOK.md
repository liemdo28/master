# Incident Response Runbook — Food Safety AI System

**Audience:** Dev Team  
**Updated:** 2026-06-12

---

## Incident Severity Levels

| Level | Criteria | Response Time |
|---|---|---|
| P1 — Critical | Gateway down, submissions lost, data loss | Immediate (< 15 min) |
| P2 — High | Incorrect PASS for UNSAFE temp, wrong store mapping | < 1 hour |
| P3 — Medium | Sheet sync failed, single submission lost, low OCR accuracy | < 4 hours |
| P4 — Low | Dashboard delay, cosmetic issue, slow API | Next business day |

---

## P1: Gateway Completely Down

**Symptoms:** Bot not responding to photos. No new rows in `food_safety_submissions` for > 30 minutes during shift.

**Diagnosis:**
```bash
pm2 status              # Is process running?
pm2 logs whatsapp-gateway --lines 50    # Any crash/error?
curl localhost:3000/api/food-safety/health   # Is HTTP server up?
```

**Response:**
1. If process crashed: `pm2 restart whatsapp-gateway`
2. If SQLite locked: find and kill the locking process, restart
3. If Puppeteer crashed: `PUPPETEER_HEADLESS=true pm2 restart whatsapp-gateway`
4. Notify store managers via text: "System temporarily down — keep paper forms, will sync when restored"
5. After restart: check `food_safety_submissions` for gaps; re-ingest from paper forms if needed

---

## P2: False PASS on Unsafe Temperature

**Symptoms:** System reported PASS but actual temperature was out of range. Manager caught it on paper form.

**Diagnosis:**
```bash
# Find the submission
SELECT * FROM food_safety_submissions WHERE id = {id};
SELECT parsed_json FROM food_safety_submissions WHERE id = {id};
```

Check `parsed_json` for the reading. Check `ocr_confidence`. Compare to paper form.

**Response:**
1. Manually update status: `UPDATE food_safety_submissions SET status='FAIL' WHERE id={id};`
2. Send manager alert manually via WhatsApp
3. If systematic (multiple false PASSes): check `isCelsius()` logic for false positives, check temp thresholds in template JSON
4. Document in post-mortem — which field, what was read, what was actual

**Root causes to check:**
- `isCelsius()` false positive (was fixed — label-only detection)
- Wrong operator in template JSON (`>=` vs `<=`)
- OCR read garbled value that happened to pass range check

---

## P2: Wrong Store Mapping

**Symptoms:** Submission from Stone Oak shows as Rim (or unknown_store).

**Diagnosis:**
```bash
grep "STONE_OAK_GROUP_CHAT_ID" .env
grep "group.id" logs/gateway.log | grep {actual_chat_id}
```

**Response:**
1. Correct the env var for the affected store
2. `pm2 restart whatsapp-gateway`
3. For already-wrongly-mapped submissions: `UPDATE food_safety_submissions SET store_id='stone_oak' WHERE store_id='rim' AND created_at BETWEEN ...;`
4. Reprocess through pilot tracker: `POST /api/pilot/stone-oak/ingest`

---

## P3: Google Sheet Sync Failed

**Symptoms:** `sync_error` column has errors. `synced_to_sheet_at` is null for recent submissions.

**Diagnosis:**
```bash
SELECT id, store_id, created_at, sync_error FROM food_safety_submissions 
WHERE synced_to_sheet_at IS NULL AND created_at > datetime('now', '-24 hours');
```

**Response:**
1. Check Google API credentials: `GOOGLE_SERVICE_ACCOUNT_KEY` or `GOOGLE_SHEETS_ID` missing/expired
2. If credentials expired: rotate service account key, update `.env`, restart
3. Trigger manual retry: `POST /api/food-safety/sync-pending` (if implemented) or restart gateway (triggers retry on boot)
4. Data is safe in SQLite — no data loss, only sync delay

---

## P3: Low OCR Accuracy (< 80%)

**Symptoms:** High NEEDS_REVIEW rate. Managers reporting AI reads wrong temperatures frequently.

**Diagnosis:**
```bash
SELECT store_id, AVG(ocr_confidence) as avg, MIN(ocr_confidence) as min, COUNT(*) as cnt
FROM food_safety_submissions
WHERE created_at > datetime('now', '-3 days')
GROUP BY store_id;
```

**Root causes to check:**
1. Photo quality degraded — lighting changed, camera dirty, form crumpled
2. Form version mismatch — old v2 form being used with v3 OCR zones
3. Template zone coordinates out of alignment for that store's form

**Response:**
1. Share [photo best practices](../runbooks/MANAGER_RUNBOOK.md#photo-best-practices) with store
2. Verify staff is using the v3 form (check form header in photo)
3. If zone mismatch: re-calibrate OCR zones in template JSON for that store's print layout

---

## P3: Duplicate Submissions

**Symptoms:** Same shift submitted twice. `pilot_stone_oak` shows higher count than expected.

**Diagnosis:**
```bash
SELECT submission_id, COUNT(*) FROM food_safety_submissions 
GROUP BY submission_id HAVING COUNT(*) > 1;
```

**Response:**
- `submission_id UNIQUE` constraint should prevent this at insert time
- If duplicates exist: check if `submission_id` generation is deterministic
- Delete the duplicate: keep the row with higher `ocr_confidence`, delete the other
- If pilot table is affected: `DELETE FROM pilot_stone_oak WHERE id = {lower_id};`

---

## Runbook Update Policy

This runbook must be updated when:
- A new store is added
- Temperature thresholds change
- A new failure mode is discovered in production
- A P1 or P2 incident is resolved (add to known root causes)

Owner: Dev lead. Review quarterly or after any P1 incident.
