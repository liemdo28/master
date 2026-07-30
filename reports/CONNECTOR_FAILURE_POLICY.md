# Connector Failure Policy
**Date:** 2026-06-15
**Phase:** DEV3 CEO_READY_V3 Closeout — D3

**Rule: No connector may silently fail. Missing data must be visible.**

---

## Failure Response Matrix

| Connector State | CEO Query Type | Required Response |
|----------------|----------------|-------------------|
| not_configured | Finance | "❌ Không có dữ liệu — connector chưa setup" |
| not_configured | Status | "connector not_configured — setup hint" |
| offline | Finance | Finance Truth Layer skips to next source |
| offline | Status | "connector offline — last seen: [timestamp]" |
| error | Any | "connector error — logged to ops.db" |
| stale (>24h) | Finance | Warning label on response |
| healthy | Finance | Source-stamped response with freshness |

---

## Failure Handling per Connector

### Google (Gmail / Calendar / Drive / Sheets)
- **Failure mode:** `auth_status: not_configured`
- **Response:** "Google connector chưa được cấu hình. Cần GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET"
- **Setup hint:** Shown in connector registry `setup_hint` field
- **Silent fail:** ❌ NOT ALLOWED — always shown explicitly

### QuickBooks Runtime
- **Failure mode:** DB absent or empty
- **Response:** Finance Truth Layer → "❌ Không có dữ liệu QB" with setup steps
- **Silent fail:** ❌ NOT ALLOWED

### Accounting Engine (port 8844)
- **Failure mode:** HTTP timeout or connection refused
- **Response:** Finance Truth Layer skips to cache, then explicit unavailable
- **Silent fail:** ❌ NOT ALLOWED — Finance Truth Layer always logs skip reason in response

### Dashboard (local files)
- **Failure mode:** Local path not accessible
- **Response:** Audit pipeline returns file read error
- **Silent fail:** ❌ NOT ALLOWED — error surfaces as `work_order verdict: FAILED`

### Send Message
- **Failure mode:** Recipient unknown / connector not configured
- **Response:** Requires approval before any send — approval gate blocks
- **Silent fail:** ❌ NOT ALLOWED — approval required before execution

---

## No Silent Drop Guarantee

The intent router guarantees zero silent drops:

1. **Known intent** → routed to correct pipeline → explicit result (DELIVERED / FAILED / APPROVAL_REQUIRED)
2. **Finance query** → Finance Truth Layer → explicit data or explicit unavailable
3. **Unknown intent** → `buildUnknownIntentReply()` → honest clarification with hints
4. **Compound request** → each sub-intent produces explicit result → parent summary

Every CEO message receives a response. Nothing is dropped silently.

---

## Incident Logging

When a connector fails during execution, the ops layer records:
- Incident in `ops.db` (O1 incident tracker)
- Error evidence in work order evidence package
- Burn-in quality score reflects connector health

Connector failures visible via:
- `GET /api/operations/health` (requires auth)
- `GET /api/visibility` (requires auth)
- `/liveboard.html` (ops dashboard)
