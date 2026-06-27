# QuickBooks Evidence Proof

Generated: 2026-06-27T03:30:00Z

Certification result: `PARTIAL`

## Evidence Found

- `GET /api/visibility/quickbooks` live response.
- `.local-agent-global/visibility/quickbooks/summary.json`.
- `services/qb-ops-agent/data/qb-ops-agent.sqlite`.
- `services/qb-ops-agent/data/company-files.json`.
- PM2 process `qb-ops-agent` online.

## Evidence Missing

- Fresh heartbeat.
- Fresh activity rows.
- Fresh sync-result payload.
- Fresh transaction-count proof.
- Fresh screenshot evidence from the interactive desktop.

## Decision

Evidence proves detection and stale sync state, not final live certification.
