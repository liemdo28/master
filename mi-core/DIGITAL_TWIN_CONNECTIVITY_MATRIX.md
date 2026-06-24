# DIGITAL TWIN CONNECTIVITY MATRIX (D)
**Date:** 2026-06-24  
**Status:** ✅ CONNECTORS AUDITED — Business logic deferred

> Connectors only. No business logic. Per directive.

---

## Connectivity Matrix

### 1. QuickBooks
| Field | Status |
|-------|--------|
| **Connection Status** | ❌ NOT CONNECTED |
| **Authentication** | Not configured (QB Web Connector token missing) |
| **Data Available** | None — `DATA_MISSING` for all QB workflows |
| **Connector Path** | `services/qb-ops-agent` → `http://127.0.0.1:3456/api` |
| **Auth Method** | QB Web Connector XML + API key |
| **Runs On** | laptop1 (Tailscale IP required) |
| **Refresh Schedule** | Every 6h when connected |
| **Risk** | HIGH — Financial data source. Cross-device sync required. |
| **Data Types** | Transactions, P&L, tax summaries, payroll |
| **Action Required** | 1. Start QuickBooks Desktop on laptop1. 2. Configure QB Web Connector. 3. Set `AGENT_OS_API_URL` env var. |

---

### 2. Toast POS
| Field | Status |
|-------|--------|
| **Connection Status** | ❌ NOT CONNECTED |
| **Authentication** | Toast API credentials required (TOAST_CLIENT_ID, TOAST_CLIENT_SECRET) |
| **Data Available** | None — `DATA_MISSING` for Toast workflows |
| **Connector Path** | `server/src/bigdata/connectors/dashboard/` → Toast POS API |
| **Auth Method** | OAuth2 (Toast developer account) |
| **Runs On** | mi-core-primary (cloud API call) |
| **Refresh Schedule** | On-demand + nightly batch |
| **Risk** | MEDIUM — POS data. Read-only API. No financial write risk. |
| **Data Types** | Sales, orders, items sold, voids, labor |
| **Action Required** | 1. Register Toast API credentials. 2. Set `TOAST_CLIENT_ID` + `TOAST_CLIENT_SECRET` in .env. |

---

### 3. DoorDash
| Field | Status |
|-------|--------|
| **Connection Status** | ⚠️ PARTIAL — Agent installed, no live API |
| **Authentication** | DoorDash Merchant Portal credentials (Playwright automation) |
| **Data Available** | Limited — Playwright browser automation, not REST API |
| **Connector Path** | `data/doordash-agent/` → Playwright browser control |
| **Auth Method** | Browser session (email/password stored in agent config) |
| **Runs On** | mi-core-primary (headless Chrome) |
| **Refresh Schedule** | On-demand |
| **Risk** | MEDIUM — Browser automation brittle. Rate-limit risk if overused. |
| **Data Types** | Campaigns, impressions, orders, promo performance |
| **Action Required** | 1. Verify DoorDash credentials in agent config. 2. Test `POST /api/doordash-agent/campaigns`. |

---

### 4. Payroll
| Field | Status |
|-------|--------|
| **Connection Status** | ❌ NOT CONNECTED |
| **Authentication** | None configured |
| **Data Available** | None — `DATA_MISSING` for payroll workflow |
| **Connector Path** | `accounting-engine` → `/api/costs/payroll` (endpoint exists but data missing) |
| **Auth Method** | Depends on payroll provider (ADP / Gusto / manual) |
| **Runs On** | accounting-engine (port 8844) |
| **Refresh Schedule** | Monthly (25th) |
| **Risk** | HIGH — Payroll data. Must require CEO approval before write operations. |
| **Data Types** | Employee count, gross payroll, benefits, net |
| **Action Required** | 1. Identify payroll provider. 2. Build connector in accounting-engine. 3. Set refresh schedule. |

---

### 5. Tax
| Field | Status |
|-------|--------|
| **Connection Status** | ❌ NOT CONNECTED |
| **Authentication** | None configured |
| **Data Available** | None — `DATA_MISSING` for tax workflow |
| **Connector Path** | `accounting-engine` → `/api/risks` (tax risk endpoint exists but no live data) |
| **Auth Method** | QuickBooks tax data (requires QB connector first) |
| **Runs On** | accounting-engine (port 8844) |
| **Refresh Schedule** | 1st and 15th of month |
| **Risk** | HIGH — Tax compliance data. Read-only reporting only. |
| **Data Types** | Quarterly estimates, deadlines, payments made |
| **Action Required** | 1. Connect QuickBooks first (QuickBooks is the tax data source). 2. Enable tax extraction in accounting-engine. |
| **Dependency** | QuickBooks connector must be active |

---

### 6. Dashboard (Bakudan)
| Field | Status |
|-------|--------|
| **Connection Status** | ⚠️ PARTIAL — URL accessible externally, 403 from mi-core |
| **Authentication** | Cloudflare-protected. No internal API key configured. |
| **Data Available** | None (mi-core can't reach dashboard.bakudanramen.com due to Cloudflare) |
| **Connector Path** | `server/src/bigdata/connectors/dashboard/` → `https://dashboard.bakudanramen.com/api` |
| **Auth Method** | Cloudflare Access (requires API token for server-to-server) |
| **Runs On** | mi-core-primary (outbound HTTPS) |
| **Refresh Schedule** | Real-time (push) |
| **Risk** | LOW — Dashboard is a consumer of mi-core data, not a source. Cosmetic only. |
| **Data Types** | KPI snapshots, sales, health scores |
| **Action Required** | 1. Create Cloudflare Service Token. 2. Set `CF_ACCESS_CLIENT_ID` + `CF_ACCESS_CLIENT_SECRET`. 3. Pass as headers in dashboard ingest calls. |

---

## Connectivity Summary

| Connector | Status | Data | Risk | Action Priority |
|-----------|--------|------|------|----------------|
| QuickBooks | ❌ DISCONNECTED | None | HIGH | P0 — Finance blocked |
| Toast POS | ❌ DISCONNECTED | None | MEDIUM | P1 — Restaurant Intel blocked |
| DoorDash | ⚠️ PARTIAL | Browser only | MEDIUM | P2 — Marketing partial |
| Payroll | ❌ DISCONNECTED | None | HIGH | P1 — Blocked on QB |
| Tax | ❌ DISCONNECTED | None | HIGH | P1 — Blocked on QB |
| Dashboard | ⚠️ PARTIAL | 403 | LOW | P3 — Cosmetic |

**Critical path:** QuickBooks → Payroll → Tax. Fix QB first.  
**Quick win:** DoorDash credentials test + Toast API registration.

---

## Status
**DIGITAL_TWIN_CONNECTIVITY_AUDITED** — All 6 connectors assessed. No business logic added. Connector gaps documented with specific action items per directive.
