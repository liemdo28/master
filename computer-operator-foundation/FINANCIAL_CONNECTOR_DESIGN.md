# FINANCIAL_CONNECTOR_DESIGN

Status: **CONNECTOR_DESIGN_COMPLETE**
Date: 2026-06-26
Scope: Phase 3A read-only connector specifications for QuickBooks, Payroll, DoorDash, and Toast.

## Hard Rules

```text
READ ONLY
NO WRITES
NO ACCOUNTING CHANGES
NO PAYROLL CHANGES
```

Every connector must:
1. Only read data.
2. Produce an evidence log entry per run.
3. Fail-safe: on any error, do not retry writes; stop and log.
4. Be gated by approval level READ_ONLY.
5. Never store credentials in plaintext files or logs.

---

## Connector 1: QuickBooks Desktop

| Field | Value |
|---|---|
| source | QuickBooks Desktop company file |
| authentication | Windows user session with QB file open; no API token needed for desktop read |
| data available | Chart of accounts, sales receipts, invoices, bills, expenses, vendor bills, COGS accounts, P&L report, balance sheet |
| refresh strategy | QB Web Connector sync (QBWC) → local staging CSV → warehouse POST `/snapshots/register` |
| cadence | Daily (end of business day) |
| risk | HIGH — native desktop financial system; FINANCIAL_ACTION tier if any write attempted |
| blockers | (a) QBWC code not yet implemented, (b) sandbox company file not present, (c) Windows helper runtime not built |
| mitigation | Sandbox-first: only read from a copy of the company file; never modify production QB file; dual approval for any future FINANCIAL_ACTION |

### Read-Only Data Path

```text
QuickBooks Desktop (company file)
  → QB Web Connector (QBWC) — read-only export triggered by API callback
    → staging CSV files (local disk)
      → warehouse connector (Python) reads CSV
        → POST /snapshots/register (metadata only, no QB data written back)
```

---

## Connector 2: Payroll

| Field | Value |
|---|---|
| source | Payroll provider portal / SFTP / CSV export |
| authentication | Provider portal login (Playwright) OR SFTP key (if provider offers SFTP) |
| data available | Pay period totals, gross pay, employer taxes, benefits, overtime hours, headcount, store-level allocation |
| refresh strategy | Biweekly CSV download → warehouse POST `/snapshots/register` |
| cadence | Biweekly (per pay cycle) |
| risk | HIGH — payroll data is sensitive; FINANCIAL_ACTION tier if any mutation attempted |
| blockers | (a) payroll provider not identified, (b) credential vaulting plan not in place, (c) portal automation not built |
| mitigation | READ ONLY at all times; no payroll write ever; credentials injected at runtime only |

### Read-Only Data Path

```text
Payroll Provider Portal
  → Playwright download of CSV/PDF report (read-only)
    → warehouse connector reads file
      → POST /snapshots/register (metadata only)
```

---

## Connector 3: DoorDash

| Field | Value |
|---|---|
| source | DoorDash Merchant Portal |
| authentication | Portal login via approved session; Cloudflare/WAF may require human handoff |
| data available | Daily sales summary, orders list, campaign data, commission breakdown, delivery fees |
| refresh strategy | Portal automation (Playwright + Browser Use) → download daily report CSV → warehouse POST |
| cadence | Daily |
| risk | MEDIUM-HIGH — WAF detection; portal layout changes can break selectors; MFA may trigger |
| blockers | (a) no automation code in repo, (b) Cloudflare/turnstile handling not implemented, (c) MFA handoff flow not built |
| mitigation | Sandbox-first runs; approval gate before any portal action; evidence screenshots of portal state |

### Read-Only Data Path

```text
DoorDash Merchant Portal (browser)
  → Playwright session with approved credentials
    → navigate to reports/orders
      → download CSV export
        → warehouse connector reads file
          → POST /snapshots/register
```

---

## Connector 4: Toast

| Field | Value |
|---|---|
| source | Toast Merchant Portal / Toast API |
| authentication | Portal login (Playwright) OR Toast API OAuth token |
| data available | Daily sales, orders, menu items, labor summary (if Toast payroll), tips, tax, discounts, voids |
| refresh strategy | Playwright portal download OR Toast API GET requests → CSV/JSON → warehouse POST |
| cadence | Hourly during business hours (ideal); daily minimum |
| risk | MEDIUM — portal layout may change; API token may expire; less WAF friction than DoorDash |
| blockers | (a) no automation code in repo, (b) Toast API token not issued, (c) read-only access not yet approved |
| mitigation | Toast API preferred over portal scraping; portal fallback only; evidence log per run |

### Read-Only Data Path

```text
Toast API (preferred)
  → OAuth token → GET /v1/menus, GET /v1/orders, GET /v1/reports
    → JSON response → warehouse connector parses
      → POST /snapshots/register

Toast Portal (fallback)
  → Playwright session
    → navigate to Reports → Daily Sales
      → download CSV
        → warehouse connector reads file
          → POST /snapshots/register
```

---

## Connector Health Matrix

| Connector | Auth Method | Data Available | Risk | Blockers | Phase |
|---|---|---|---|---|---|
| QuickBooks | Windows session / QBWC | P&L, sales receipts, bills, COGS | HIGH | QBWC code, sandbox | 3B |
| Payroll | Portal / SFTP | Pay cycles, labor cost, overtime | HIGH | Provider TBD, credentials | 3B |
| DoorDash | Portal login | Sales, orders, campaigns | MED-HIGH | WAF, MFA, no automation | 3B |
| Toast | Portal / API | Sales, orders, menu, tips | MEDIUM | API token, no automation | 3B → 3C |

## Evidence Contract

Every connector run must emit:

```json
{
  "connector_id": "toast",
  "run_id": "run-2026-06-26-001",
  "started_at": "ISO8601",
  "completed_at": "ISO8601",
  "outcome": "SUCCESS | FAILURE | BLOCKED",
  "snapshot_id": "toast-2026-06-26-daily",
  "record_count": 412,
  "errors": [],
  "evidence_path": "runtime-evidence/connector-toast-001.json"
}
```

## Phase 3A vs 3B

Phase 3A: Design only (this document). No connectors are built.
Phase 3B: Build connectors starting with Toast (highest ROI), then DoorDash, then Payroll, then QuickBooks.
