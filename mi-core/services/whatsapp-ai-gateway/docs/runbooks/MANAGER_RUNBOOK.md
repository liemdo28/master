# Manager Runbook — Food Safety AI System

**Audience:** Store Manager  
**System:** WhatsApp Food Safety OCR  
**Updated:** 2026-06-12

---

## Your Role

You supervise the food safety check process at your store. The AI processes the photos your team sends, but you are the final authority on any flagged submission.

---

## Daily Workflow

### Before Each Shift

1. Make sure the food safety form is printed and at the line (v3 form with your store name on it)
2. Remind staff: photo must be taken after ALL temps are filled in, not mid-sheet
3. Make sure your store's Kitchen Log WhatsApp group has the gateway bot active

### After Staff Submits

The bot will reply in the WhatsApp group within 30 seconds:
- **"Submission received — all temps OK"** → done
- **"Submission needs review — see item X"** → you must review (see below)
- **"UNSAFE: [item] at [temp]"** → take immediate corrective action

---

## How to Review a Flagged Submission

You'll get a WhatsApp message:
```
NEEDS REVIEW: Submission #1042 from Stone Oak AM
Walk-In Cooler: AI read 35°F (low confidence: 62%)
Please verify the actual reading and confirm or correct.
Reply: /confirm 1042 OR /correct 1042 38
```

Commands:
- `/confirm [id]` — the AI reading is correct
- `/correct [id] [actual_value]` — AI was wrong, here's the real temp
- `/retake [id]` — send a new photo of that item

---

## Common Issues

### "Photo Rejected — Too Blurry"
- Staff must hold the camera still for 2 seconds before snapping
- Good lighting is required — open refrigerator door fully before photographing
- Camera must be perpendicular to form, not at an angle

### "Wrong Store Detected"
- This means the bot thought the photo came from a different store
- Reply `/correct-store [id] stone_oak` (or rim/bandera)
- Report to dev team so the group chat ID can be fixed

### "Missing Submission Alert"
- You'll receive this if no form was submitted for a shift by 2pm (AM) or 11pm (PM)
- Check with staff — did they send it to the right group?
- If submission was lost, have staff re-submit with a new photo

---

## Viewing Your Store's Results

Access the command center API from your device:
```
GET /api/metrics/store/stone_oak
```
(replace `stone_oak` with your store ID)

Shows: today's submissions, OCR accuracy, any open alerts.

---

## Photo Best Practices

| Do | Don't |
|---|---|
| Fill in ALL fields before photographing | Photo partial forms |
| Use good overhead lighting | Use flash (creates glare on pen marks) |
| Hold phone flat over form | Angle the camera |
| Capture the entire form including header | Crop out the store name or date |
| Use dark pen, press firmly | Use pencil or light-colored ink |

---

## Emergency: Submission Lost / System Down

If the gateway is not responding to photos:
1. Complete the paper form as normal — do not skip the check
2. Keep the paper form on file
3. Text the dev team: "Gateway not responding at [store] since [time]"
4. Once system is back up, photograph and re-send the saved forms

**Paper forms must be kept for 30 days regardless of digital system status.**
