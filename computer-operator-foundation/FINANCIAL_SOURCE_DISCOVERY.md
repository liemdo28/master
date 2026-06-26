# FINANCIAL_SOURCE_DISCOVERY

Status: **DISCOVERY_COMPLETE**
Date: 2026-06-26
Scope: Phase 3A Financial Warehouse Foundation — enumerate every financial source, its location, owner, health, freshness, availability, and classification.

## Classification Legend

| Class | Meaning |
|---|---|
| LIVE | Source reachable, fresh data within expected SLA |
| STALE | Source reachable, but last data is older than SLA |
| PARTIAL | Source reachable, but coverage is incomplete |
| MISSING | Source declared as required, but no path discovered yet |
| BLOCKED | Source identified but cannot be connected due to access/credential/operator gap |

## Health Legend

| Health | Meaning |
|---|---|
| HEALTHY | Operating within tolerance |
| DEGRADED | Operational but warning signs |
| DOWN | Endpoint not responding |
| UNKNOWN | Cannot be evaluated yet |

---

## 1. QuickBooks Desktop

| Field | Value |
|---|---|
| source | QuickBooks Desktop company file |
| location | Native Windows install (operator host) |
| owner | Finance Lead |
| connector candidate | QB Web Connector + Windows helper runtime |
| status | **STALE / PARTIAL** |
| health | **DEGRADED** |
| freshness | Last known sync window >24h; no automated sync proven in repo |
| availability | Referenced architecturally only — no live data path yet |
| classification | STALE |
| blockers | (a) no QB Web Connector code in repo, (b) sandbox company file not present, (c) approval tier FINANCIAL_ACTION not yet wired |
| notes | Phase 3A scope is READ ONLY; no QB writes ever |

## 2. Accounting Engine (port 8844)

| Field | Value |
|---|---|
| source | Local accounting/runtime service on 127.0.0.1:8844 |
| location | Loopback on operator host |
| owner | Data Engineering Lead |
| connector candidate | Local HTTP /health probe; richer endpoints not documented in repo |
| status | **LIVE — heartbeat only** |
| health | **HEALTHY** |
| freshness | Last probe: 2026-06-26T04:17:23Z, returned `{"ok":true}` HTTP 200 |
| availability | Loopback service confirmed by safe probe; full schema unknown |
| classification | LIVE (heartbeat) / PARTIAL (data) |
| blockers | Endpoint surface beyond `/health` not enumerated; no documented finance contract |
| notes | Treat as runtime availability signal only; do not assume business data is exposed |

## 3. Toast POS

| Field | Value |
|---|---|
| source | Toast daily sales / orders export |
| location | Toast merchant portal + Toast API |
| owner | Operations Lead |
| connector candidate | Playwright portal automation; Toast API if token available |
| status | **MISSING** |
| health | **UNKNOWN** |
| freshness | No registered snapshot |
| availability | Portal reachable architecturally; no automation proven |
| classification | MISSING |
| blockers | (a) no portal automation in repo, (b) no Toast API token issued, (c) read-only access not yet approved |
| notes | Highest priority for revenue pipeline; Phase 3A target for first end-to-end snapshot |

## 4. DoorDash Merchant

| Field | Value |
|---|---|
| source | DoorDash merchant portal (campaigns, orders) |
| location | DoorDash merchant portal |
| owner | Operations Lead |
| connector candidate | Playwright + Browser Use adaptive layer |
| status | **MISSING** |
| health | **UNKNOWN** |
| freshness | No registered snapshot |
| availability | Portal reachable architecturally; no automation proven |
| classification | MISSING |
| blockers | (a) no portal automation in repo, (b) Cloudflare/WAF detection risk, (c) MFA handoff flow not built |
| notes | Treat as Phase 3B connector after Toast path stabilizes |

## 5. Payroll

| Field | Value |
|---|---|
| source | Payroll provider (provider TBD) |
| location | Payroll provider portal + CSV export |
| owner | HR Lead / Finance Lead |
| connector candidate | Provider-specific portal automation OR SFTP/email CSV |
| status | **MISSING** |
| health | **UNKNOWN** |
| freshness | No registered snapshot |
| availability | Provider not yet identified |
| classification | MISSING |
| blockers | (a) provider identification, (b) credential vaulting plan, (c) FIN/FINANCIAL_ACTION approval not yet wired |
| notes | Phase 3A scope is READ ONLY — no payroll mutations permitted |

## 6. GA4 (Google Analytics 4)

| Field | Value |
|---|---|
| source | GA4 property for the brand sites |
| location | GA4 Data API / BigQuery export |
| owner | Marketing Lead |
| connector candidate | GA4 Data API; BigQuery scheduled export |
| status | **LIVE (reachability assumed) / MISSING (financial link)** |
| health | **UNKNOWN** in this repo |
| freshness | Not registered in warehouse |
| availability | Reachability not probed in this phase |
| classification | MISSING (for financial linkage) |
| blockers | (a) GA4 service account credentials, (b) revenue linkage schema (order ID / transaction ID) not defined |
| notes | Required for marketing → revenue attribution later |

## 7. Google Search Console (GSC)

| Field | Value |
|---|---|
| source | Google Search Console for brand sites |
| location | GSC API |
| owner | Marketing Lead |
| connector candidate | GSC API |
| status | **LIVE (reachability assumed) / MISSING (financial link)** |
| health | **UNKNOWN** |
| freshness | Not registered |
| classification | MISSING (for financial linkage) |
| blockers | (a) GSC service account credentials, (b) keyword → page → conversion chain not mapped |
| notes | Lower priority than GA4 for revenue linkage |

## 8. GBP Reviews (Google Business Profile)

| Field | Value |
|---|---|
| source | Google Business Profile review stream |
| location | GBP API (preferred) or portal |
| owner | Marketing Lead |
| connector candidate | GBP API primary; Playwright fallback for review reads |
| status | **MISSING** |
| health | **UNKNOWN** |
| freshness | Not registered |
| classification | MISSING |
| blockers | (a) GBP API approval, (b) Google MFA handoff policy |
| notes | Indirect financial impact (store traffic signals) |

## 9. Internal Mi Dashboard

| Field | Value |
|---|---|
| source | Mi internal Mi dashboard (Phase 0 Executive Coordination) |
| location | Local services / future hosted |
| owner | Executive Lead |
| connector candidate | Direct API to registries |
| status | **LIVE (design only)** |
| health | **HEALTHY** in design |
| freshness | n/a — not a financial data source itself |
| classification | LIVE |
| blockers | Implementation pending |
| notes | This is the consumer of warehouse data, not a producer |

---

## Discovery Summary

| Source | Classification | Health | Owner |
|---|---|---|---|
| QuickBooks Desktop | STALE | DEGRADED | Finance Lead |
| Accounting Engine (8844) | LIVE (heartbeat) | HEALTHY | Data Engineering Lead |
| Toast POS | MISSING | UNKNOWN | Operations Lead |
| DoorDash Merchant | MISSING | UNKNOWN | Operations Lead |
| Payroll | MISSING | UNKNOWN | HR / Finance Lead |
| GA4 | MISSING | UNKNOWN | Marketing Lead |
| GSC | MISSING | UNKNOWN | Marketing Lead |
| GBP Reviews | MISSING | UNKNOWN | Marketing Lead |
| Mi Dashboard | LIVE (design) | HEALTHY | Executive Lead |

## Coverage Gap

Sources with NO live financial data path: 6 of 9 (QuickBooks, Toast, DoorDash, Payroll, GA4, GSC, GBP).

Only **2 signals** can be considered live today:
- Accounting Engine heartbeat on `127.0.0.1:8844`
- Mi internal dashboard registry design

This confirms the Phase 3 conclusion: **the financial data backbone is missing**. Phase 3A begins to construct that backbone.
