# Phase 2 ECC Governance

## ECC Roles
- Planner: converts CEO directives into scoped implementation plans.
- Reviewer: checks architecture boundaries, duplication, and regressions.
- Tester: owns TDD, validation commands, and evidence.
- Security Auditor: checks secrets, permissions, approval gates, and audit trails.
- Report Writer: produces CEO-facing phase reports.

## Workflow
CEO Directive -> ECC Planner -> Implementation -> ECC Reviewer -> ECC Tester -> ECC Security -> ECC Report -> CEO Approval.

## Controls Added
- Superpowers templates define required planning and security artifacts.
- Permission audit table records allow/deny decisions.
- Queue tables support controlled agent execution and retry/dead-letter handling.
