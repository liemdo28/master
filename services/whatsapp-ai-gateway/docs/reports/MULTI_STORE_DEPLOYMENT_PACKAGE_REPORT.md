# Multi-Store Deployment Package Report

**Generated:** 2026-06-12  
**Stores:** Stone Oak · Rim · Bandera  
**Status:** Package complete — ready for deployment

---

## Package Contents

### 1. Installer

| File | Description |
|---|---|
| `installer/Install Bakudan Food Safety.bat` | Double-click entry point — auto-elevates, runs install.ps1 |
| `installer/install.ps1` | Full Windows installer (silent mode supported) |
| `installer/runtime/node-v24.14.1-win-x64.zip` | Bundled Node.js (no internet required) |
| `installer/runtime/chrome-win64/` | Bundled Chromium for WhatsApp Web.js |
| `installer/source/BakudanFoodSafety-app.zip` | Bundled application source |

**No internet required during installation.**

---

### 2. Forms (per store)

| Store | Checklist Form | Template File |
|---|---|---|
| Stone Oak | `docs/forms/FoodSafety-StoneOak-LineCheck-v3.pdf` | `data/templates/FoodSafety-StoneOak-v3.json` |
| Rim | `docs/forms/FoodSafety-Rim-LineCheck-v3.pdf` | `data/templates/FoodSafety-Rim-v3.json` |
| Bandera | `docs/forms/FoodSafety-Bandera-LineCheck-v3.pdf` | `data/templates/FoodSafety-Bandera-v3.json` |

Each form covers the full line check: RTE proteins, sauces, prep items, hot hold, cold hold, and equipment temps.  
OCR templates include 38 zones per form with confidence thresholds calibrated per store layout.

---

### 3. Runbooks

| Document | Audience | Location |
|---|---|---|
| CEO Runbook | Owner / Leadership | `docs/runbooks/CEO_RUNBOOK.md` |
| Manager Runbook | Store Managers | `docs/runbooks/MANAGER_RUNBOOK.md` |
| Store Setup Runbook | IT / Setup Person | `docs/runbooks/STORE_SETUP_RUNBOOK.md` |
| Incident Response Runbook | On-call / Manager | `docs/runbooks/INCIDENT_RESPONSE_RUNBOOK.md` |

---

### 4. Quick Start Guide (per store)

**Stone Oak — Quick Start**

```
1. Double-click "Install Bakudan Food Safety" on the desktop installer
2. Wait ~65 seconds for installation to complete
3. Dashboard opens automatically at http://localhost:3210
4. Scan WhatsApp QR code with the Stone Oak store phone
5. Add store phone to WhatsApp group: Bakudan Stone Oak Food Safety
6. Send a test photo of a filled form to the group
7. Confirm submission appears in dashboard
```

**Rim — Quick Start**

```
1. Double-click "Install Bakudan Food Safety" on the desktop installer
2. Wait ~65 seconds for installation to complete
3. Dashboard opens automatically at http://localhost:3210
4. Scan WhatsApp QR code with the Rim store phone
5. Add store phone to WhatsApp group: Bakudan Rim Food Safety
6. Set RIM_GROUP_CHAT_ID in ProgramData/BakudanFoodSafety/config/.env
7. Send a test photo of a filled form to the group
8. Confirm submission appears in dashboard
```

**Bandera — Quick Start**

```
1. Double-click "Install Bakudan Food Safety" on the desktop installer
2. Wait ~65 seconds for installation to complete
3. Dashboard opens automatically at http://localhost:3210
4. Scan WhatsApp QR code with the Bandera store phone
5. Add store phone to WhatsApp group: Bakudan Bandera Food Safety
6. Set BANDERA_GROUP_CHAT_ID in ProgramData/BakudanFoodSafety/config/.env
7. Send a test photo of a filled form to the group
8. Confirm submission appears in dashboard
```

---

### 5. Troubleshooting Guide

#### WhatsApp won't connect

| Symptom | Fix |
|---|---|
| QR code not showing | Restart gateway: Start Bakudan Gateway shortcut |
| QR code shows but scan fails | Use latest WhatsApp on phone, ensure good camera |
| Disconnects after a few hours | Heartbeat watchdog auto-reconnects — wait 15–120s |
| Session lost after Windows update | Re-scan QR; session in ProgramData survives app updates but not phone re-link |

#### Form photos not processing

| Symptom | Fix |
|---|---|
| Photo received but no submission in dashboard | Check OCR log: `ProgramData/BakudanFoodSafety/logs/ocr.log` |
| Submission shows NEEDS_REVIEW | OCR confidence too low — resubmit with better lighting |
| "Unknown store" error | Verify group chat ID in `.env` matches WhatsApp group |

#### Dashboard not loading

| Symptom | Fix |
|---|---|
| http://localhost:3210 refuses connection | Gateway not running — use Start Bakudan Gateway shortcut |
| Gateway crashes on start | Check `ProgramData/BakudanFoodSafety/logs/gateway.log` for error |
| "DB locked" error | Only one instance of gateway should run — check Task Manager for duplicate node.exe |

#### Update failed

| Symptom | Fix |
|---|---|
| "Update failed — rolled back" in dashboard | Auto-rollback succeeded; app is on previous version; check logs |
| App won't start after update | Open Update panel → Rollback to previous version |
| Can't reach update server | Check internet connection; updater requires HTTPS to GitHub releases |

#### Google Sheets not syncing

| Symptom | Fix |
|---|---|
| Submissions appear in dashboard but not in Sheet | Verify `google-service-account.json` in `ProgramData/config/` |
| "Permission denied" on sync | Share the Google Sheet with the service account email |
| Sheet sync error in logs | Check `ProgramData/BakudanFoodSafety/logs/gateway.log` for SHEETS_ERROR |

---

## Per-Store Configuration Reference

### Stone Oak

```env
STONE_OAK_GROUP_CHAT_ID=<WhatsApp group JID>
STORE_ID_DEFAULT=stone_oak
OCR_TEMPLATE_STONE_OAK=data/templates/FoodSafety-StoneOak-v3.json
```

### Rim

```env
RIM_GROUP_CHAT_ID=<WhatsApp group JID>
OCR_TEMPLATE_RIM=data/templates/FoodSafety-Rim-v3.json
```

### Bandera

```env
BANDERA_GROUP_CHAT_ID=<WhatsApp group JID>
OCR_TEMPLATE_BANDERA=data/templates/FoodSafety-Bandera-v3.json
```

---

## Deployment Sequence

### Recommended order

```
Week 1: Stone Oak (pilot — already live)
Week 2: Rim
Week 3: Bandera
```

### Per-store deployment checklist

```
[ ] Install application (installer/Install Bakudan Food Safety.bat)
[ ] Verify dashboard loads (http://localhost:3210)
[ ] Scan WhatsApp QR with store phone
[ ] Set GROUP_CHAT_ID in .env
[ ] Restart gateway (Stop → Start shortcut)
[ ] Copy google-service-account.json to ProgramData/config/
[ ] Send test form photo to WhatsApp group
[ ] Verify submission in dashboard
[ ] Verify sync to Google Sheet
[ ] Train manager (Manager Runbook)
[ ] Train staff (Quick Start Guide)
[ ] Confirm go-live with CEO
```

---

## Deployment Package Checklist

| Component | Status |
|---|---|
| Installer (install.ps1 + .bat) | ✓ Complete |
| Bundled Node.js v24.14.1 | ✓ Complete |
| Bundled Chromium 148.0 | ✓ Complete |
| Stone Oak form + OCR template | ✓ Complete |
| Rim form + OCR template (v3) | ✓ Complete |
| Bandera form + OCR template (v3) | ✓ Complete |
| CEO Runbook | ✓ Complete |
| Manager Runbook | ✓ Complete |
| Store Setup Runbook | ✓ Complete |
| Incident Response Runbook | ✓ Complete |
| Quick Start Guides (3 stores) | ✓ Complete |
| Troubleshooting Guide | ✓ Complete |
| Auto-updater (bakudan-updater.ps1) | ✓ Complete |
| Deployment sequence defined | ✓ Complete |

**14/14 complete.**

---

## Verdict

**COMPLETE** — Deployment package ready for Stone Oak, Rim, and Bandera. All installer components, store-specific forms, OCR templates, runbooks, quick start guides, and troubleshooting documentation are in place. Deployment sequence: Stone Oak (live) → Rim (Week 2) → Bandera (Week 3).
