# Rim Store — v3 Readiness Report

**Generated:** 2026-06-12  
**Branch:** feature/food-safety-agent-os-tooling  
**Status:** READY FOR PILOT (pending Stone Oak pilot PASS)

---

## 1. v3 Form Deliverables

| Artifact | File | Size | Status |
|---|---|---|---|
| OCR Template JSON | `data/templates/FoodSafety-Rim-v3.json` | 19 fields / 38 zones | COMPLETE |
| Print Form PDF | `docs/forms/FoodSafety-Rim-LineCheck-v3.pdf` | 5,041 bytes | COMPLETE |
| PDF Generator | `docs/forms/generate_v3_rim.py` | ReportLab | COMPLETE |

Badge: **PENDING PILOT APPROVAL** (grey — activates to PILOT after Stone Oak PASS)

---

## 2. Field Map Summary

| Field ID | Item | Type | Target | Operator |
|---|---|---|---|---|
| RIM-01 | Date | text | — | — |
| RIM-02 | Shift | text | AM/PM | — |
| RIM-03 | Employee Name | text | — | — |
| RIM-04 | Walk-In Cooler | temperature | 40°F | ≤ |
| RIM-05 | Reach-In Cooler #1 | temperature | 40°F | ≤ |
| RIM-06 | Reach-In Cooler #2 | temperature | 40°F | ≤ |
| RIM-07 | Prep Table | temperature | 40°F | ≤ |
| RIM-08 | Soup Bar | temperature | 40°F | ≤|
| RIM-09 | Pork Chashu | temperature | 40°F | ≤ (cold hold) |
| RIM-10 | Chicken Chashu | temperature | 40°F | ≤ (cold hold) |
| RIM-11 | Fryer #1 | temperature | 325°F | ≥ |
| RIM-12 | Fryer #2 | temperature | 325°F | ≥ |
| RIM-13 | Tonkotsu Broth | temperature | 200°F | ≥ |
| RIM-14 | Miso Broth | temperature | 200°F | ≥ |
| RIM-15 | Shoyu Broth | temperature | 200°F | ≥ |
| RIM-16 | Bowl Warmers | temperature | 100°F | ≥ |
| RIM-17 | Rice Cooker | temperature | 200°F | ≥ |
| RIM-18 | Noodle Boiler | temperature | 200°F | ≥ |
| RIM-19 | Manager Signature | text | — | — |

**Required fields (★):** RIM-01, RIM-02, RIM-06, RIM-09, RIM-10, RIM-11, RIM-12, RIM-16, RIM-17, RIM-18 (10 of 19)

---

## 3. OCR Configuration

| Setting | Value |
|---|---|
| Zones | 38 (label + value per field) |
| Confidence — Pass | 0.80 |
| Confidence — Warn | 0.55 |
| Confidence — Review | 0.35 |
| Store ID | `rim` |
| Form Version | `3.0` |
| Pilot Flag | `false` |

---

## 4. Store Mapping

Environment variable required: `RIM_GROUP_CHAT_ID`  
Mapped in: `src/stores/store-registry.js`  
If not set: submissions tagged `unknown_store` — configure before pilot starts.

---

## 5. Pre-Pilot Checklist

- [ ] `RIM_GROUP_CHAT_ID` set in production `.env`
- [ ] Stone Oak pilot has reached **PASS** verdict
- [ ] Kitchen Log WhatsApp group at Rim store has gateway bot added
- [ ] 5 test form photos submitted and reviewed by manager before staff training
- [ ] Staff trained on v3 form: ★ required fields, temp gun calibration, shift labels
- [ ] Manager has access to `/api/pilot/stone-oak/report` equivalent for Rim

---

## 6. Verdict

**READINESS: CONDITIONAL PASS**  
All artifacts complete. Activation blocked on Stone Oak pilot completion per CEO directive.  
> "Do not move to Rim or Bandera until Stone Oak pilot passes."
