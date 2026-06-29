# LIVE NOW MI WORKFLOW PROOF

**Version:** 1.0.0
**Date:** 2026-06-28

## CEO Question

> "What needs my attention today, and how can we increase Raw Sushi online revenue 10%?"

## Live Now Scenario Output

### Daily Executive Brief
- Workflow: daily-ceo-brief, Scheduled 0 7 * * *, Owner: Executive

### Connector Freshness Status
| Connector | Status | Workflow |
|-----------|--------|---------|
| DoorDash | MONITORED | doordash-health-check |
| QuickBooks | MONITORED | quickbooks-freshness-check |
| SEO | ACTIVE | seo-daily-audit (approval required) |

### Top Blockers (3)
1. DoorDash campaign visibility - Operations
2. GBP performance decline - Marketing
3. Food safety submission compliance - Operations

### Top Approvals (3)
1. seo-daily-audit - SAFE_WRITE risk
2. doordash-weekly-campaign-review - FINANCIAL risk
3. finance-payroll-reminder - FINANCIAL risk

### Top Opportunities (3)
1. Increase DoorDash campaign visibility - HIGH impact - Operations
2. Improve GBP score - MEDIUM impact - Marketing
3. Optimize SEO for online ordering keywords - HIGH impact - Marketing

### Task Assignment by Department
| Department | Task | Workflow |
|-----------|------|---------|
| Executive | Own revenue objective, approve all | daily-ceo-brief |
| Finance | Baseline revenue analysis | quickbooks-daily-sync |
| Marketing | SEO audit + traffic analysis | seo-daily-audit |
| Operations | DoorDash campaign management | doordash-weekly-campaign-review |
| Creative | Creative asset production on request | N/A |
| IT | Connector health monitoring | doordash-health-check |

### OSS Worker Selection
| Capability | OSS | Status |
|-----------|-----|--------|
| Data analytics | DuckDB | LIVE_INSTALLED |
| Browser automation | Playwright | LIVE_INSTALLED |
| System monitoring | Uptime Kuma | LIVE_INSTALLED |
| Workflow fabric | n8n | LIVE_INSTALLED |
| Knowledge graph | Graphology | LIVE_INSTALLED |

### n8n Workflow Selection
- daily-ceo-brief
- doordash-health-check
- doordash-weekly-campaign-review
- quickbooks-freshness-check
- seo-daily-audit
- review-monitoring

### Duplicate Check
- Status: CLEAN
- objective_uniqueness: PASSED
- task_uniqueness: PASSED
- workflow_uniqueness: PASSED
- connector_event_idempotency: PASSED

### Approval Gate
- seo-daily-audit: REQUIRES_APPROVAL
- doordash-weekly-campaign-review: REQUIRES_APPROVAL
- finance-payroll-reminder: REQUIRES_APPROVAL

### Evidence Plan
- Path: mi-core/evidence/live-now/raw-sushi-revenue-10/
- Files: live-now-scenario.json

### Executive Report Summary
Raw Sushi revenue 10% objective: 3 top opportunities, 3 blockers, 3 approvals pending.

Recommended actions:
1. Approve DoorDash campaign review (Operations)
2. Approve SEO daily audit (Marketing)
3. Review finance baseline analysis
4. Monitor GBP performance weekly
5. Continue food safety compliance monitoring

## Learning Memory Entry
Logged to: mi-core/server/src/memory/ for future reference.
