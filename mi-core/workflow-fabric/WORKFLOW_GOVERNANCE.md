# Workflow Governance

Status: PARTIAL
Source: `mi-core/server/src/workflow-fabric/workflow-governance.ts`

## Risk Levels

| risk | approval_required | examples |
|---|---:|---|
| READ_ONLY | false | health checks, read-only dashboard snapshots |
| SAFE_WRITE | true | report files, marketing drafts, registry updates |
| PRODUCTION_WRITE | true | live website/review/GBP changes, customer-facing updates |
| FINANCIAL | true | QuickBooks, payroll, tax, revenue changes |
| SECURITY | true | credentials, WhatsApp identity, remote access |

Rules:
- No workflow may self-promote risk.
- Financial and security workflows require explicit approval evidence.
- Production writes require rollback plan before execution.
- OSS workflows require Phase 0.5 governance before pilot or install.
