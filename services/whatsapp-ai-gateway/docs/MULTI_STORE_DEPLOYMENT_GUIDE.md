# Multi-Store Deployment Guide

**Bakudan Food Safety Gateway**  
**Stores:** Stone Oak · Rim · Bandera  
**Last updated:** 2026-06-12

> Each store gets its own Windows machine running a dedicated gateway instance. Stores do not share a database or gateway process.

---

## Table of Contents

1. [Stone Oak](#1-stone-oak)
2. [Rim](#2-rim)
3. [Bandera](#3-bandera)
4. [Common Steps (All Stores)](#4-common-steps-all-stores)

---

## 1. Stone Oak

**Status:** Live (pilot complete — PASS)  
**Store ID:** `stone_oak`  
**OCR Template:** `data/templates/FoodSafety-StoneOak-v3.json`  
**Form:** `docs/forms/FoodSafety-StoneOak-LineCheck-v3.pdf`

### Store Mapping

```env
STONE_OAK_GROUP_CHAT_ID=<WhatsApp JID for Stone Oak group>
STORE_ID_DEFAULT=stone_oak
OCR_TEMPLATE_STONE_OAK=data/templates/FoodSafety-StoneOak-v3.json
```

Find the group chat JID: send any message to the group, check `logs/gateway.log` for:
```
[router] Incoming message from: 12345678901234567890@g.us
```
That `@g.us` string is the JID.

### WhatsApp Mapping

| Group Name | JID Suffix | Env Var |
|---|---|---|
| Bakudan Stone Oak Food Safety | `@g.us` | `STONE_OAK_GROUP_CHAT_ID` |

### OCR Template

Stone Oak form has 38 OCR zones covering:
- RTE proteins (chicken, beef, pork) — cold hold temps
- Sauces and condiments — date labels
- Hot hold items — temp + time
- Equipment temps — grill, fryer, cooler, walk-in
- Manager sign-off field

Confidence threshold: 0.75 (below this → `NEEDS_REVIEW`, manager alerted)

### Validation Checklist

```
[ ] Installation complete (DEPLOYMENT_CERTIFICATION_REPORT.md — PASS)
[ ] Dashboard accessible at http://localhost:3210
[ ] WhatsApp QR scanned with Stone Oak phone
[ ] STONE_OAK_GROUP_CHAT_ID set in .env
[ ] Google service account JSON in ProgramData/config/
[ ] Test form photo submitted → appears in dashboard
[ ] Google Sheet receives entry
[ ] OCR confidence ≥ 0.75 on test submission
[ ] Manager alert fires on simulated violation
[ ] Pilot: 10/10 forms PASS (pilot_stone_oak table complete)
```

### Go-Live Checklist

```
[ ] All validation checks above complete
[ ] Store manager trained (Manager Runbook delivered)
[ ] Staff trained on form completion (Quick Start Guide delivered)
[ ] WhatsApp group has all staff members
[ ] Backup of ProgramData confirmed (manual snapshot taken)
[ ] CEO notified: Stone Oak live
[ ] Monitoring: check dashboard daily for first 2 weeks
```

### Rollback Checklist (Stone Oak specific)

```
[ ] Issue identified and documented
[ ] schtasks /end /tn BakudanFoodSafety
[ ] powershell -File updater\bakudan-updater.ps1 rollback latest
[ ] Health check: GET /api/health returns 200
[ ] WhatsApp session still active: GET /api/whatsapp/session
[ ] Test submission processed correctly
[ ] Incident logged in INCIDENT_RESPONSE_RUNBOOK.md
[ ] CEO notified of rollback
```

---

## 2. Rim

**Status:** Ready for deployment (RIM_READINESS_REPORT.md — CONDITIONAL PASS)  
**Target week:** Week 2 after Stone Oak go-live  
**Store ID:** `rim`  
**OCR Template:** `data/templates/FoodSafety-Rim-v3.json`  
**Form:** `docs/forms/FoodSafety-Rim-LineCheck-v3.pdf`

### Store Mapping

```env
RIM_GROUP_CHAT_ID=<WhatsApp JID for Rim group>
OCR_TEMPLATE_RIM=data/templates/FoodSafety-Rim-v3.json
```

### WhatsApp Mapping

| Group Name | JID Suffix | Env Var |
|---|---|---|
| Bakudan Rim Food Safety | `@g.us` | `RIM_GROUP_CHAT_ID` |

### OCR Template

Rim form (`FoodSafety-Rim-v3.json`) has 38 OCR zones across 19 line items (RIM-01 through RIM-19):
- `store_id` field hardcoded to `rim`
- Same zone layout as Stone Oak with Rim-specific label positions
- Calibrated for Rim store's printed form dimensions

### Installation Steps (Rim)

```
1. Copy installer package to Rim store machine (USB or network share)
2. Double-click: Install Bakudan Food Safety.bat
3. Wait ~65 seconds for installation
4. Dashboard opens at http://localhost:3210
5. Navigate to WhatsApp panel → scan QR with Rim store phone
6. Open ProgramData/BakudanFoodSafety/config/.env
   Add: RIM_GROUP_CHAT_ID=<JID from step below>
7. Find JID: send any message to Rim WhatsApp group
   Check gateway.log for the @g.us address
8. Save .env → restart gateway (Stop + Start shortcuts)
9. Copy google-service-account.json to ProgramData/config/
10. Send test form photo → verify in dashboard
```

### Validation Checklist

```
[ ] Installation complete and dashboard accessible
[ ] WhatsApp QR scanned with Rim store phone
[ ] RIM_GROUP_CHAT_ID set in .env
[ ] Google service account JSON in ProgramData/config/
[ ] Test photo submitted using FoodSafety-Rim-LineCheck-v3.pdf form
[ ] Submission appears in dashboard with store_id=rim
[ ] OCR fields populated correctly (spot-check 5 zones)
[ ] Google Sheet entry created with rim store data
[ ] Manager alert tested (submit a temp violation)
[ ] Dashboard shows Rim data in metrics panels
```

### Go-Live Checklist

```
[ ] All validation checks above complete
[ ] Stone Oak has been live ≥ 1 week with no critical issues
[ ] Rim manager trained (Manager Runbook)
[ ] Rim staff briefed on form (Quick Start Guide)
[ ] Backup taken: manual snapshot of ProgramData
[ ] CEO approval for Rim go-live
[ ] Go-live date confirmed with Rim manager
[ ] Monitoring: check Rim dashboard daily for first 2 weeks
```

### Rollback Checklist

```
[ ] Issue identified and documented
[ ] schtasks /end /tn BakudanFoodSafety
[ ] powershell -File updater\bakudan-updater.ps1 rollback latest
[ ] Health check passes
[ ] WhatsApp session intact
[ ] Test submission processes correctly
[ ] Incident documented
[ ] CEO notified
```

---

## 3. Bandera

**Status:** Ready for deployment (BANDERA_READINESS_REPORT.md — CONDITIONAL PASS)  
**Target week:** Week 3 after Stone Oak go-live  
**Store ID:** `bandera`  
**OCR Template:** `data/templates/FoodSafety-Bandera-v3.json`  
**Form:** `docs/forms/FoodSafety-Bandera-LineCheck-v3.pdf`

### Store Mapping

```env
BANDERA_GROUP_CHAT_ID=<WhatsApp JID for Bandera group>
OCR_TEMPLATE_BANDERA=data/templates/FoodSafety-Bandera-v3.json
```

### WhatsApp Mapping

| Group Name | JID Suffix | Env Var |
|---|---|---|
| Bakudan Bandera Food Safety | `@g.us` | `BANDERA_GROUP_CHAT_ID` |

### OCR Template

Bandera form (`FoodSafety-Bandera-v3.json`) has 38 OCR zones across 19 line items (BAN-01 through BAN-19):
- `store_id` field hardcoded to `bandera`
- Calibrated for Bandera store's printed form dimensions

### Installation Steps (Bandera)

```
1. Copy installer package to Bandera store machine
2. Double-click: Install Bakudan Food Safety.bat
3. Wait ~65 seconds for installation
4. Dashboard opens at http://localhost:3210
5. Scan QR with Bandera store phone
6. Open ProgramData/BakudanFoodSafety/config/.env
   Add: BANDERA_GROUP_CHAT_ID=<JID>
7. Find JID: send message to Bandera group, check gateway.log
8. Save .env → restart gateway
9. Copy google-service-account.json to ProgramData/config/
10. Send test form photo → verify in dashboard
```

### Validation Checklist

```
[ ] Installation complete and dashboard accessible
[ ] WhatsApp QR scanned with Bandera store phone
[ ] BANDERA_GROUP_CHAT_ID set in .env
[ ] Google service account JSON present
[ ] Test photo submitted using FoodSafety-Bandera-LineCheck-v3.pdf
[ ] Submission appears with store_id=bandera
[ ] OCR zones correct (spot-check 5 fields)
[ ] Google Sheet entry created
[ ] Manager alert works
[ ] Dashboard shows Bandera in metrics
```

### Go-Live Checklist

```
[ ] All validation checks above complete
[ ] Rim has been live ≥ 1 week with no critical issues
[ ] Bandera manager trained
[ ] Bandera staff briefed
[ ] Backup taken
[ ] CEO approval for Bandera go-live
[ ] Go-live date set
[ ] Monitoring: daily check for first 2 weeks
```

### Rollback Checklist

```
[ ] Issue identified and documented
[ ] schtasks /end /tn BakudanFoodSafety
[ ] powershell -File updater\bakudan-updater.ps1 rollback latest
[ ] Health check passes
[ ] WhatsApp session intact
[ ] Test submission processes correctly
[ ] Incident documented
[ ] CEO notified
```

---

## 4. Common Steps (All Stores)

### Finding the WhatsApp Group JID

```
1. Make sure gateway is running and WhatsApp is READY
2. Send any message to the store's WhatsApp group (even "test")
3. Open gateway.log:
   Get-Content C:\ProgramData\BakudanFoodSafety\logs\gateway.log -Tail 20
4. Look for a line like:
   [router] Incoming message from: 1234567890-1234567890@g.us
5. Copy that full @g.us string — that is the GROUP_CHAT_ID value
```

### Configuring .env

```
File: C:\ProgramData\BakudanFoodSafety\config\.env

Required variables per store:
   STONE_OAK_GROUP_CHAT_ID=<JID>    (Stone Oak machine only)
   RIM_GROUP_CHAT_ID=<JID>          (Rim machine only)
   BANDERA_GROUP_CHAT_ID=<JID>      (Bandera machine only)

After editing .env:
   Stop gateway:  schtasks /end /tn BakudanFoodSafety
   Start gateway: schtasks /run /tn BakudanFoodSafety
   Wait 15s, then verify: GET http://localhost:3210/api/health
```

### Google Service Account Setup

```
1. In Google Cloud Console: create service account (or reuse existing)
2. Download JSON key file
3. Rename to: google-service-account.json
4. Copy to: C:\ProgramData\BakudanFoodSafety\config\google-service-account.json
5. In Google Sheets: Share the target sheet with the service account email
   (found in the JSON file as "client_email")
6. Grant: Editor role
7. Restart gateway and verify Sheet sync in dashboard
```

### Multi-Store Dashboard (CEO View)

The dashboard at `http://localhost:3210` on any store machine shows metrics for all stores (if their data exists in the local DB). For a true multi-store view, the CEO accesses the Stone Oak machine dashboard which aggregates via the Google Sheet.

Production multi-store dashboard URL: `http://dashboard.bakudanramen.com` (separate deployment).

---

## Deployment Status Summary

| Store | Status | Go-Live | Notes |
|---|---|---|---|
| Stone Oak | **LIVE** | Pilot complete | 10/10 pilot forms PASS |
| Rim | Ready | Week 2 | CONDITIONAL PASS — needs live QR scan |
| Bandera | Ready | Week 3 | CONDITIONAL PASS — needs live QR scan |
