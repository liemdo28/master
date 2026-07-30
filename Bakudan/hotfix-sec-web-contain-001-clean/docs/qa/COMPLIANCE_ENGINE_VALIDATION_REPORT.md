# Compliance Engine Validation Report

Generated: 2026-06-04 13:25 Asia/Saigon

Target: `https://preview.dashboard.bakudanramen.com`

Status: BUILT, NOT YET VALIDATED

Final verdict: FAIL

The Compliance & Payment Operations Engine is not accepted. The deployed preview does not expose the obligation registry routes, the required database SQL could not be executed from this workstation, the server-side rollback validation fails against deployed schema/code drift, and the official Playwright workflow has failing/skipped checks.

## 1. Build Summary

Local workspace contains the main obligation implementation files:

| Surface | Evidence |
|---|---|
| Migration | `database/migrations/2026_06_04_obligation_registry.sql` |
| Seeder | `seed_obligations.php` |
| Model | `models/Obligation.php` |
| Service | `service/ObligationService.php` |
| Controller | `controllers/ObligationController.php` |
| Views | `views/obligations/*`, `views/obligations/_dashboard_widget.php` |
| Dashboard include | `views/dashboard/overview.php` includes `../obligations/_dashboard_widget.php` |

Deployment/runtime evidence shows preview is not serving this feature:

| Route | Result |
|---|---|
| `/obligations` | HTTP 404 |
| `/obligations/reviewer` | HTTP 404 |
| `/obligations/approver` | HTTP 404 |
| `/overview` | HTTP 200, but authenticated page text did not contain obligation KPI terms |

Local `index.php` search found no `ObligationController`, `obligations`, or `api/obligations` route wiring. This is a blocker even before database validation.

## 2. Tables Created

Local migration defines the required tables:

| Table | Local migration status |
|---|---|
| `obligation_categories` | Defined with `CREATE TABLE IF NOT EXISTS` |
| `obligations` | Defined with `CREATE TABLE IF NOT EXISTS` |
| `obligation_payments` | Defined with `CREATE TABLE IF NOT EXISTS` |

Required live SQL was attempted from this workstation:

```text
SHOW TABLES LIKE '%obligation%';
SHOW CREATE TABLE obligations;
SHOW CREATE TABLE obligation_categories;
SHOW CREATE TABLE obligation_payments;
```

Result:

```text
pymysql.err.OperationalError: (1045, "Access denied for user 'liemdo'@'171.233.31.1' (using password: YES)")
```

Server-side preview health endpoint confirms the preview DB connection is valid server-side:

```json
{
  "status": "PASS",
  "database": {
    "host": "mysql.bakudanramen.com",
    "name": "preview_database",
    "uses_preview_db": true,
    "uses_production_db": false
  },
  "checks": [
    { "name": "db_connection", "status": "PASS" },
    { "name": "current_database", "status": "preview_database" }
  ]
}
```

It does not check obligation tables.

## 3. Seeder Results

Seeder command required:

```text
php seed_obligations.php
php seed_obligations.php
```

Result: not executed. Local `php` is not installed on this workstation, and direct database access is denied. Running the seeder through HTTP was not attempted because it would mutate preview data without an explicit safe endpoint or production-safe approval path.

Static seeder inspection found 16 obligation definitions. Idempotency code exists via lookup on `LOWER(name)` plus `store_id`, but runtime idempotency was not proven.

Duplicate-protection query required but not executed:

```sql
SELECT name, store, COUNT(*) as cnt
FROM obligations
GROUP BY name, store
HAVING cnt > 1;
```

## 4. Obligation List

Static local seeder definitions found:

| Obligation |
|---|
| Monthly Rent - Raw Stockton |
| Monthly Rent - Bakudan Bandera |
| Monthly Rent - Bakudan Stone Oak |
| Monthly Rent - Bakudan Rim |
| PG&E - Raw Stockton |
| Waste - Raw Stockton |
| CPS Energy - Bakudan Bandera |
| CPS Energy - Bakudan Stone Oak |
| CPS Energy - Bakudan Rim |
| Business Insurance - Review |
| Workers Comp Insurance - Review |
| Umbrella Insurance - Review |
| EPLI Insurance - Review |
| Quarterly Payroll Tax Filing |
| Quarterly Sales Tax Filing |
| TABC License - Annual Renewal |

Missing or not exact against directive minimum:

| Required item | Status |
|---|---|
| CPS Energy - Bandera | Present only as `CPS Energy - Bakudan Bandera` |
| CPS Energy - Stone Oak | Present only as `CPS Energy - Bakudan Stone Oak` |
| CPS Energy - Rim | Present only as `CPS Energy - Bakudan Rim` |
| Quarterly Tax Filing | Missing |
| TABC Renewal | Present only as `TABC License - Annual Renewal` |
| Alcohol Filing | Missing |
| AmTrust Audit | Missing |
| Rent Master Data Collection | Missing |
| Utility Master Data Collection | Missing |
| Insurance Master Data Collection | Missing |

Live obligation count: not validated.

## 5. Generated Task List

Generator command required but not executed:

```text
php seed_obligations.php
# or POST /obligations/generate after registry is available
```

Local service contains generation code in `service/ObligationService.php`, and `seed_obligations.php` calls:

```php
$generated = $service->generateDueOccurrences();
```

Live generated tasks were not validated because `/obligations/generate` is not routable on preview and direct DB SQL is blocked.

## 6. Reviewer Proof

The general existing QA workflow, not the obligation engine workflow, did pass reviewer approval:

```text
06 - Reviewer Approve > reviewer approves the task: passed
Task 19741 review: processed = true
```

This does not satisfy the required obligation flow because the task was a generic QA task, not a generated obligation payment task with required evidence/checklist/payment metadata.

Evidence files:

| Evidence | Path |
|---|---|
| Reviewer before | `qa/artifacts/2026-06-04/reviewer_approves_the_task_reviewer_approve_before.png` |
| Reviewer after | `qa/artifacts/2026-06-04/reviewer_approves_the_task_reviewer_approve_after.png` |

## 7. Approver Proof

The general existing QA workflow, not the obligation engine workflow, did pass approver acceptance:

```text
07 - Approver Accept > approver accepts the task: passed
Task 19741 final: done = true
```

This does not satisfy the required obligation flow because reviewer notes, obligation details, attachments, evidence, and obligation payment history were not proven.

Evidence files:

| Evidence | Path |
|---|---|
| Approver before | `qa/artifacts/2026-06-04/approver_accepts_the_task_approver_accept_before.png` |
| Approver after | `qa/artifacts/2026-06-04/approver_accepts_the_task_approver_accept_after.png` |

## 8. Attachment Proof

Attachment validation did not pass.

```text
08 - Attachments > upload attachment to task: skipped
```

Server-side rollback validation also reports:

```text
task_attachments -> MISSING
```

Required PNG/JPG/PDF/XLSX upload/download/visibility checks were not completed.

## 9. Notification Proof

General notification tests passed, but no obligation-specific notifications were proven.

```text
10 - Notifications > notification center has workflow notifications: passed
10 - Notifications > API health check for notifications: passed
Found 0 notification items
```

Required SQL was not executed:

```sql
SELECT id, user_id, task_id, type, title, message, is_read, created_at
FROM task_notifications
ORDER BY id DESC
LIMIT 30;
```

## 10. Dashboard KPI Proof

Preview `/overview` loaded, but authenticated text did not include the required obligation widgets:

| Required widget | Preview evidence |
|---|---|
| Upcoming Payments | Not found |
| Overdue Payments | Not found |
| Upcoming Renewals | Not found |
| Missing Evidence | Not found |
| Awaiting Approval | Not found |
| Rent Due | Not found |
| Utility Due | Not found |
| Tax Due | Not found |
| Insurance Due | Not found |

Screenshot:

```text
qa/artifacts/2026-06-04/overview_validation.png
```

No SQL evidence behind KPI values was produced.

## 11. Role Permission Proof

Required users:

| User | Required role |
|---|---|
| `user1 / user1` | CEO |
| `user2 / user2` | Manager |
| `user3 / user3` | Member |

Result: not validated. Existing Playwright auth uses saved/admin preview session, not the required role matrix. No blocked-access evidence was produced.

## 12. Errors Found

| Area | Evidence |
|---|---|
| Direct SQL | MySQL 1045 access denied for local client IP |
| Preview route | `/obligations`, `/obligations/reviewer`, `/obligations/approver` return 404 |
| Local route wiring | `index.php` has no obligation route/controller wiring |
| Server-side rollback validation | Fails: unknown column `assigned_to`; `task_attachments` missing |
| Playwright submit | Fails waiting for `meta[name="csrf-token"]` |
| Playwright DB validate | Fails because `/tasks/19741/json` does not return a task |
| QA report generator | Was broken under current Node/ts-node mode; fixed locally |

Server-side rollback validation failure:

```text
STEP: 0 - Schema Pre-Check
tasks -> EXISTS
task_comments -> EXISTS
task_notifications -> EXISTS
task_reviewer_notes -> EXISTS
task_approval_notes -> EXISTS
task_attachments -> MISSING

STEP: 1 - Create Task
FAIL - Exception: SQLSTATE[42S22]: Column not found: 1054 Unknown column 'assigned_to' in 'field list'
Transaction ROLLED BACK - no test data persists in the database.
```

## 13. Fixes Applied

Applied one local QA infrastructure fix:

| File | Change |
|---|---|
| `qa/scripts/generate-report.ts` | Added a stable `__dirname` based on `process.cwd()` so `npm run qa:report` can generate `qa/reports/failure-report.md` under the current Node runtime |

No compliance engine feature fixes were applied because the directive says not to build new features during validation.

## 14. Playwright Results

Command:

```text
npm run qa
```

Result:

| Metric | Count |
|---|---:|
| Total tests | 15 |
| Passed | 11 |
| Failed | 2 |
| Skipped | 2 |
| Duration | 161.3s |

Failures:

| Test | Failure |
|---|---|
| `05 - Task Submit > submit task for review` | Timeout waiting for `meta[name="csrf-token"]` |
| `11 - Database Validation > verify workflow data in database` | Expected task lookup to be found; received false |

Skipped:

| Test |
|---|
| `08 - Attachments > upload attachment to task` |
| `09 - Mentions > add comment with @mention` |

Generated evidence:

| Artifact | Path |
|---|---|
| Playwright JSON | `qa/reports/results.json` |
| Failure report | `qa/reports/failure-report.md` |
| Screenshots/videos/traces | `qa/artifacts/test-results/*` |
| Route screenshots | `qa/artifacts/2026-06-04/*_validation.png` |

## Acceptance Criteria Status

| Criterion | Status |
|---|---|
| Obligations exist in database | Not proven |
| Seeder is idempotent | Not proven |
| Generator creates correct recurring tasks | Not proven |
| No duplicate tasks | Not proven |
| Generated tasks contain required evidence/checklists | Not proven |
| Reviewer can verify payment/compliance evidence | Not proven |
| Approver can final approve | Not proven |
| Attachments work | Fail / skipped; `task_attachments` missing in server validation |
| Notifications work | Partially proven for generic workflow only |
| Dashboard KPI shows real obligation status | Fail |
| Playwright passes | Fail |
| No PHP/SQL/console errors | Fail |

## Required Next Actions

1. Wire obligation routes in `index.php` for registry, reviewer, approver, generation, payment detail, and APIs.
2. Deploy the local obligation files to preview only, not production.
3. Add or repair a server-side read-only SQL evidence endpoint for the exact required validation queries, or allow this workstation DB access to `preview_database`.
4. Update `validate_preview_workflow.php` for the deployed task schema (`assigned_to` is not valid there) and confirm `task_attachments` migration/table.
5. Complete the seeder data gaps: `Quarterly Tax Filing`, `Alcohol Filing`, `AmTrust Audit`, and the three master data collection obligations.
6. Add obligation-specific Playwright tests for registry load, seed visibility, task generation, obligation task detail content, evidence upload, reviewer approval, approver acceptance, and KPI changes.
7. Rerun `npm run qa` and collect screenshots, videos, traces, SQL outputs, and final PASS/FAIL evidence.

Until those actions pass, the correct status remains: BUILT, NOT YET VALIDATED.
