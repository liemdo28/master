# Hardcoded String Fix Report

**Date:** 2026-06-22
**Scope:** P0 and P1 visible hardcoded strings replaced with t() calls

## Fixes Applied

### P0 — KPI Card Labels (views/dashboard/overview.php)
| Before | After | Key Used |
|--------|-------|----------|
| `Total Cash Risk` | `<?= e(t('dashboard.kpi.cash_risk')) ?>` | dashboard.kpi.cash_risk |
| `Critical Tasks` | `<?= e(t('dashboard.kpi.critical_tasks')) ?>` | dashboard.kpi.critical_tasks |
| `Compliance Risk` | `<?= e(t('dashboard.kpi.compliance_risk')) ?>` | dashboard.kpi.compliance_risk |
| `Recommended Payment Order` | `<?= e(t('dashboard.finance.recommended_payment_order')) ?>` | dashboard.finance.recommended_payment_order |
| `Payment Risk Board` | `<?= e(t('dashboard.finance.payment_risk_board')) ?>` | dashboard.finance.payment_risk_board |

### P0 — Drilldown Views
| File | Before | After |
|------|--------|-------|
| views/drilldown/critical_tasks.php | `$ddTitle = 'Critical Tasks'` | `$ddTitle = t('dashboard.kpi.critical_tasks')` |
| views/drilldown/critical_tasks.php | `$pageTitle = 'Critical Tasks'` | `$pageTitle = t('dashboard.kpi.critical_tasks')` |
| views/drilldown/critical_tasks.php | `No critical tasks found...` | `<?= e(t('overview.all_clear')) ?>` |
| views/drilldown/cash_risk.php | `$ddTitle = 'Cash Risk by Store'` | `$ddTitle = t('dashboard.kpi.cash_risk')` |
| views/drilldown/cash_risk.php | `$pageTitle = 'Cash Risk'` | `$pageTitle = t('dashboard.kpi.cash_risk')` |
| views/drilldown/compliance_risk.php | `$ddTitle = 'Compliance Risk'` | `$ddTitle = t('dashboard.kpi.compliance_risk')` |
| views/drilldown/compliance_risk.php | `No compliance risk items found.` | `<?= e(t('overview.no_risks')) ?>` |

### P1 — Operations & CEO Views
| File | Before | After |
|------|--------|-------|
| views/operations/today.php | `Store Health Issues` | `<?= e(t('dashboard.operations.store_health_issues')) ?>` |
| views/agent-os/ceo-dashboard.php | `Critical Tasks` | `<?= e(t('dashboard.kpi.critical_tasks')) ?>` |
| views/franchise/scorecard.php | `Store Health` | `<?= e(t('nav.store_health')) ?>` |
| views/admin/store_detail.php | `Store Health Score` | `<?= e(t('store.health_score')) ?>` |

### P1 — Sidebar Labels (views/layouts/main.php)
| Before | After |
|--------|-------|
| `<span class="sb-item__label">Overview</span>` | `<?= e(t('nav.overview')) ?>` |
| `<span class="sb-item__label">Store Command Center</span>` | `<?= e(t('nav.store_command')) ?>` |
| `<span class="sb-item__label">Store Health</span>` | `<?= e(t('nav.store_health')) ?>` |
| `<span class="sb-item__label">Release Center</span>` | `<?= e(t('nav.releases')) ?>` |

## Remaining (P2 — not visible to end users)
- Some hardcoded strings in section headers (e.g., "Finance — CFO Panel", "Operations — CEO Panel") are internal section labels
- Table column headers (Task, Store, Assignee, etc.) in drilldown tables — these are data column labels, lower priority
- Status badge values like "CRITICAL", "HIGH", "LOW" in KPI badges — these are computed from data, not static labels

## Verification
Run `scripts/verify-translations.php` — hardcoded string scan will report remaining instances.
