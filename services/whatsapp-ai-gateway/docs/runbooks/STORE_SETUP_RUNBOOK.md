# Store Setup Runbook — Onboarding a New Location

**Audience:** Dev Team / System Admin  
**Updated:** 2026-06-12

---

## Prerequisites

- WhatsApp gateway server running and accessible
- Production `.env` file accessible on server
- Store has a WhatsApp group for kitchen staff ("Kitchen Log — [Store]")
- Store-specific v3 PDF form generated (see Step 3)

---

## Step 1: Get the Group Chat ID

1. Add the gateway bot phone number to the store's Kitchen Log WhatsApp group
2. Have someone send any message in the group
3. Check gateway logs: `grep "group.id" logs/gateway.log | tail -5`
4. The group chat ID looks like: `120363XXXXXXXXXX@g.us`

---

## Step 2: Set Environment Variable

Add to production `.env`:
```env
# For Stone Oak (already exists):
STONE_OAK_GROUP_CHAT_ID=120363XXXXXXXXXX@g.us

# For Rim:
RIM_GROUP_CHAT_ID=120363YYYYYYYYYY@g.us

# For Bandera:
BANDERA_GROUP_CHAT_ID=120363ZZZZZZZZZZ@g.us
```

Restart the gateway: `pm2 restart whatsapp-gateway` (or your process manager)

---

## Step 3: Verify Store Mapping

Send a test message from the store group. Check:
```
GET /api/food-safety/health
```

Look for the store ID in the response. If store shows `unknown_store`, the env var is missing or misspelled.

---

## Step 4: Generate v3 Form PDF

```bash
cd docs/forms

# Stone Oak (already exists):
python generate_v3_stoneoak.py

# Rim:
python generate_v3_rim.py

# Bandera:
python generate_v3_bandera.py
```

Print on US Letter paper, black and white. Laminate one copy for the manager station.

---

## Step 5: Load OCR Template

Verify the template JSON is present:
```
data/templates/FoodSafety-StoneOak-v3.json   ← stone_oak
data/templates/FoodSafety-Rim-v3.json         ← rim
data/templates/FoodSafety-Bandera-v3.json     ← bandera
```

The gateway auto-loads templates on startup — no additional step needed.

---

## Step 6: Staff Training (30 minutes)

Walk through with the AM shift lead:
1. Show them the v3 form — point out ★ required fields
2. Explain: fill ALL fields, then photograph
3. Demonstrate: send a test photo in the Kitchen Log group
4. Show them the bot reply — what PASS/NEEDS REVIEW/UNSAFE looks like
5. Show the manager how to `/confirm` and `/correct`

Leave 5 printed forms at the store for the first week.

---

## Step 7: Submit 5 Test Forms

Before going live, submit 5 real test forms across both shifts (AM and PM). Review each one:
- OCR accuracy ≥ 80% on all temperature readings
- No false UNSAFE flags
- Google Sheet received the rows
- Dashboard shows the store name correctly

If any test fails, debug before training remaining staff.

---

## Step 8: Activate Pilot (if applicable)

Stone Oak: set `pilot: true` in `FoodSafety-StoneOak-v3.json` (already set)  
Rim/Bandera: update `pilot: true` only after Stone Oak pilot PASS

Track via:
```
GET /api/pilot/stone-oak/report
```

---

## Step 9: Post-Launch Monitoring (Week 1)

Check daily:
- `GET /api/metrics/store/{store_id}` — submissions, accuracy, alerts
- `GET /api/metrics/submission-trend?days=7` — daily count trend

Any day with 0 submissions = escalate immediately (gateway or staff issue).

---

## Store ID Reference

| Store | store_id | ENV var |
|---|---|---|
| Stone Oak | `stone_oak` | `STONE_OAK_GROUP_CHAT_ID` |
| Rim | `rim` | `RIM_GROUP_CHAT_ID` |
| Bandera | `bandera` | `BANDERA_GROUP_CHAT_ID` |
