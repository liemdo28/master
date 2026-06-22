# Bandera Store — v3 Readiness Report

**Generated:** 2026-06-12  
**Branch:** feature/food-safety-agent-os-tooling  
**Status:** READY FOR PILOT (pending Stone Oak pilot PASS and Rim pilot PASS)

---

## 1. v3 Form Deliverables

| Artifact | File | Size | Status |
|---|---|---|---|
| OCR Template JSON | `data/templates/FoodSafety-Bandera-v3.json` | 19 fields / 38 zones | COMPLETE |
| Print Form PDF | `docs/forms/FoodSafety-Bandera-LineCheck-v3.pdf` | 5,050 bytes | COMPLETE |
| PDF Generator | `docs/forms/generate_v3_bandera.py` | ReportLab | COMPLETE |

Badge: **PENDING PILOT APPROVAL** (grey)

---

## 2. Field Map Summary

| Field ID | Item | Type | Target | Operator |
|---|---|---|---|---|
| BAN-01 | Date | text | — | — |
| BAN-02 | Shift | text | AM/PM | — |
| BAN-03 | Employee Name | text | — | — |
| BAN-04 | Walk-In Cooler | temperature | 40°F | ≤ |
| BAN-05 | Reach-In Cooler #1 | temperature | 40°F | ≤ |
| BAN-06 | Reach-In Cooler #2 | temperature | 40°F | ≤ |
| BAN-07 | Prep Table | temperature | 40°F | ≤ |
| BAN-08 | Soup Bar | temperature | 40°F | ≤ |
| BAN-09 | Pork Chashu | temperature | 40°F | ≤ (cold hold) |
| BAN-10 | Chicken Chashu | temperature | 40°F | ≤ (cold hold) |
| BAN-11 | Fryer #1 | temperature | 325°F | ≥ |
| BAN-12 | Fryer #2 | temperature | 325°F | ≥ |
| BAN-13 | Tonkotsu Broth | temperature | 200°F | ≥ |
| BAN-14 | Miso Broth | temperature | 200°F | ≥ |
| BAN-15 | Shoyu Broth | temperature | 200°F | ≥ |
| BAN-16 | Bowl Warmers | temperature | 100°F | ≥ |
| BAN-17 | Rice Cooker | temperature | 200°F | ≥ |
| BAN-18 | Noodle Boiler | temperature | 200°F | ≥ |
| BAN-19 | Manager Signature | text | — | — |

**Required fields (★):** BAN-01, BAN-02, BAN-06, BAN-09, BAN-10, BAN-11, BAN-12, BAN-16, BAN-17, BAN-18 (10 of 19)

---

## 3. OCR Configuration

| Setting | Value |
|---|---|
| Zones | 38 |
| Confidence — Pass | 0.80 |
| Confidence — Warn | 0.55 |
| Confidence — Review | 0.35 |
| Store ID | `bandera` |
| Form Version | `3.0` |
| Pilot Flag | `false` |

---

## 4. Store Mapping

Environment variable required: `BANDERA_GROUP_CHAT_ID`  
Mapped in: `src/stores/store-registry.js`  
Configure before pilot activation.

---

## 5. Pre-Pilot Checklist

- [ ] Stone Oak pilot PASS confirmed
- [ ] Rim pilot PASS confirmed
- [ ] `BANDERA_GROUP_CHAT_ID` set in production `.env`
- [ ] Kitchen Log WhatsApp group at Bandera store has gateway bot added
- [ ] 5 test form photos submitted and validated
- [ ] Staff training completed (same curriculum as Rim)

---

## 6. Verdict

**READINESS: CONDITIONAL PASS**  
All artifacts complete. Activation requires both Stone Oak and Rim pilots to pass.
