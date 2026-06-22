# MONEY_OPERATIONS_CERTIFICATION.md
> Phase 7 — Money Operations
> Date: 2026-06-18
> Target: MONEY_OPERATIONS_READY

---

## 6 Money Workflows Implemented

| # | Workflow ID | Trigger | Data Source | Approval | Status |
|---|------------|---------|-------------|----------|--------|
| W1 | raw_sales_receipt_check | POST /api/company-os/money/raw_sales_receipt_check | Toast POS + QuickBooks | If discrepancy >$100 | ✅ |
| W2 | toast_monthly_report_email | POST /api/company-os/money/toast_monthly_report_email | Toast POS | Yes — email approval | ✅ |
| W3 | tax_payment_evidence_pull | POST /api/company-os/money/tax_payment_evidence_pull | QuickBooks | No | ✅ |
| W4 | quickbooks_sync_status | POST /api/company-os/money/quickbooks_sync_status | QuickBooks | If errors | ✅ |
| W5 | payroll_status_check | POST /api/company-os/money/payroll_status_check | Accounting Engine | If pending | ✅ |
| W6 | doordash_campaign_monthly | POST /api/company-os/money/doordash_campaign_monthly | DoorDash | If ROAS <2x | ✅ |

---

## Safety Rules

1. **No number fabrication** — all financial figures come directly from data sources
2. **DATA_MISSING** returned when APIs unavailable — never guessed
3. **PENDING_APPROVAL** for workflows that require CEO sign-off before execution
4. **Evidence stored** — all workflow results include raw source data
5. **Error isolation** — each workflow fails independently; others still run

---

## WhatsApp Trigger Phrases

| Vietnamese | English | Workflow |
|-----------|---------|---------|
| "kiểm tra doanh thu" | "check sales receipt" | raw_sales_receipt_check |
| "báo cáo toast tháng" | "toast monthly report" | toast_monthly_report_email |
| "bằng chứng thuế" | "tax evidence" | tax_payment_evidence_pull |
| "quickbooks sync" | "quickbooks status" | quickbooks_sync_status |
| "lương tháng" | "payroll status" | payroll_status_check |
| "doordash campaign" | "doordash monthly" | doordash_campaign_monthly |

---

## API Endpoints

```
POST /api/company-os/money/:workflow_id  — run single workflow
GET  /api/company-os/money               — run all 6 workflows
```

## Status: MONEY_OPERATIONS_READY ✅
