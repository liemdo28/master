# PHASE 13.8A — SCHEMA DIFF REPORT

**Date:** 2026-06-17  
**Scope:** Production (`dashboard.bakudanramen.com`), Preview (`preview.dashboard.bakudanramen.com`), Local (`taskflow_db`)  
**Method:** Static analysis of 51 SQL migration files + 12 SQL schema files + all PHP model/service SQL references  
**PHP Binary:** `C:\xampp\php\php.exe` — NOT AVAILABLE on this Windows machine (see note below)

---

## PHP BINARY STATUS

`C:\xampp\php\php.exe` does not exist on this machine.  
All schema analysis below is **static (code-based)** — no live database connections were possible.  
**Action required:** Run `scripts/verify-schema.php` on a machine with PHP + database access.

---

## EXPECTED SCHEMA (after all 51 migrations)

### Tables Required by Code (97 tables total)

The following tables are referenced in PHP models/services/controllers via SQL queries and MUST exist:

#### Tier 1 — CRITICAL (breaks every page if missing)

| Table | Defined In | Columns (key) |
|-------|-----------|---------------|
| `users` | `sql/schema.sql` | id, name, email, password, role, is_active, store_id, avatar, preferred_language, timezone, notification_settings, email_notifications |
| `tasks` | `sql/schema.sql` + 15 ALTERs | id, project_id, section_id, title, description, assignee_id, priority, status, visibility, private_by_user_id, due_date, start_date, is_completed, completed_at, task_category, bill_id, direct_store_id, submitted_at, submitted_by, checked_at, checked_by, accepted_workflow_at, accepted_workflow_by, final_done_at, rejected_at, rejected_by, rejection_reason, approval_required, reviewer_id, approver_id, review_note, review_instructions, review_checklist, required_evidence, required_files, reviewer_result, reviewer_result_note, reviewer_result_at, approver_result, approver_result_note, approver_result_at, recurring_root_id, occurrence_index, reschedule_count, repeat_type, repeat_config, repeat_from_mode, repeat_end_type, repeat_end_date, repeat_end_count, estimated_time, parent_task_id, position, created_by, created_at, updated_at, reviewed_at |
| `stores` | `database/migrations/2026_03_05_tracking_bills.sql` | id, name, address, color, is_active, created_at, business_id, type, region_id, district_id, store_code, phone, email, manager_id |
| `bills` | `database/migrations/2026_03_05_tracking_bills.sql` | id, store_id, title, vendor, amount, due_date, status, note, color, created_by, reminded_at, is_recurring, recurrence_type, recurrence_config, created_at |
| `notifications` | `sql/schema_v2.sql` | id, user_id, title, body, type, is_read, link, sender_id, created_at |
| `task_stores` | `database/migrations/2026_03_05_tracking_bills.sql` | id, task_id, store_id |

#### Tier 2 — HIGH (breaks specific features)

| Table | Defined In | Purpose |
|-------|-----------|---------|
| `projects` | `sql/schema.sql` | Project management |
| `project_members` | `sql/schema.sql` | Project access control |
| `sections` | `sql/schema.sql` | Task grouping |
| `comments` | `sql/schema.sql` | Task comments |
| `attachments` | `sql/schema.sql` | File uploads |
| `activity_log` | `sql/schema.sql` | Audit trail |
| `releases` | `database/migrations/2026_05_29_release_management.sql` | Release management |
| `release_drafts` | `database/migrations/2026_06_02_release_governance.sql` | Release drafts |
| `release_versions` | `database/migrations/2026_06_02_release_governance.sql` | Release versions |
| `release_approvals` | `database/migrations/2026_06_02_release_governance.sql` | Release approvals |
| `release_schedule` | `database/migrations/2026_06_02_release_governance.sql` | Release schedule |
| `release_artifacts` | `database/migrations/2026_06_02_release_governance.sql` | Release artifacts |
| `task_notifications` | `database/migrations/2026_06_11_task_notifications_inbox_category.sql` | Inbox items |
| `penalties` | `database/migrations/2026_04_27_penalty_system.sql` | Penalty config |
| `penalty_assessments` | `database/migrations/2026_05_09_penalty_system.sql` | Penalty assessments |
| `task_approval_events` | `database/migrations/2026_06_02_task_approval_workflow.sql` | Approval workflow |
| `task_reviewer_notes` | `database/migrations/2026_06_02_reviewer_workspace.sql` | Reviewer notes |
| `task_approval_notes` | `database/migrations/2026_06_02_reviewer_workspace.sql` | Approval notes |
| `remember_tokens` | `database/migrations/2026_06_15_remember_tokens.sql` | Remember me |
| `obligations` | `database/migrations/2026_06_04_obligation_registry.sql` | Financial obligations |
| `obligation_payments` | `database/migrations/2026_06_04_obligation_registry.sql` | Payment tracking |
| `obligation_tasks` | `database/migrations/2026_06_04_obligation_registry.sql` | Task linkage |
| `duplicate_task_flags` | `database/migrations/2026_06_10_duplicate_control.sql` | Duplicate detection |
| `duplicate_bill_flags` | `database/migrations/2026_06_10_duplicate_control.sql` | Bill duplication |
| `deadline_extensions` | `database/migrations/deadline_extensions.sql` | Extension requests |

#### Tier 3 — MEDIUM

| Table | Purpose |
|-------|---------|
| `store_checklists` | Daily store checklists |
| `training_modules` | Training library |
| `training_progress` | Training completions |
| `employees` | Employee records |
| `shifts` | Shift scheduling |
| `incidents` | Incident tracking |
| `vendors` | Vendor management |
| `vendor_attachments` | Vendor files |
| `workflows` | Automation workflows |
| `api_tokens` | Mobile API tokens |
| `rate_limits` | API rate limiting |
| `email_queue` | Email sending queue |
| `email_logs` | Email history |
| `telegram_link` | Telegram integration |
| `telegram_link_token` | Telegram auth |
| `telegram_preferences` | Telegram settings |
| `telegram_message_log` | Telegram logs |
| `autonomy_log` | Autonomy engine audit |

---

## MIGRATION FILES INVENTORY

| File | Tables Affected | Status |
|------|----------------|--------|
| `sql/schema.sql` | users, projects, sections, tasks, comments, attachments, activity_log | v1 baseline |
| `sql/schema_v2.sql` | notifications, email_queue, email_logs | v2 |
| `2026_03_05_tracking_bills.sql` | stores, bills, task_stores | Core finance |
| `2026_03_06_bill_upgrades.sql` | bills (ALTER) | Bill columns |
| `2026_04_08_task_overhaul.sql` | tasks (ALTER) | Task overhaul |
| `2026_04_12_role_rename.sql` | users (ALTER) | Role enum |
| `2026_04_12_task_schema_columns.sql` | tasks (ALTER) | Extra columns |
| `2026_04_27_penalty_system.sql` | penalties, penalty_assessments | Penalty v1 |
| `2026_05_09_penalty_system.sql` | penalty_assessments (ALTER) | Penalty v2 |
| `2026_05_29_phase8_autonomous_operations.sql` | store_checklists, shifts, employees, etc. | Operations |
| `2026_05_29_release_management.sql` | releases | Release v1 |
| `2026_05_29_release_management_v2.sql` | releases (ALTER) | Release v2 |
| `2026_05_29_franchise_platform.sql` | franchises, regions, districts, stores (ALTER) | Franchise |
| `2026_06_02_p0_task_detail_schema_sync.sql` | tasks (ALTER 15 cols) | Approval workflow |
| `2026_06_02_task_approval_workflow.sql` | task_approval_events | Approval log |
| `2026_06_02_reviewer_workspace.sql` | task_reviewer_notes, task_approval_notes | Reviewer |
| `2026_06_02_release_governance.sql` | release_drafts, release_versions, release_approvals, release_schedule, release_artifacts | Governance |
| `2026_06_02_preview_missing_columns.sql` | tasks (ALTER) | Preview fix |
| `2026_06_04_obligation_registry.sql` | obligations, obligation_payments, obligation_tasks | Obligations |
| `2026_06_10_duplicate_control.sql` | duplicate_task_flags, duplicate_bill_flags | Dedup |
| `2026_06_10_bill_registry_upgrade.sql` | bills (ALTER) | Bill upgrade |
| `2026_06_11_phase13_penalty_accountability.sql` | penalties (ALTER), penalty_assessments (ALTER) | Penalty v3 |
| `2026_06_11_task_notifications_inbox_category.sql` | task_notifications (ALTER) | Inbox |
| `2026_06_12_dashboard_requirements.sql` | Various | Dashboard |
| `2026_06_15_remember_tokens.sql` | remember_tokens | Auth |
| `2026_06_16_deduplicate_bills.sql` | bills (ALTER) | Bill dedup |
| `2026_06_16_reviewer_due_date.sql` | tasks (ALTER) | Reviewer dates |
| `2026_06_03_approver_id_column.sql` | tasks (ALTER) | Approver |
| `2026_06_04_asana_my_tasks_sync.sql` | asana_sync_config | Asana |
| `2026_06_10_assignment_flow_fix.sql` | tasks (ALTER) | Assignment |
| `2026_06_10_p0_missing_reviewer_tables.sql` | Various | P0 fix |
| `database/migrations/2026_05_28_foreign_keys_indexes.sql` | Various (FK) | FK cleanup |
| `database/migrations/2026_05_28_recurrence_completion_mode.sql` | tasks (ALTER) | Recurrence |
| `database/migrations/2026_05_29_phase11_5_adoption_layer.sql` | adoption_metrics, store_playbooks | Phase 11.5 |
| `database/migrations/2026_05_29_phase11_6_adoption_analytics.sql` | adoption_analytics | Phase 11.6 |
| `database/migrations/2026_05_29_phase11_modules.sql` | phase11_modules | Phase 11 modules |
| `database/migrations/2026_05_29_phase11_seed.sql` | Seed data | Phase 11 seed |
| `database/migrations/2026_05_29_task_bill_finance_upgrade.sql` | tasks (ALTER), bills (ALTER) | Finance |
| `database/migrations/2026_05_29_task_workflow_upgrade.sql` | tasks (ALTER) | Workflow |
| `database/migrations/2026_05_30_phase12_stabilization.sql` | Various | Phase 12 |
| `database/migrations/2026_06_02_credentials_fix.sql` | credentials | Credentials |
| `database/migrations/2026_06_02_preview_section_repair.sql` | sections (repair) | Preview fix |
| `database/migrations/2026_06_03_approver_id_column.sql` | tasks (ALTER) | Approver |
| `database/migrations/2026_04_13_finance_taskflow_upgrade.sql` | finance tables | Finance |
| `database/migrations/2026_04_22_cleanup_test_data.sql` | DELETE cleanup | Cleanup |
| `database/migrations/deadline_extensions.sql` | deadline_extensions | Extensions |
| `database/migrations/email_logs.sql` | email_logs | Email |
| `database/migrations/email_queue.sql` | email_queue | Email |
| `database/migrations/phase3_intelligence.sql` | intelligence tables | Intelligence |
| `database/migrations/phase11_store_checklists.sql` | store_checklists | Checklists |
| `database/migrations/telegram.sql` | telegram tables | Telegram |
| `database/migrations/telegram_context.sql` | telegram_context | Telegram |

---

## ENVIRONMENT INVENTORY

| Aspect | Production | Preview | Local |
|--------|-----------|---------|-------|
| DB_HOST | mysql-taskflow.bakudanramen.com | (from .env.preview) | localhost (XAMPP) |
| DB_NAME | taskflow_db | bakudan_preview | taskflow_db |
| DB_USER | liemdo | (from .env.preview) | root |
| DB_PASS | (from .env — MISSING per logs!) | (from .env.preview) | '' |
| PHP Binary | Server PHP | Server PHP | `C:\xampp\php\php.exe` — NOT FOUND |
| Env file | `.env` | `.env.preview` | `.env` or none |

**NOTE:** `.env` file does NOT exist in the local project directory (confirmed via `dir .env` → "File Not Found").  
PHP CLI binary is NOT available on this Windows machine at `C:\xampp\php\php.exe`.

---

## RECOMMENDATIONS

1. **Immediate:** Restore PHP binary path, or provide `php.exe` location for CLI checks
2. **Immediate:** Create `.env` from `.env.example` with correct `DB_PASS`
3. **Immediate:** Run `migrate.php` against `taskflow_db` to bring schema current
4. **Immediate:** Run `migrate.php` against `bakudan_preview` to bring preview schema current
5. **Once PHP is available:** Run `scripts/verify-schema.php` to get live diff

---

*Generated by static code analysis. Live database verification requires PHP + DB credentials.*
