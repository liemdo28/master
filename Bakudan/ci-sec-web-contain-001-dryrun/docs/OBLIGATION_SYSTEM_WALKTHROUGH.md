# Obligation System Walkthrough

## Purpose
This build adds a production-only recurring compliance and payment operations system using the existing Task system — not a new standalone module.

It covers:
- master obligation registry
- recurring task generation
- reviewer workflow
- approver workflow
- CEO dashboard visibility
- evidence / payment tracking

## Deliverables included
1. Database schema migration
2. Seeder for initial obligations
3. Obligation model
4. Obligation task generator service
5. Obligation controller
6. Admin registry view
7. Reviewer queue view
8. Approver queue view
9. Payment detail view
10. Dashboard KPI widget partial
11. SQL validation script
12. Test plan document

## Files added / updated
### Added
- `database/migrations/2026_06_04_obligation_registry.sql`
- `models/Obligation.php`
- `service/ObligationService.php`
- `controllers/ObligationController.php`
- `seed_obligations.php`
- `views/obligations/index.php`
- `views/obligations/show.php`
- `views/obligations/reviewer.php`
- `views/obligations/approver.php`
- `views/obligations/payment_detail.php`
- `views/obligations/_dashboard_widget.php`
- `sql/obligation_validation.sql`
- `docs/OBLIGATION_SYSTEM_TEST_PLAN.md`
- `docs/OBLIGATION_SYSTEM_WALKTHROUGH.md`

### Updated
- `index.php` routes + bootstrapping

## Database design
### `obligation_categories`
Stores top-level classifications:
- Rent
- Utility
- Insurance
- Tax
- License
- Compliance

### `obligations`
Master recurring registry. Each row defines:
- name
- vendor
- store
- frequency
- due day / due month
- grace days
- reviewer
- approver
- priority
- next due date
- account/compliance notes

### `obligation_payments`
Tracks each generated payment cycle:
- obligation reference
- linked task id
- due date
- amount
- evidence flags
- reviewer / approver outcomes
- paid amount / date / reference

## Operational flow
### 1. Seed master registry
Run:
```powershell
C:\xampp\php\php.exe seed_obligations.php
```
This loads the CEO-defined obligations:
- monthly rent
- utilities
- insurance reviews
- quarterly tax filings
- annual TABC renewal

### 2. Generate recurring tasks
Open:
- `/obligations`

Click:
- `Generate Due Tasks`

Or post to:
- `/obligations/generate`

This creates:
- a row in `obligation_payments`
- a linked task in the existing task system

### 3. Reviewer workflow
Open:
- `/obligations/reviewer`

Reviewer checks:
- invoice uploaded
- receipt uploaded
- amount present / matches
- due date matches
- reviewer notes

Reviewer submits:
- approve review
- request changes

### 4. Approver workflow
Open:
- `/obligations/approver`

Approver sees:
- obligation
- due date
- reviewer notes
- current status
- approval history summary

Approver submits:
- approved
- rejected
- changes requested

Approved items are marked paid through the obligation payment workflow.

### 5. Payment detail
Open:
- `/obligations/payment/{id}`

This page shows:
- payment status
- evidence flags
- reviewer notes
- approver notes
- linked task
- payment recording form

### 6. CEO dashboard visibility
Widget partial available at:
- `views/obligations/_dashboard_widget.php`

Expected KPI cards:
- Overdue Payments
- Due Next 30 Days
- Missing Evidence
- Awaiting Approval
- Upcoming Tax Filings
- Upcoming Renewals

API endpoints:
- `/api/obligations/kpis`
- `/api/obligations/widgets/upcoming`
- `/api/obligations/widgets/overdue`
- `/api/obligations/widgets/tax_filings`
- `/api/obligations/widgets/renewals`
- `/api/obligations/widgets/missing_evidence`
- `/api/obligations/widgets/awaiting_approval`

## Routes added
### Pages
- `/obligations`
- `/obligations/{id}`
- `/obligations/reviewer`
- `/obligations/approver`
- `/obligations/payment/{id}`

### Actions / API
- `POST /obligations`
- `POST /obligations/{id}`
- `POST /obligations/{id}/delete`
- `POST /obligations/generate`
- `GET /api/obligations/kpis`
- `GET /api/obligations/widgets/{name}`
- `POST /api/obligations/review/{id}`
- `POST /api/obligations/approve/{id}`
- `POST /api/obligations/payment/{id}`

## Validation
Run SQL checks from:
- `sql/obligation_validation.sql`

Key checks:
- tables exist
- obligation counts
- payment counts
- duplicate `(obligation_id, due_date)` rows
- orphaned task references
- overdue unpaid count
- payment status distribution

## Notes / current implementation caveats
1. The dashboard widget partial is created, but still needs to be explicitly included from the desired dashboard page if not already wired elsewhere.
2. Reviewer and approver pages are functional UI layers over the obligation payment workflow, but may need additional styling harmonization with the rest of the dashboard.
3. Some simplified views rely on fields already returned by the model joins; if additional approval-history richness is desired, the model can be extended later.
4. This implementation intentionally reuses the existing task and approval ecosystem.

## Recommended rollout sequence
1. Apply migration in production
2. Run seeder once
3. Validate schema with SQL script
4. Run PHP lint
5. Generate due tasks
6. Verify reviewer queue
7. Verify approver queue
8. Verify CEO KPI API responses
9. Add widget partial into final dashboard slot if desired

## Success outcome
After rollout, the CEO can see:
- which bills are due
- which payments are overdue
- which filings are upcoming
- which renewals are upcoming
- which items are blocked in review/approval
- which evidence is missing

No spreadsheet required.
