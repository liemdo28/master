# RISK_CLASSIFICATION_ENGINE

Generated: 2026-06-13
Owner: Dev2

## Purpose

Risk Classification Engine assigns an operational risk level to every Work Order before Dev3 executes it.

## API

```http
GET /api/risks/classify?input=production%20deploy
```

## Levels

| Level | Meaning | Approval |
|---|---|---|
| P0 | Production, rollback, payment, payroll, database-changing, or critical business state | Required |
| P1 | Bug fix, incident, outage, security, credential, remote action, or blocker | Required |
| P2 | Audit, QA, Dashboard check, Review dependency, integration/dependency check | Not required for read-only work |
| P3 | Documentation, status, or read-only knowledge update | Not required |

## Examples

| Input | Level | Reason |
|---|---|---|
| `production deploy` | P0 | Can affect production |
| `rollback dashboard` | P0 | Can affect production state |
| `fix WhatsApp session issue` | P1 | Operational fix/security-sensitive path |
| `dashboard_audit` | P2 | Read-only operational QA/audit |
| `documentation update` | P3 | Non-runtime documentation work |

## Dev3 Rule

Dev3 must treat `requires_approval=true` as a hard gate. The enrichment workflow may gather evidence before approval, but it must not mutate production, remote machines, payroll, payment, or database state without approval.
