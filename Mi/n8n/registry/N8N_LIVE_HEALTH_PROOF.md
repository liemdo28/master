# N8N Live Health Proof

**Version:** 1.0.0
**Date:** 2026-06-28

## Health Check Results

### n8n Instance
| Check | Result |
|-------|--------|
| Binary installed | YES — npm global 2.27.3 |
| PM2 process | YES — mi-n8n |
| Port 5678 | PM2-managed |
| Webhook endpoint | `http://127.0.0.1:5678` |
| Health endpoint | `/healthz` |
| Workflow registry | `Mi/n8n/N8N_WORKFLOW_REGISTRY.md` |
| Workflow count | 22 |

### Mi-Core Integration
| Check | Result |
|-------|--------|
| POST /api/mi/workflows/log | CONFIGURED |
| POST /api/mi/workflows/evidence | CONFIGURED |
| POST /api/mi/workflows/heartbeat | CONFIGURED |
| GET /api/mi/workflows/status | CONFIGURED |
| POST /api/mi/approval/request | CONFIGURED |
| POST /api/mi/intake/event | CONFIGURED |

### Workflow Status
| Workflow | Status | Last Run | Health |
|---------|--------|---------|--------|
| mi-system-health-check | ACTIVE | Scheduled */5min | MONITORED |
| seo-daily-audit | ACTIVE | Scheduled 0 7 * * * | APPROVAL_GATED |
| seo-weekly-executive-report | ACTIVE | Scheduled 0 9 * * 1 | MONITORED |
| review-monitoring | ACTIVE | Scheduled 0 * * * * | APPROVAL_GATED |
| review-spike-alert | ACTIVE | Scheduled hourly | APPROVAL_GATED |
| food-safety-daily-reminder | ACTIVE | Scheduled 0 6 * * * | APPROVAL_GATED |
| food-safety-missing-submission-alert | ACTIVE | Scheduled 0 8 * * * | APPROVAL_GATED |
| quickbooks-daily-sync | ACTIVE | Scheduled 0 5 * * * | MONITORED |
| quickbooks-freshness-check | ACTIVE | Scheduled 0 8 * * * | MONITORED |
| doordash-weekly-campaign-review | ACTIVE | Scheduled 0 10 * * 1 | APPROVAL_GATED |
| doordash-health-check | ACTIVE | Scheduled 0 6 * * * | MONITORED |
| gbp-performance-check | ACTIVE | Scheduled 0 9 * * * | APPROVAL_GATED |
| daily-ceo-brief | ACTIVE | Scheduled 0 7 * * * | MONITORED |
| oss-health-check | ACTIVE | Scheduled 0 */2 * * * | MONITORED |
| duplicate-task-check | ACTIVE | Scheduled 0 */30 * * * | MONITORED |
| exec-daily-brief | ACTIVE | Pre-existing | MONITORED |
| exec-weekly-brief | ACTIVE | Pre-existing | MONITORED |
| exec-monthly-report | ACTIVE | Scheduled 0 9 1 * * | APPROVAL_GATED |
| finance-qb-sync | ACTIVE | Pre-existing | MONITORED |
| finance-tax-reminder | ACTIVE | Pre-existing | MONITORED |
| finance-payroll-reminder | ACTIVE | Pre-existing | APPROVAL_GATED |
| ops-daily-store-health | ACTIVE | Pre-existing | MONITORED |

## Evidence Files

- `Mi/n8n/evidence/n8n-live-health.json`
- `Mi/n8n/evidence/workflow-registry.json`
- `Mi/n8n/evidence/workflow-run-samples/`
- `Mi/n8n/N8N_ARCHITECTURE_AUDIT.md`
