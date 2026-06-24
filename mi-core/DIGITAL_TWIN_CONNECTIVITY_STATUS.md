# DIGITAL TWIN CONNECTIVITY STATUS — Phase 23F
**Date:** 2026-06-24  
**Captured:** Runtime probed, not seeded.

---

## Connector Matrix

| Source | Credential Status | API Status | Live Read | Last Sync | Blocker | Status |
|--------|------------------|------------|-----------|-----------|---------|--------|
| Dashboard (Dreamhost) | ✅ Set | ✅ HTTP 200 | ✅ tasks/approvals/projects | 2026-06-24T06:15 | None | **LIVE_READ_PASS** |
| Toast POS | ✅ Set (email+pass) | ✅ Playwright ready | ⚠️ Sync on-demand only | On-demand | Playwright browser needed for full scrape | **CREDENTIAL_MISSING (full scrape)** |
| QuickBooks (laptop1) | ✅ Set (API key) | ✅ Agent online | ✅ Health confirmed | 2026-06-24T05:56 | QBWC not yet triggered first sync | **LIVE_READ_PASS** |
| DoorDash | ❌ No API key | ❌ | ❌ | Never | DoorDash API requires merchant app approval | **API_BLOCKED** |
| Payroll | ❌ No source | ❌ | ❌ | Never | No payroll system connected (ADP/Gusto/etc.) | **NOT_IMPLEMENTED** |
| Tax | ❌ No source | ❌ | ❌ | Never | Tax data via QuickBooks (pending first QBWC sync) | **NOT_IMPLEMENTED** |

---

## Evidence

```
GET /api/bigdata/connectors/dashboard/status  → {"connected":true,"status":200}
GET /api/bigdata/connectors/toast/status      → {"connected":true,"credentials_set":true}
GET /api/bigdata/connectors/quickbooks/status → {"connected":true,"agent":{"status":"ok"}}
```

---

## Summary

| Status | Count | Sources |
|--------|-------|---------|
| LIVE_READ_PASS | 2 | Dashboard, QuickBooks |
| CREDENTIAL_MISSING | 1 | Toast (partial — credentials set, scrape not auto-run) |
| API_BLOCKED | 1 | DoorDash |
| NOT_IMPLEMENTED | 2 | Payroll, Tax |

---

## Next Actions

1. **Toast** — run `POST /api/bigdata/connectors/toast/sync` once per day via n8n cron
2. **DoorDash** — apply for DoorDash Merchant API access at developer.doordash.com
3. **Payroll** — connect ADP/Gusto via their API when account is available
4. **Tax** — will auto-resolve when QuickBooks QBWC syncs P&L + tax data
