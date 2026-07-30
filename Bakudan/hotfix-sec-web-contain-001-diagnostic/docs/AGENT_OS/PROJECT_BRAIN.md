# PROJECT BRAIN — Dashboard.bakudanramen.com
**Single source of truth for the Bakudan Dashboard project.**
*Last updated: 2026-06-04 (auto-generated from live deployment + git + DB)*

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| **Name** | Bakudan Dashboard (TaskFlow) |
| **Slug** | `dashboard.bakudanramen.com` |
| **Path** | `E:\Project\Master\Bakudan\dashboard.bakudanramen.com` |
| **Repo** | `https://github.com/liemdo28/dashboard.bakudanramen.com.git` |
| **Remote** | `dreamhost: ssh://liemdo0208@pdx1-shared-a3-05.dreamhost.com/home/liemdo0208/repo/dashboard.git` |
| **Branch** | `main` |
| **Owner** | `liemdo0208` (CEO, Bakudan Group) |
| **Backup Owner** | `liemdo28` (GitHub) |
| **Purpose** | Task + project + workflow + compliance + payment execution platform for 4 Bakudan locations (Raw Stockton, Bakudan Bandera, Stone Oak, Rim) and Bakudan HQ. |
| **Tagline** | "Work execution system, not just a reporting dashboard." |

---

## 2. Tech Stack

| Layer | Technology | Version | Source |
|-------|-----------|---------|--------|
| Runtime | PHP | 8.3.30 (server), 8.0+ required | `config/database.php`, `REQUIRED_PHP_VERSION` |
| DB | MySQL | 5.7+ required (utf8mb4, JSON, window funcs) | `REQUIRED_MYSQL_VERSION` |
| Server | Apache + mod_rewrite | Production: Dreamhost shared | `.htaccess` |
| Frontend | Vanilla JS + system fonts, no SPA | Latest | `assets/js/*` |
| CSS | Custom CSS (no Tailwind/Bootstrap for core) | Latest | `assets/css/*` |
| Auth | Session-based for web UI; Bearer token for `/api/v1/*` | PHP session + `api_bootstrap.php` | `index.php` L462–487 |
| Notifications | In-app + Email (SMTP) + Telegram bot | Production | `service/EmailService.php`, `TelegramBotService` |
| Cron | Endpoint-style cron (`/api/email/jobs/*`, `/api/telegram/jobs/*`) | Production | `jobs/*` |
| JS Test | Playwright | Latest | `qa/playwright/*` |
| PHP Lint | PowerShell `php-lint.ps1` | — | `scripts/php-lint.ps1` |
| Deploy | Shell script (preview + production) | Manual | `deploy_preview.php`, `deploy.php` |

---

## 3. URLs

| Env | URL | Purpose | Auth |
|-----|-----|---------|------|
| Production | `https://dashboard.bakudanramen.com` | CEO + staff daily work | Session |
| Preview | `https://preview.dashboard.bakudanramen.com` | Staging / QA / Agent OS preview | Session (QA bypass enabled) |
| Health (prod) | `https://dashboard.bakudanramen.com/api/health` | Admin-only health check | Session + admin |
| Health (preview) | `https://preview.dashboard.bakudanramen.com/preview_db_health.php?token=PREVIEW_HEALTH_2026` | Public health check | Token |

---

## 4. Health Snapshot (live)

> Updated 2026-06-04 16:11 (Asia/Saogon, UTC+7)

| Metric | Value | Source |
|--------|-------|--------|
| Head commit | `391be7d` | `git rev-parse HEAD` (live) |
| Build | PASS | `scripts/php-lint.ps1` |
| SQLSTATE errors (last 24h) | 0 | `logs/errors/php-errors.log` |
| PHP Fatals (last 24h) | 0 | `logs/errors/php-errors.log` |
| Playwright last run | 13/13 green (Phase 0) | `qa/artifacts/2026-06-04/` |
| Preview deploy status | DEPLOY_OK | `deploy_preview.php?key=preview-deploy-2026` |
| Phase 1 API smoke | ALL PASS (exit 0) | `scripts/smoke-workflow-api.php` |
| RBAC user accounts | 3/3 PASS | `diag.php?key=diag-2026` |
| Known security guard | `config/safety-guard.php` | active |

**Overall Health:** 🟢 GREEN — all known systems operational.

---

## 5. Module Map

| Module | Code | Routes | Phase |
|--------|------|--------|-------|
| **Auth** | `controllers/AuthController.php` | `/login`, `/register`, `/logout`, `/admin/users/*` | 0 |
| **Dashboard** | `controllers/DashboardController.php` | `/dashboard`, `/my-tasks`, `/overview`, `/calendar`, **`/command-center`** (Phase 1) | 0/1 |
| **Tasks** | `controllers/TaskController.php` | `/tasks/*` (CRUD, accept, move, duplicate, reschedule) | 0 |
| **Task Approval** | `controllers/TaskApprovalController.php` | `/tasks/{id}/submit|review-approve|accept` | 0 |
| **Projects** | `controllers/ProjectController.php` | `/projects/*` (CRUD + members + sections) | 0 |
| **Bills** | `controllers/BillController.php` | `/bills/*` (recurring obligations, payments) | 3 |
| **Obligations** | `controllers/ObligationController.php`, `service/ObligationService.php` | Recurring rent/utilities/insurance/tax/TABC | 3 |
| **Workflow Execution** | `controllers/WorkflowExecutionApiController.php` | **`/api/workflow/*`** (4 queues + command-center) | **1** |
| **Reviewer Notes** | `controllers/ReviewerNotesController.php` | `/tasks/{id}/reviewer-notes/*`, `request-changes`, `request-info` | 0/2 |
| **Approval Notes** | `controllers/ApprovalNoteController.php` | `/tasks/{id}/approval-notes` | 0/2 |
| **Inbox** | `controllers/InboxController.php` | `/inbox`, `/api/inbox/*` | 0 |
| **Task Comments** | `controllers/TaskCommentController.php` | `/tasks/{id}/task-comments`, `mention-search` | 0 |
| **Telegram** | `controllers/TelegramController.php` | `/webhook/telegram`, `/telegram/*` | 0 |
| **Email** | `service/EmailService.php`, `service/EmailQueueService.php` | `/api/email/jobs/*` | 0 |
| **Command Center (P8)** | `controllers/CommandCenterController.php` | `/admin/command-center/*` (predictions, recs, workflows) | 8 |
| **Phase 11 Ops** | `controllers/OperationsController.php`, `MyDayController.php`, `ActionCenterController.php` | `/operations/today`, `/my-day`, `/action-center` | 11 |
| **Control Tower** | `controllers/ControlTowerController.php` | `/control-tower` | 11 |
| **Franchise** | `controllers/FranchiseController.php` | `/admin/org-chart`, `/ceo/scorecard`, `/admin/benchmarks`, `/admin/goals`, `/admin/budget` | 7 |
| **Release Mgmt** | `controllers/ReleaseController.php`, `ReleaseArtifactsController.php` | `/admin/releases/*`, `/release/review/{hash}` | 11 |
| **Cred Vault** | `controllers/CredentialController.php` | `/security/credentials*` | 14 |
| **Health Monitor** | `controllers/HealthMonitorController.php` | `/health`, `/api/health/status` | 11 |

---

## 6. Data Tables (key)

| Table | Purpose | Rows (live) |
|-------|---------|------------|
| `users` | User accounts (role enum: ceo/admin/manager/staff) | ~12 |
| `projects` | Projects per store | live |
| `tasks` | Tasks (is_completed, due_date, status, repeat_type, reviewer_id, approver_id) | live |
| `comments` | Task comments | live |
| `bills` | Bill entries (rent, utilities, etc.) | live |
| `obligations` | Recurring obligations (Phase 3 source of truth) | live |
| `stores` | Bakudan + Raw locations (4 stores) | 4 |
| `vendors` | Vendor list | live |
| `invoices` | Invoice tracking | live |
| `task_approval_events` | Audit trail of approval workflow | live |
| `release_artifacts` | Phase 11 release artifacts | live |
| `credentials` | Encrypted credential vault (Phase 14) | live |

---

## 7. Phase Roadmap

| Phase | Status | Deliverable | Commit/Evidence |
|-------|--------|-------------|-----------------|
| 0 — Stabilization | ✅ DONE | `docs/PHASE_0_QA_REPORT.md` (13/13 green) | `933c0fad` |
| 1 — Workflow Execution | ✅ DONE | `PHASE_1_WORKFLOW_EXECUTION.md`, `/api/workflow/*`, `/command-center` | `8414bb3` |
| **AGENT OS / 1 — Project Brain** | 🔄 IN PROGRESS | **`PROJECT_BRAIN.md` (this file) + Risk + Deploy Map** | TBD |
| **AGENT OS / 4 — Cline Bridge** | 🔄 IN PROGRESS | `CLINE_BRIDGE.md` + `CLINE_ACTION_LOG.json` + QA automation report | TBD |
| **AGENT OS / 7 — CEO Dashboard** | 🔄 IN PROGRESS | `CEO_DASHBOARD.md` + widget spec + health scoring + `/ceo-dashboard` page | TBD |
| 2 — Reviewer & Approver Workspace | ⏳ PENDING | `PHASE_2_REVIEWER_APPROVER_WORKSPACE.md` | — |
| 3 — Compliance & Payment Ops | ⏳ PARTIAL (Obligations table exists) | `PHASE_3_COMPLIANCE_ENGINE.md` | — |
| 5 — Enterprise Hardening | ⏳ PENDING (users provisioned; matrix documented) | `PHASE_5_ENTERPRISE_HARDENING.md` | — |
| 6 — AI & Automation | ⏳ PENDING | `PHASE_6_AI_AUTOMATION.md` | — |

---

## 8. Quick Answers (CEO shortcuts)

> **"What is Dashboard?"**
> The Bakudan Group's work execution system for 4 stores (Raw Stockton, Bakudan Bandera, Stone Oak, Rim). Task management, reviewer/approver workflow, recurring obligations (rent/utilities/insurance/tax), email + Telegram notifications, all behind session auth.

> **"Who owns Dashboard?"**
> `liemdo0208` (CEO, Bakudan Group) on Dreamhost production. Backup owner: `liemdo28` on GitHub.

> **"What is the deployment path?"**
> 1. Commit to `main` → 2. `git push origin main` → 3. `curl /deploy_preview.php?key=preview-deploy-2026` → 4. Run `validate_preview_workflow.php` → 5. Run `deploy.php` for production.

> **"What is the current risk?"**
> See `PROJECT_RISK_REGISTER.md` — top risks: (a) `'member'` role not in enum (Phase 5 migration needed), (b) `models/User.php` shadows `password_verify()` in `rbac-validate.php` (use `diag.php`), (c) Preview DB may lag schema (use `repair_preview.php` + `preview_db_health.php`).

> **"What should we fix first?"**
> See `PROJECT_RISK_REGISTER.md` §3 — P0 items: (1) add `'member'` to role enum, (2) fix User.php `password_verify` shadow, (3) build Phase 2 reviewer workspace UI.

> **"What projects are risky?"**
> Single project (this one). Risk = low (🟢). See Risk Register §2.

> **"Run QA on Dashboard"**
> `cd /e/Project/Master/Bakudan/dashboard.bakudanramen.com && npm run qa` (or via Cline Bridge: `Run Playwright` action).
