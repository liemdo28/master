# SCHEMA DIFF REPORT
## Phase 13.9A — Production Schema Recovery
### Date: 2026-06-17 | Environment: Production (taskflow_db)

---

## CONNECTION STATUS

| Property | Value |
|---|---|
| Host | mysql-taskflow.bakudanramen.com |
| Database | taskflow_db |
| MySQL Version | 8.0.41-0ubuntu0.24.04.1 |
| Total Tables Found | 96 |
| Connection | ✅ PASS |

---

## SCHEMA DRIFT — SUMMARY

| Metric | Count |
|---|---|
| Total Checks | 92 |
| Passed | 57 |
| Failed | 35 |
| Missing Tables | 15 |
| Missing Columns | 20 |
| Status | ❌ FAIL |

---

## MISSING TABLES (15)

| # | Table | Migration Source | Priority |
|---|---|---|---|
| 1 | `release_drafts` | 2026_06_02_release_governance.sql | HIGH |
| 2 | `release_versions` | 2026_06_02_release_governance.sql | HIGH |
| 3 | `release_approvals` | 2026_06_02_release_governance.sql | HIGH |
| 4 | `release_schedule` | 2026_06_02_release_governance.sql | HIGH |
| 5 | `penalties` | 2026_06_11_phase13_penalty_accountability.sql | HIGH |
| 6 | `penalty_assessments` | 2026_06_11_phase13_penalty_accountability.sql | HIGH |
| 7 | `remember_tokens` | 2026_06_15_remember_tokens.sql | MEDIUM |
| 8 | `obligations` | 2026_06_04_obligation_registry.sql | HIGH |
| 9 | `obligation_payments` | 2026_06_04_obligation_registry.sql | HIGH |
| 10 | `obligation_tasks` | 2026_06_04_obligation_registry.sql | HIGH |
| 11 | `duplicate_task_flags` | 2026_06_10_duplicate_control.sql | MEDIUM |
| 12 | `duplicate_bill_flags` | 2026_06_16_deduplicate_bills.sql | MEDIUM |
| 13 | `employees` | 2026_05_29_phase11_modules.sql | MEDIUM |
| 14 | `shifts` | 2026_05_29_phase11_modules.sql | MEDIUM |
| 15 | `workflows` | 2026_05_29_phase8_autonomous_operations.sql | LOW |

---

## MISSING COLUMNS ON `tasks` TABLE (20)

| # | Column | Migration Source | Priority |
|---|---|---|---|
| 1 | `submitted_by` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 2 | `checked_by` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 3 | `rejected_at` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 4 | `rejected_by` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 5 | `rejection_reason` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 6 | `accepted_workflow_by` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 7 | `reviewer_result` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 8 | `reviewer_result_at` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 9 | `approver_result` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 10 | `approver_result_at` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 11 | `reviewer_due_date` | 2026_06_16_reviewer_due_date.sql | HIGH |
| 12 | `reviewer_assigned_at` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 13 | `reviewed_at` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 14 | `review_instructions` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 15 | `review_checklist` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 16 | `required_evidence` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 17 | `required_files` | 2026_06_02_task_approval_workflow.sql | HIGH |
| 18 | `task_category` | 2026_05_29_task_bill_finance_upgrade.sql | MEDIUM |
| 19 | `bill_id` | 2026_05_29_task_bill_finance_upgrade.sql | MEDIUM |
| 20 | `direct_store_id` | 2026_05_29_task_workflow_upgrade.sql | MEDIUM |

---

## MISSING MIGRATIONS (Apply in Order)

Execute the following migration files in chronological order to resolve all drift:

```
1.  2026_04_27_penalty_system.sql
2.  2026_05_09_penalty_system.sql
3.  2026_05_29_phase8_autonomous_operations.sql
4.  2026_05_29_phase11_modules.sql
5.  2026_05_29_task_bill_finance_upgrade.sql
6.  2026_05_29_task_workflow_upgrade.sql
7.  2026_06_02_release_governance.sql
8.  2026_06_02_task_approval_workflow.sql
9.  2026_06_04_obligation_registry.sql
10. 2026_06_10_duplicate_control.sql
11. 2026_06_11_phase13_penalty_accountability.sql
12. 2026_06_15_remember_tokens.sql
13. 2026_06_16_deduplicate_bills.sql
14. 2026_06_16_reviewer_due_date.sql
```

---

## VERDICT

**❌ FAIL — Schema drift detected**

15 missing tables and 20 missing columns must be resolved before Mobile Certification can resume.

**Next step:** Execute missing migrations → Re-run verify-schema.php → Must return PASS (0 missing tables, 0 missing columns).