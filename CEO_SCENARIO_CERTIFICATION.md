# CEO_SCENARIO_CERTIFICATION

**Generated:** 2026-06-15T09:32:45.177Z
**Result:** PASS

Scenario:

```text
Kiểm tra Dashboard, coi QB, tạo SEO Raw Sushi rồi gửi Maria.
```

## Normal Run

Parent: `WF-OPS-CEO-1` / `DASHBOARD-AUDIT-20260615-2041`

| Child | Workflow | Domain | Status | Error |
|---|---|---|---:|---|
| WF-OPS-CEO-1-A | DASHBOARD_AUDIT | dashboard_monitoring | approval_pending |  |
| WF-OPS-CEO-1-B | FINANCE_REPORT | finance_qb | completed |  |
| WF-OPS-CEO-1-C | SEO_CONTENT | seo_content | approval_pending |  |
| WF-OPS-CEO-1-D | EMAIL_DRAFT | email_comms | approval_pending |  |

## QB Disabled Run

Parent: `WF-OPS-CEO-2` / `DASHBOARD-AUDIT-20260615-2043`

| Child | Workflow | Domain | Status | Error |
|---|---|---|---:|---|
| WF-OPS-CEO-2-A | DASHBOARD_AUDIT | dashboard_monitoring | approval_pending |  |
| WF-OPS-CEO-2-B | FINANCE_REPORT | finance_qb | failed | Forced failure for finance_qb |
| WF-OPS-CEO-2-C | SEO_CONTENT | seo_content | approval_pending |  |
| WF-OPS-CEO-2-D | EMAIL_DRAFT | email_comms | approval_pending |  |

Expected partial-failure behavior: Dashboard/SEO/Maria continue, QB fails, no global abort.
