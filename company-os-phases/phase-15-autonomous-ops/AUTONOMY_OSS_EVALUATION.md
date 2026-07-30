# AUTONOMY_OSS_EVALUATION.md — Autonomy OSS Evaluation

**Generated:** 2026-06-27
**Purpose:** Evaluate OSS tools for autonomous operations

---

## Evaluated OSS

| Tool | Category | License | Decision |
|------|----------|---------|----------|
| n8n | Workflow | Apache-2.0 | PRODUCTION |
| Temporal | Workflow | MIT | DISCOVERY |
| Windmill | Internal Tools | AGPL-3.0 | DISCOVERY |
| OpenFGA | AuthZ | Apache-2.0 | PRODUCTION |
| OPA | Policy | Apache-2.0 | PRODUCTION |
| Cerbos | AuthZ | Apache-2.0 | DISCOVERY |
| Keycloak | Auth | Apache-2.0 | PRODUCTION |
| Infisical | Secrets | MIT | DISCOVERY |
| Vault | Secrets | MPL-2.0 | DISCOVERY |
| Uptime Kuma | Monitoring | MIT | PRODUCTION |
| OpenObserve | Observability | AGPL-3.0 | PRODUCTION |

---

## Recommended Stack

| Component | OSS | Status |
|-----------|-----|--------|
| Workflow | n8n | PRODUCTION |
| Authorization | OpenFGA | PRODUCTION |
| Policy | OPA | PRODUCTION |
| Auth | Keycloak | PRODUCTION |
| Monitoring | Uptime Kuma | PRODUCTION |
| Observability | OpenObserve | PRODUCTION |

---

## Status: ✅ AUTONOMY_OSS_EVALUATION_COMPLETE
