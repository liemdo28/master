# BILL / PAYMENT WORKFLOW AUDIT
**Phase 13.3 — Operational Workflow & Control Validation**
**Generated:** 2026-06-10

---

## BILL WORKFLOW — COMPLETE STAGE VALIDATION

```
Bill Created → Assigned → Checked → Approved → Paid → Verified → Completed
```

### Stage 1: Bill Created
**STATUS: ✅ IMPLEMENTED**

- Route: `POST /bills/create` → `BillController::createBill()`
- Route: `POST /bills/store/{id}` → per-store bill creation
- Database: `bills` table (migration: `2026_03_05_tracking_bills.sql`)
- Fields captured: `title`, `store_id`, `vendor_id`, `due_date`, `amount`, `category`, `repeat_type`
- Categories supported: `utilities`, `tax`, `insurance`, `rent`, `payroll`, `subscription`, `supplies`, `maintenance`, `banking`, `general`
- Source: `controllers/BillController.php:createBill()`

### Stage 2: Assigned (to Store / Vendor)
**STATUS: ✅ IMPLEMENTED**

- Bills are assigned to a `store_id` and optionally a `vendor_id` at creation
- Multi-store bill view: `GET /bills` — cross-store calendar
- Per-store bill view: `GET /bills/store/{id}`
- Vendor assignment: `VendorController` + `vendors` table
- Source: `models/Bill.php:getByStore()`, `models/Bill.php:countByStore()`

### Stage 3: Checked (Attachment / Evidence Upload)
**STATUS: ✅ IMPLEMENTED**

- Route: `POST /bills/{id}/upload` → `BillController::uploadBillFile()`
- Supported: jpg, jpeg, png, gif, webp, pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv, zip (max 10MB)
- MIME verification: via PHP `finfo`
- Download: `GET /bill-attachments/{id}/download`
- Delete: `POST /bill-attachments/{id}/delete`
- Source: `controllers/BillController.php:uploadBillFile()`

### Stage 4: Approved / Payment Recorded
**STATUS: ✅ IMPLEMENTED**

- Route: `POST /bills/{id}/pay` → `BillController::recordPayment()`
- Captures: amount, payment_date, payment_method, notes
- Database: `payments` table — `Payment::create()`, `Payment::getForBill()`
- Route: `POST /bills/{id}/paid` → `BillController::markPaid()` (quick mark)
- API: `POST /api/bills/{id}/paid` → `BillController::apiMarkPaid()`
- Source: `controllers/BillController.php:recordPayment()`, `models/Payment.php`

### Stage 5: Paid
**STATUS: ✅ IMPLEMENTED**

- Bill `status` field ENUM: `pending`, `paid`, `overdue`, `archived`
- `Bill::markPaid()` updates status to `paid`, records `paid_date`
- Payment model: `Payment::totalForBill()` aggregates all payments
- Monthly summary: `Bill::monthlySummary()` — total paid per store per month
- Source: `models/Bill.php:markPaid()`, `models/Bill.php:monthlySummary()`

### Stage 6: Verified (Evidence Chain)
**STATUS: ✅ IMPLEMENTED via Obligation Registry**

- For compliance-tracked bills (tax, insurance, rent), the Obligation Registry provides:
  - `evidence_invoice` (bool)
  - `evidence_receipt` (bool)
  - `evidence_bank_proof` (bool)
  - `evidence_payment_confirm` (bool)
  - `evidence_other` (bool)
- Widget: `api/obligations/widgets/missing_evidence` — surfaces bills with missing evidence
- Reviewer queue: `GET /obligations/reviewer` — reviewer verifies evidence
- Source: `database/migrations/2026_06_04_obligation_registry.sql` (lines 80–84)

### Stage 7: Completed
**STATUS: ✅ IMPLEMENTED**

- Bills reach `status=paid` as final state
- Obligations reach `status=approved` after approver chain
- Obligation auto-marks paid on approver approval: `ObligationController::apiApprove()` line 226
- Source: `controllers/ObligationController.php:apiApprove()`

---

## PAYMENT WORKFLOW — DETAILED AUDIT

### Vendor Payments
| Feature | Status | Route | Source |
|---------|--------|-------|--------|
| Create vendor bill | ✅ | `POST /bills/create` with vendor_id | `BillController::createBill()` |
| Assign to store | ✅ | store_id on bill | `Bill::create()` |
| Due date + reminder | ✅ | `due_date` field + cron jobs | `jobs/SendOverdueEscalationJob.php` |
| Evidence upload | ✅ | `POST /bills/{id}/upload` | `BillController::uploadBillFile()` |
| Mark paid | ✅ | `POST /bills/{id}/paid` | `BillController::markPaid()` |
| Verification (Obligation) | ✅ | `/obligations/reviewer` | `ObligationController::reviewerQueue()` |

### Tax Payments
| Feature | Status | Route | Source |
|---------|--------|-------|--------|
| Tax obligation creation | ✅ | `POST /obligations` (category=Tax) | `ObligationController::store()` |
| Reviewer checks evidence | ✅ | `POST /api/obligations/review/{id}` | `ObligationController::apiReview()` |
| Approver final approval | ✅ | `POST /api/obligations/approve/{id}` | `ObligationController::apiApprove()` |
| Auto-mark paid on approval | ✅ | Line 226 of ObligationController | `$this->obligation->markPaid()` |
| Widget: upcoming tax filings | ✅ | `GET /api/obligations/widgets/tax_filings` | `Obligation::widgetUpcomingTaxFilings()` |

### Payroll Payments
| Feature | Status | Route | Source |
|---------|--------|-------|--------|
| Create payroll | ✅ | `POST /admin/payroll` | `PayrollController::create()` |
| Process payroll | ✅ | `POST /admin/payroll/{id}/process` | `PayrollController::process()` |
| Approve payroll | ✅ | `POST /admin/payroll/{id}/complete` | `PayrollController::complete()` |
| Mark paid | ✅ | `POST /admin/payroll/{id}/mark-paid` | `PayrollController::markPaid()` |
| Cancel | ✅ | `POST /admin/payroll/{id}/cancel` | `PayrollController::cancel()` |
| Adjustments | ✅ | Adjustment sub-records | `PayrollController` |

### Utility Bills
| Feature | Status | Route | Source |
|---------|--------|-------|--------|
| Create (category=utilities) | ✅ | `POST /bills/create` | `BillController::createBill()` |
| Recurring template | ✅ | `GET /bills/templates` | `BillController::templates()` |
| Monthly auto-generate | ✅ | `Bill::ensureRecurringForMonth()` | `models/Bill.php` |
| Overdue reminder | ✅ | Cron: `api/email/jobs/overdue` | `jobs/SendOverdueEscalationJob.php` |

### Credit Card Bills
| Feature | Status | Route | Source |
|---------|--------|-------|--------|
| Create (category=banking) | ✅ | `POST /bills/create` | `BillController::createBill()` |
| Statement attachment | ✅ | `POST /bills/{id}/upload` | `BillController::uploadBillFile()` |
| Payment record | ✅ | `POST /bills/{id}/pay` | `BillController::recordPayment()` |

### Rent
| Feature | Status | Route | Source |
|---------|--------|-------|--------|
| Recurring obligation | ✅ | `POST /obligations` (category=Rent) | `ObligationController::store()` |
| Monthly auto-generate | ✅ | `ObligationService::generateDueOccurrences()` | `POST /obligations/generate` |
| Reviewer verify | ✅ | `/obligations/reviewer` | `ObligationController::reviewerQueue()` |

---

## RECURRING BILL TEMPLATE SYSTEM

**STATUS: ✅ FULLY IMPLEMENTED**

- Template manager: `GET /bills/templates`
- Repeat types: `monthly`, `weekly`, `yearly`, `daily`
- Auto-generation: `Bill::ensureRecurringForMonth()` — prevents duplicate creation
- Cycle tracking: `cycle_count`, `last_generated`, `next_due` computed per template
- Duplicate bill: `BillController::duplicateBill()` — one-click clone

---

## GAPS

| Gap | Description |
|-----|-------------|
| Bill-level multi-step approval | Bills themselves have no Reviewer→Approver chain. Approval exists at the Obligation layer, not the raw bill layer. For vendor payments outside the Obligation registry, there is no mandatory review gate. |
| Financial Verifier role | No dedicated "Financial Verifier" role distinct from Approver in the bill workflow. Obligation workflow has reviewer+approver; raw bill workflow has only "mark paid." |

---

*Evidence sources: controllers/BillController.php, models/Bill.php, models/Payment.php, controllers/ObligationController.php, database/migrations/2026_03_05_tracking_bills.sql, database/migrations/2026_06_04_obligation_registry.sql*
