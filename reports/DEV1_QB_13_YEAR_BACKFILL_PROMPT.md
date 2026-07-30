# Dev1 Prompt — QuickBooks 13-Year Historical Backfill

Context:
- CEO requires `qb-dashboard.html` / Mi QB mirror to show full database coverage and at least 13 years of transaction history where the QuickBooks company file actually contains that history.
- PC/Mi currently has full entity coverage (`17/17 queried`, `0 missing`), but 13-year depth is still short for:
  - Sales Receipts: `2026-04-02` to `2026-06-29`
  - Bills: `2020-01-23` to `2023-05-01`
  - Bill Payments: `2020-01-23` to `2022-03-31`
- Bank/check/deposit/credit-card history already proves the mirror can hold 16-20 years.
- Laptop1 source path is `C:\Ld-project`.

Goal:
Fix Laptop1 `qb-ops-agent` so QBWC pulls transaction history by transaction date, not modified date, then run a real QBWC full sync and replay/verify Mi.

Required code change on Laptop1:
1. In `C:\Ld-project\services\qb-ops-agent`, find the active QBWC request plan source. It may be one of:
   - `src\soap\qbwc-server.ts`
   - `src\soap\qb-request-plan.ts`
   - any equivalent file that builds `SalesReceiptQueryRq`, `InvoiceQueryRq`, `BillQueryRq`, `BillPaymentCheckQueryRq`, `ReceivePaymentQueryRq`, `CheckQueryRq`, `DepositQueryRq`, `CreditCardChargeQueryRq`, `CreditCardCreditQueryRq`, `CreditMemoQueryRq`, `PurchaseOrderQueryRq`, or payroll/paycheck requests.
2. Replace transaction queries that use:
   - `ModifiedDateRangeFilter`
   - `FromModifiedDate`
   - `getDateDaysAgo(3650)` or any 10-year modified-date window
3. Use transaction date instead:
   - `TxnDateRangeFilter`
   - `FromTxnDate`
   - default from date `2000-01-01`
   - allow override with `QB_TXN_FROM_DATE`, defaulting to `2000-01-01`
4. Required transaction requests:
   - `SalesReceiptQueryRq`
   - `InvoiceQueryRq`
   - `BillQueryRq`
   - `BillPaymentCheckQueryRq`
   - `BillPaymentCreditCardQueryRq`
   - `ReceivePaymentQueryRq`
   - `CheckQueryRq`
   - `DepositQueryRq`
   - `CreditCardChargeQueryRq`
   - `CreditCardCreditQueryRq`
   - `CreditMemoQueryRq`
   - `PurchaseOrderQueryRq`
   - `PaycheckQueryRq`
5. Keep list queries as list queries:
   - `AccountQueryRq` with `ActiveStatus All`
   - `CustomerQueryRq` with `ActiveStatus All`
   - `VendorQueryRq` with `ActiveStatus All`
   - `ItemQueryRq` with `ActiveStatus All`
   - `EmployeeQueryRq` with `ActiveStatus All`

Reference request shape:

```xml
<SalesReceiptQueryRq requestID="5">
  <TxnDateRangeFilter><FromTxnDate>2000-01-01</FromTxnDate></TxnDateRangeFilter>
  <IncludeLineItems>true</IncludeLineItems>
</SalesReceiptQueryRq>
```

```xml
<BillPaymentCreditCardQueryRq requestID="9">
  <TxnDateRangeFilter><FromTxnDate>2000-01-01</FromTxnDate></TxnDateRangeFilter>
</BillPaymentCreditCardQueryRq>
```

```xml
<PaycheckQueryRq requestID="18">
  <TxnDateRangeFilter><FromTxnDate>2000-01-01</FromTxnDate></TxnDateRangeFilter>
</PaycheckQueryRq>
```

Build/restart:
1. Run:

```powershell
cd C:\Ld-project\services\qb-ops-agent
npm run build
```

2. Restart the Laptop1 agent/QBWC service that serves port `3457`.
3. Verify generated request plan by calling the local SOAP endpoint or inspecting logs:
   - transaction requests must contain `TxnDateRangeFilter`
   - transaction requests must not contain `ModifiedDateRangeFilter`
   - `BillPaymentCreditCardQueryRq` and `PaycheckQueryRq` must be present

Run sync:
1. Run a real QBWC sync from Laptop1 with QuickBooks open.
2. If large payloads hit Mi limits, replay structured entity batches rather than raw oversized XML. Do not claim success on `200 OK` alone; verify stored row counts and dates.

Acceptance checks from Laptop1/PC:

```powershell
$c = Invoke-RestMethod 'http://100.118.102.113:4001/api/qb/mirror/coverage'
$c.coverage.thirteen_year_requirement | ConvertTo-Json -Depth 5
$c.coverage.entities |
  Where-Object { $_.entity_key -in @('sales_receipts','bills','bill_payments','checks','deposits','credit_card_charges','credit_card_credits','invoices','payments','payroll_checks') } |
  Select-Object entity_type,records,earliest_transaction_date,latest_transaction_date,historical_years,thirteen_year_ready,status
```

Target acceptance:
- `all_database_pulled = true`
- `entity_types_queried = 17`
- `entity_types_not_pulled = 0`
- `not_pulled_entities = []`
- For any transaction entity that has records in the QB company file, `historical_years >= 13` or a written proof that the QB company file does not contain older records for that entity.
- Specifically recheck:
  - Sales Receipts
  - Bills
  - Bill Payments
  - Invoices
  - Receive Payments
  - Payroll Checks

Truth rule:
- Do not mark the dashboard/CFO audit as fully 13-year-ready unless Mi coverage shows it.
- If QuickBooks returns empty for a type, record it as `queried_empty`.
- If QuickBooks returns only a short history for Sales Receipts/Bills/Bill Payments even with `TxnDateRangeFilter` from `2000-01-01`, report that as source-file reality, not as complete 13-year data.
