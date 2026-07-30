# Pilot Day 0 Checklist

Date: 2026-06-04
Author: Dev #2 (Operational Readiness, no runtime changes)
Scope: SECTION 7 — go-live checklist for Day 0 of the 7-day pilot.

## Pre-Day 0 — gate criteria (must be ✅ before Day 0 starts)

| # | Check | Source / Verification | Status |
|---|---|---|---|
| 1 | P0 Packaging Security PASS | `docs/PACKAGING_SECURITY_AUDIT.md` | pending Dev #1 sign-off |
| 2 | P1 Admin Control Center PASS | dashboard `/api/admin/setup-status` → `allPass: true` | pending Dev #1 runtime stable |
| 3 | WhatsApp connected | dashboard WhatsApp badge = READY; `GET /health` → `whatsapp: ready` | pending Dev #1 |
| 4 | LD Agent-Log discovered | `/ldagent` listed in `src/commands/`, command router wired | PASS (code-verified) |
| 5 | Test store mapped | Admin Control Center → Store Mappings shows `test` → Test group `chat_id`, `active=1` | pending operator |
| 6 | Manager alert group set | `/api/admin/setup-status` → `manager_alert_group: PASS`; Test Alert button delivers a real message | pending operator + Dev #1 |
| 7 | Template synced | `/api/admin/setup-status` → `template_sync: PASS`; `templateCache.getItemNames().length > 0` | PASS (cache has 5 items, version 550cc6333379) |
| 8 | Daily log writable | `node tests/live/sheet-write-test.js` → `status: SENT` | **PASS** (live test today) |
| 9 | Queue healthy | `/api/sheet-queue/stats` → `failed_count = 0`, `pending_count` low | pending Dev #1 |
| 10 | Audit trail active | `/api/audit/today` returns rows; `auditTrail.ensureTables()` runs on boot | PASS (code-verified) |
| 11 | OCR status known | `node scripts/check-ocr-deps.js` returns `ok: true` | **PASS** (Tesseract 5.4.0 + cv2 4.13.0 + sharp) |
| 12 | YoLink status known | YoLink panel shows `API NOT CONFIGURED — Human workflow remains active` (acceptable) OR `API READY` (if creds added) | **PASS (NOT CONFIGURED)** — see `docs/YOLINK_OPERATIONAL_AUDIT.md` |
| 13 | Backup strategy known | `data/backup/` exists; operator runs `cp data/gateway.db data/backup/gateway-day0.db` before start | **PASS** (see `docs/BACKUP_RECOVERY_PLAN.md`) |

### Verdict on pre-Day 0 gate

| Layer | Status |
|---|---|
| Code / system (Dev #2 audit) | **5/13 PASS, 8/13 pending Dev #1 or operator** |
| Live runtime checks Dev #2 can run today | **4/13 PASS** (template, daily log, OCR, YoLink-status) |
| Operator-side | Test group mapping + manager alert group chat_id (2 items) |
| Dev #1 runtime-side | WhatsApp, queue health, Admin Control Center, P0 packaging (4 items) |

Pilot is **not yet unblocked**. It will be unblocked the moment:
- Dev #1's runtime is stable, AND
- the operator pastes the Test group `chat_id` and manager alert group `chat_id`.

The Dev #2 contribution (operational readiness) is **complete**; the
remaining gate is operator + Dev #1.

## Day 0 — live test plan (operator + GM)

Run these in order, in the Test group.

| # | Step | Expected | How to verify |
|---|---|---|---|
| 1 | `/ldagent` starts in Test group | bot replies with greeting + first item prompt | WhatsApp group Test |
| 2 | Store resolves to Test | "Store: Test" in the first message | WhatsApp group Test |
| 3 | Daily Entry starts | bot walks through the 5 items from template | WhatsApp group Test |
| 4 | PASS value logs | bot confirms "PASS" for in-range value, advances | WhatsApp group Test |
| 5 | FAIL value warns | bot surfaces "OUT OF RANGE" + target range | WhatsApp group Test |
| 6 | `EDIT 1 41` works | bot updates item 1, re-validates, returns updated summary | WhatsApp group Test |
| 7 | `CONFIRM` writes/queues | sheet receives row OR queue absorbs it | `node tests/live/sheet-write-test.js` + dashboard sheet-queue panel |
| 8 | Manager alert sends | if FAIL was confirmed, alert message arrives in manager group | WhatsApp manager group |
| 9 | History/audit records submitter | `/api/audit/today` shows the submission with `sender` field | `curl localhost:3210/api/audit/today` |
| 10 | Dashboard reflects events | Admin Control Center + sheet-queue panel show today's events | `http://localhost:3210/` |

### Day 0 acceptance

- All 10 steps above complete without error.
- Sheet-queue `failed_count = 0` at end of test.
- `/api/admin/setup-status` → `allPass: true` (or only optional
  `yolink_creds` and `store_mappings_locked` for non-Test stores remain
  `NEEDS_ACTION`).
- Backup `data/backup/gateway-day0.db` archived by the operator.

If any step fails, the pilot is **BLOCKED**. File the failure in
`docs/PILOT_RISK_REGISTER.md` and fix only that step. Do not add new
features.

## Day 0 quick commands (operator-facing)

```bash
# 1. Health
curl -s http://localhost:3210/health

# 2. Setup status
curl -s http://localhost:3210/api/admin/setup-status | jq

# 3. Sheet write queue stats
curl -s http://localhost:3210/api/sheet-queue/stats

# 4. OCR deps
node scripts/check-ocr-deps.js

# 5. Template PDF (regenerate if operator changed Daily_Entry_Template)
node scripts/generate-daily-entry-template.js

# 6. YoLink credentials
curl -s http://localhost:3210/api/admin/yolink/credentials-status

# 7. Today's audit
curl -s http://localhost:3210/api/audit/today | jq

# 8. Live sheet write smoke (Dev #2 verified today: status SENT)
node tests/live/sheet-write-test.js
```

## Day 0 quick dashboard checks (CEO/GM)

- Open `http://localhost:3210/`
- **Admin Control Center** — all rows PASS or expected NEEDS_ACTION acknowledged
- **Store Mapping** — Test store locked; Stone Oak / Bandera / Rim either
  locked or explicitly deferred
- **Manager Alerts** — group set, Test Alert message arrives in WhatsApp
- **Google Sheets** — Open Daily Entry Template + Open Daily Log work
- **YoLink** — credential status visible
- **OCR Runtime** — green badges for whatever is installed

## Acceptance gate (per SECTION H)

If any pre-Day 0 row is FAIL or BLOCKED on Day 0 morning, pilot is
**BLOCKED** until fixed. The `docs/OPERATIONAL_READINESS_REPORT.md`
records the final PASS / FAIL / BLOCKED verdict.

No runtime code, dashboard render, or `localhost:3210` work was modified.
