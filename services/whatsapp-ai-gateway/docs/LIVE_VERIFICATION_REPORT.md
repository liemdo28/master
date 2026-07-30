# Live Verification Report — /broth Workflow
**Date:** 2026-06-03  
**Version:** 1.0.0  
**Directive:** CEO Directive — Live Verify /broth Workflow

---

## Automated Results (no phone required)

| Step | Command | Result | Detail |
|---|---|---|---|
| 13a | `npm test` | ✅ PASS | 320/320 tests across 4 suites |
| 13b | `live-validator --no-telegram` | ✅ PASS | 85/85 scenarios, 69 messages simulated |
| 13c | `sheet-write-test.js` | ✅ SENT | Row written to `WhatsApp_AI_Daily_Log` |
| 13d | `.\pack.ps1` | ✅ PASS | Clean zip, no secrets/session/node_modules |

---

## Test Suite Breakdown

| Suite | Tests | Status |
|---|---|---|
| Core AI + Safety (run-tests.js) | 64 | ✅ |
| Food Safety (food-safety-tests.js) | 105 | ✅ |
| Broth Command (broth-command-tests.js) | 88 | ✅ |
| Architecture (architecture-tests.js) | 63 | ✅ |
| **Total** | **320** | **✅ ALL PASSED** |

---

## Simulation Validator — Scenarios Verified (no phone)

| Scenario | Messages | Result |
|---|---|---|
| 1 — Normal message matrix (FAQ, stores, hours, menu, rewards) | 10 | ✅ |
| 2 — Escalation matrix (refund, manager, complaint, angry, unclear) | 6 | ✅ |
| 3 — Rate limiting (soft at 11, hard at 31+) | 44 | ✅ |
| 4 — Global AI pause / resume | 2 | ✅ |
| 5 — Human takeover (per-number, other users unaffected) | 3 | ✅ |
| 6 — Blocklist (silent drop, no Telegram forward) | 2 | ✅ |
| 7 — Business hours (closed message, open hours) | 2 | ✅ |
| 8 — Database & stats | — | ✅ |
| **Total** | **69** | **85/85 assertions** |

---

## /broth Command — Unit Test Coverage (88 tests)

| Test | Result |
|---|---|
| T1: Direct `/broth` → asks store selection | ✅ |
| T2: Direct `/broth Stone Oak` → shows form immediately | ✅ |
| T3: Group `/broth` + store in group name → shows form | ✅ |
| T4: `/broth` does not fall through to AI | ✅ |
| T5: Valid counts → `WAITING_CONFIRM`, sheet NOT written yet | ✅ |
| T6: `CONFIRM` → finalizes, writes/queues sheet | ✅ |
| T7: `CANCEL` → session deleted, no sheet write | ✅ |
| T8: `STATUS` → shows draft, session preserved | ✅ |
| T9: `EDIT 6 42` → updates Shoyu by number | ✅ |
| T10: `EDIT Shoyu 42` → updates by name | ✅ |
| T11: Partial counts → asks for missing items | ✅ |
| T12: Invalid values (text) → rejected | ✅ |
| T13: Multi-user in same group → independent sessions | ✅ |
| T14: Test mode + empty allowlist → direct chat allowed | ✅ |
| T15: Test mode + empty allowlist → group blocked | ✅ |
| T16: Test mode + matching group → group allowed | ✅ |
| Parser: CONFIRM / YES / OK | ✅ |
| Parser: CANCEL / ABORT | ✅ |
| Parser: STATUS / DRAFT | ✅ |
| Parser: EDIT 6 42 (by number) | ✅ |
| Parser: EDIT Shoyu 42 (by name) | ✅ |
| Parser: CSV `34,34,...` (11 values) | ✅ |
| Parser: Line format `1. 34` | ✅ |
| Parser: Named format `Shoyu = 42` | ✅ |

---

## Package Verification

```
Zip: whatsapp-ai-gateway-v1.0.0.zip
Files: 116
Excluded (verified absent):
  ✅ .env
  ✅ node_modules/
  ✅ secrets/
  ✅ data/session/
  ✅ .wwebjs_auth/
  ✅ .wwebjs_cache/
  ✅ logs/
  ✅ data/*.db
```

---

## Google Sheet Write Test

```json
{
  "ok": true,
  "status": "SENT",
  "tab": "WhatsApp_AI_Daily_Log",
  "rows": 1
}
```

Sheet: https://docs.google.com/spreadsheets/d/1x_AhaoZhYgBX2zWOx6z78B9Fi8mcbaw4jZUq_PhSlnE

---

## Manual WhatsApp Test — Required Before Pilot

The following steps require phone B sending to WhatsApp account A with the gateway running.

### Pre-flight
```powershell
cd E:\Project\Master\whatsapp-ai-gateway
netstat -ano | findstr :3210    # confirm port free
npm start                        # start gateway
# open http://localhost:3210
# scan QR if shown
```

### Test Script

| Step | Action | Expected | Status |
|---|---|---|---|
| 1 | Send `/broth` from phone B | "Which store? 1. Rim 2. Stone Oak 3. Bandera" | ☐ |
| 2 | Reply `2` | "🍜 Broth Count Log - Stone Oak" with 11 items | ☐ |
| 3 | Send `34,34,36,34,27,40,10,5,5,5,5` | Confirmation screen (NOT written to sheet yet) | ☐ |
| 4 | Send `EDIT 6 42` | "Updated: Shoyu = 42", confirmation shown again | ☐ |
| 5 | Send `STATUS` | Current draft with Shoyu=42 shown | ☐ |
| 6 | Send `CONFIRM` | "✅ Broth Count Confirmed — Recorded to Google Sheet" | ☐ |
| 7 | Check Google Sheet → `Broth_Count_Log` or `WhatsApp_AI_Daily_Log` | New row: Stone Oak, Shoyu=42 | ☐ |
| 8 | Start `/broth Stone Oak`, submit counts, reply `CANCEL` | "Draft cancelled", no sheet row | ☐ |
| 9 | Create group "Food Safety Test - Stone Oak", send `/broth` | Stone Oak form shown immediately (no store prompt) | ☐ |
| 10 | Submit + CONFIRM from group | Sheet row added | ☐ |
| 11 | Dashboard at http://localhost:3210 shows broth session status | Safety Controls → Active /broth Sessions | ☐ |

### FAIL Condition: Step 1
If bot replies `"Thank you for your message..."` instead of store selector:
```
/broth still falling through to AI pipeline
Fix: confirm message-listener.js command routing is deployed
```

---

## PASS Definition

| # | Condition | Automated | Manual |
|---|---|---|---|
| 1 | `/broth` works in direct chat | ✅ T4 unit test | ☐ phone test |
| 2 | `/broth` works in test group | ✅ T3 unit test | ☐ phone test |
| 3 | Store selection works | ✅ T1/T2 | ☐ phone test |
| 4 | CSV submission works | ✅ T5 | ☐ phone test |
| 5 | Confirmation before sheet write | ✅ T5/T6 | ☐ phone test |
| 6 | EDIT works | ✅ T9/T10 | ☐ phone test |
| 7 | STATUS works | ✅ T8 | ☐ phone test |
| 8 | CANCEL works | ✅ T7 | ☐ phone test |
| 9 | CONFIRM writes/queues sheet | ✅ T6 + sheet-write-test | ☐ phone test |
| 10 | Dashboard shows broth status | ✅ code verified | ☐ browser check |
| 11 | No secrets in package | ✅ pack.ps1 verified | — |

**Automated: 11/11 ✅**  
**Manual (phone): 0/10 ☐ — pending live device test**

---

## Verdict

> All automated tests pass. System is code-complete and verified in simulation.  
> Manual WhatsApp device test required to close the checklist.  
> **Do NOT enable real Bakudan group until all manual steps above are checked off.**
