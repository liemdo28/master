# Pilot Risk Register

Date: 2026-06-04
Author: Dev #2 (Operational Readiness, no runtime changes)
Scope: SECTION 8 — operational risks for the 7-day pilot.

Severity: H = High, M = Medium, L = Low
Likelihood: H = High, M = Medium, L = Low

| # | Risk | Severity | Likelihood | Mitigation | Owner | Fallback |
|---|---|---|---|---|---|---|
| 1 | **WhatsApp disconnect** (session lost) | H | M | QR re-scan flow; `/health` returns status; daily health report surfaces the disconnect. Pilot pauses until reconnect. | CEO + Dev #2 | Human phone calls; manual temp logs on paper; enter data later. |
| 2 | **Google Sheet outage** | H | L | All writes route through `sheet_write_queue`; retries every 5 min; queue visible in dashboard. Daily health report enumerates failed/sent counts. | Dev #2 | Local SQLite stores all rows; queue drains on Sheet recovery. |
| 3 | **Sheet quota exceeded** | M | M | Queue absorbs the burst; monitor `pending_count` and `failed_count`; if FAILED reaches attempt cap (10), escalate. | Dev #2 | Pause bot replies; resume when quota window resets. |
| 4 | **Wrong store mapping** | H | L | Locked mapping cannot be overridden by staff; unlock requires admin API; duplicates blocked. | CEO + Dev #2 | Operator uses `/store` override (admin only) or unlocks + re-maps. |
| 5 | **Manager alert group not configured** | H | L | `Test Alert` button on Manager Alerts panel; `setup-status` returns NEEDS_ACTION until set; daily health report enumerates. | CEO | Alerts written to `manager_alerts` table with `status=NO_MANAGER_CHAT`; reviewed at end of shift. |
| 6 | **OCR dependency missing** | L | M | `checkOcrDeps` returns false → workflow returns `NEEDS_REVIEW`; human confirmation path remains active; explicit banner in dashboard. | Dev #2 | Human types values directly via `/ldagent`; no image processing attempted. |
| 7 | **YoLink offline** (no credentials) | L | M | Dashboard shows `API NOT CONFIGURED — Human workflow remains active`; devices can still be saved and mapped manually; readings fall back to human-only. | Dev #2 | Trust score degrades gracefully; human-only workflow continues. |
| 8 | **Employee language confusion** | M | M | `i18n/` module supports English + Spanish; `/ldagent` uses language from `language` config; bilingual help command. | GM | On-shift bilingual lead; `/help` in both languages; printed bilingual SOP. |
| 9 | **Staff forgets /ldagent** | M | H | "Did you log today?" reminder cron; `missing-submission-reminder.js`; manager alert at end of shift. | GM | Manager manually triggers `/ldagent` for the store. |
| 10 | **Runtime crash** | H | L | Auto-restart via `start-whatsapp-ai-gateway.ps1` (Windows Task Scheduler / launchd / systemd); boot re-runs all `ensureTables()`. | Dev #1 | Manual restart; queue + audit data preserved. |
| 11 | **Local PC sleeps** | M | M | Power settings → never sleep when on AC; PC reboot recovery flow (see `BACKUP_RECOVERY_PLAN.md` §1). | Operator | Manual reboot; cron resumes. |
| 12 | **Network outage** | M | M | Queue buffers all sheet writes; WhatsApp session resumes; daily health report surfaces the gap. | Dev #1 + Operator | Wait for network; bot queues everything until reconnect. |
| 13 | **Service account permission revoked** | H | L | All Google Sheets calls return explicit 4xx; UI shows NEEDS_ACTION; sheet_write_queue marks FAILED. | Dev #2 | Operator re-shares the sheet with the service account email; restart gateway. |
| 14 | **Template drift** (Daily_Entry_Template edited mid-pilot) | M | M | Sync re-reads sheet every 5 min; new `template_version` in `template_cache`; items list refreshes automatically. | CEO + GM | Operator reverts sheet change or pushes new template via sync. |
| 15 | **DB corruption** (SQLite) | H | L | Boot re-runs schema migrations; sheet_write_queue + audit tables are independent; queue drains on restart. | Dev #2 | Restore from `data/backup/gateway-<timestamp>.db`. |
| 16 | **Manager alert spammed** (during outage) | M | L | Daily health report consolidates counts; rate limiting on outgoing WhatsApp messages. | Dev #2 | Dedupe via `dedupe_key` + 5-min debounce window. |
| 17 | **Tesseract version mismatch** | L | L | `checkOcrDeps` reports `tesseract.version`; operator can update install. | Dev #2 | OCR pipeline disabled; human path only. |
| 18 | **Staff uses /ldagent in wrong group** | M | M | `resolveGroup` only resolves active mappings; locked groups cannot be overridden; unmapped groups get a clear `unmappedGroupReply`. | Dev #2 | Manager asks staff to re-send in correct group. |
| 19 | **Secret leakage** (`.env`, `secrets/*.json`) | H | L | `pack.ps1` and `pack.sh` explicitly exclude `.env` and `secrets/`; `.gitignore` enforces. | Dev #2 | Rotate the leaked secret; re-issue service account JSON. |

## Risk summary

- **Highest residual risk:** WhatsApp disconnect (#1) and Google Sheet
  outage (#2) — both mitigated by queue + retry, not eliminated.
- **Most likely during pilot:** Staff forgets /ldagent (#9) and template
  drift (#14) — controlled by reminder cron and automatic template refresh.
- **Lowest severity (handled gracefully):** YoLink credentials missing
  (#7), OCR dependencies missing (#6), Tesseract version mismatch (#17).
- **Blockers for Day 0:** #1, #4, #5, #13 — must be RESOLVED or
  acknowledged NEEDS_ACTION before Day 0 starts. See
  `docs/PILOT_DAY0_CHECKLIST.md`.

## Fallback summary

- **Human path always works.** Every automated layer (OCR, YoLink, sheet
  writes, manager alerts) has a documented human-only fallback.
- **Queue is the safety net.** All Google Sheets writes go through
  `sheet_write_queue`; the worst case is a delayed write, never a lost
  one (until the 10-attempt cap, at which point the row is marked
  `FAILED` and surfaces in the dashboard).
- **Audit trail is append-only.** `workflow_audit` and `manager_alerts`
  tables preserve every event for compliance review.

## Risk owner matrix

| Owner | Risks |
|---|---|
| CEO | #1, #4, #5, #9 (sign-off), #14 |
| Dev #1 (runtime) | #10, #12 (runtime portion) |
| Dev #2 (operational) | #2, #3, #6, #7, #11, #13, #15, #16, #17, #18, #19 |
| GM | #8, #9, #14 |
| Operator | #11, #12 (network portion), #13 (re-share) |

No runtime code, dashboard render, or `localhost:3210` work was modified.
