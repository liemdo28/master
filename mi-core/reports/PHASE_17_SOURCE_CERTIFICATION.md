# Phase 17 — Franchise / Multi-Company OS — Source Certification

| Field | Value |
|---|---|
| **Source path** | `agent-engine/phase-17-franchise-os/src/` (`engines.js`, `orchestrator.js`) |
| **Runtime entrypoint** | `src/orchestrator.js` → `class FranchiseOS` |
| **API route** | `GET /api/agent-os/17` (live summary → `crossCompanyReport()`) |
| **OSS used** | Postgres RLS (tenant isolation) — **SELECTED, NOT_INTEGRATED** (OpenFGA kept for relationship authz) |
| **Division mapping** | Executive (primary) · IT · Finance |
| **Input schema** | `onboardFranchisee({ company, templateId, ops[] })`; `recordMetrics(companyId, metrics)`; `readMetrics({ tenantId, companyId })`; `crossCompanyReport()` |
| **Output schema** | `{ company, applied }` · guarded read `{ ok, metrics? , reason? }` · HQ report `{ tenantCount, totals, perCompany[], isolationViolations }` |
| **Evidence produced** | companies / template / company-metrics / isolation-log stores |
| **Runtime test file** | `test/runtime-proof.mjs` |
| **Test result** | **23/23 PASS** |
| **Status** | **READY** (engine + runtime) · OSS **PARTIAL** |

## Capabilities proven
- company registry ✅ · franchise templates (ops + playbooks copied into applied config) ✅
- tenant isolation (own read OK; **cross-tenant read denied with reason**; violation recorded for audit) ✅
- company permissions (company-scoped; denied in other company) ✅
- shared ops entitlements (per-company service grants) ✅
- cross-company HQ report (totals revenue across tenants, counts isolation violations) ✅
- persistence across restart ✅

## Honest notes
- Tenant isolation is enforced by an in-engine guard predicate; Postgres RLS is the governed-but-unwired production substrate that would move isolation into the data layer.
