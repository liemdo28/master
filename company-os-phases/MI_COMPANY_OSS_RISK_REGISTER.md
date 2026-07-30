# MI_COMPANY_OSS_RISK_REGISTER.md — Master OSS Risk Register

**Generated:** 2026-06-27
**Purpose:** Track all OSS risks across phases 11-20

---

## Risk Register

| Risk ID | OSS | Risk Description | Likelihood | Impact | Severity | Mitigation | Owner | Status |
|---------|-----|----------------|-----------|--------|---------|------------|-------|--------|
| RISK-001 | PostHog | AGPL-3.0 license — may require source disclosure | MEDIUM | MEDIUM | MEDIUM | Monitor; evaluate Plausible alternative | IT | MONITORING |
| RISK-002 | OpenObserve | AGPL-3.0 license in production | MEDIUM | MEDIUM | MEDIUM | Evaluate Grafana migration path | IT | MONITORING |
| RISK-003 | DuckDB | Single point of failure for financial data | MEDIUM | HIGH | HIGH | Dual ingestion; regular backups | Finance | ACTIVE |
| RISK-004 | OpenFGA | Single point of authorization | MEDIUM | HIGH | HIGH | Read-only fallback; audit logging | IT | ACTIVE |
| RISK-005 | OPA | Policy engine failure blocks all requests | LOW | HIGH | MEDIUM | Disable policies fallback | IT | ACTIVE |
| RISK-006 | n8n | Workflow failure cascades to all automations | LOW | HIGH | MEDIUM | Manual fallback; workflow logging | Operations | ACTIVE |
| RISK-007 | Airbyte | Pipeline failure causes data gaps | LOW | MEDIUM | LOW | Manual sync fallback | IT | ACTIVE |
| RISK-008 | Browser Use | PILOT stage — immature for production | MEDIUM | MEDIUM | MEDIUM | Keep Playwright as primary | IT | PILOT |
| RISK-009 | Qwen Coder | AUDIT stage — not evaluated for production | HIGH | MEDIUM | MEDIUM | Complete audit before promotion | Engineering | AUDIT |
| RISK-010 | Skyvern | AGPL-3.0 HIGH license risk | HIGH | HIGH | HIGH | REJECTED — do not deploy | IT | REJECTED |
| RISK-011 | Postgres pgvector | Memory store dependency | MEDIUM | HIGH | HIGH | Text search fallback | Engineering | ACTIVE |
| RISK-012 | Langfuse | LLM tracing failure | LOW | LOW | LOW | Continue without tracing | Engineering | ACTIVE |

---

## Risk Summary

| Severity | Count | Action Required |
|----------|-------|---------------|
| HIGH | 4 | Immediate mitigation |
| MEDIUM | 6 | Monitor and review |
| LOW | 2 | Accept risk |

---

## Status: ✅ MASTER_OSS_RISK_REGISTER_COMPLETE
