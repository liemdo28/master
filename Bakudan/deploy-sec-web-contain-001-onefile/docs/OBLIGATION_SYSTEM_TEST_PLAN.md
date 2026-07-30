# Obligation System Test Plan

## Scope
Validate the CEO Compliance & Payment Operations build using the existing Task system.

## Preconditions
1. Run migration: `database/migrations/2026_06_04_obligation_registry.sql`
2. Run seeder: `php seed_obligations.php`
3. Ensure at least one admin and one manager user exist.

## Test Cases

### 1. Schema
- Verify tables exist: `obligation_categories`, `obligations`, `obligation_payments`
- Verify indexes and foreign keys compile successfully.

### 2. Seeder
- Run `php seed_obligations.php`
- Expect categories for Rent, Utility, Insurance, Tax, License, Compliance
- Expect obligations for rent, utilities, insurance review, payroll tax, sales tax, TABC

### 3. Task generation
- POST `/obligations/generate`
- Expect `obligation_payments` rows created for due obligations
- Expect linked `tasks` rows created and connected via `obligation_payments.task_id`
- Re-run generation and verify no duplicates for same obligation + due date

### 4. Reviewer workspace
- Open `/obligations/reviewer`
- Expect pending payments visible
- Add reviewer notes and submit `approved`
- Verify `reviewer_result`, `reviewer_notes`, `reviewer_result_at`, `status=review`

### 5. Approver workspace
- Open `/obligations/approver`
- Expect reviewed payments visible
- Submit `approved`
- Verify `approver_result`, `approver_notes`, `approver_result_at`, `status=paid`

### 6. Dashboard widgets
- Call `/api/obligations/kpis`
- Expect keys: overdue, due_30, due_60, awaiting_approval, missing_evidence, tax_filings, renewals
- Call `/api/obligations/widgets/upcoming`
- Call `/api/obligations/widgets/overdue`
- Call `/api/obligations/widgets/tax_filings`
- Call `/api/obligations/widgets/renewals`

### 7. Evidence tracking
- Update payment through `/api/obligations/payment/{id}`
- Set evidence flags and paid values
- Verify payment record updates correctly

## SQL assertions
- No duplicate payments by `(obligation_id, due_date)`
- Every generated payment has a linked task where task generation succeeded
- Overdue widget count matches SQL count for unpaid due_date < today

## Exit criteria
- CEO can identify due items, overdue items, upcoming tax filings, renewals, missing evidence, and approval blockers without spreadsheets.
