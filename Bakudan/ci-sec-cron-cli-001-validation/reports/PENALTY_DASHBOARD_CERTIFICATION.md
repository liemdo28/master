# Penalty Dashboard Certification
**Phase 13.4 — Accountability System**
**Date: 2026-06-11**

---

## Dashboards Delivered

### 1. User: My Penalties (`/penalties`)

**Route:** `GET /penalties`
**Controller:** `PenaltyController::userMyPenalties()`
**View:** `views/penalties/my_penalties.php`
**Access:** All authenticated users

**Shows:**
- [x] Current points — 30 day / 90 day / 12 month accumulated fines
- [x] Open penalties — currently late tasks with per-task fine amount
- [x] Resolved penalties — completed-late tasks from penalty_log
- [x] Penalty history — full log with task links
- [x] Appeals — own appeal status with admin note
- [x] Appeal form — submit new appeal per penalty_log entry

---

### 2. Admin: Penalty Dashboard (`/admin/penalties`)

**Route:** `GET /admin/penalties`
**Controller:** `PenaltyController::adminDashboard()`
**View:** `views/admin/penalties/index.php` (pre-existing, now wired)
**Access:** Admin only

**Shows:**
- [x] KPI strip: today / this week / this month penalty counts + top offender
- [x] Config panel: current penalty_amount and currency (editable)
- [x] Filter bar: period, date range, user filter
- [x] Penalty log tab: paginated list with user, store, project, task, overdue days, amount, reason
- [x] By user tab: aggregated counts, totals, max overdue, risk score bar
- [x] By project tab: aggregated counts and totals per project
- [x] By store tab: aggregated counts, totals, execution health label
- [x] Pending appeals count

---

### 3. Admin: Penalty Rules (`/admin/penalty-rules`)

**Route:** `GET /admin/penalty-rules`
**Controller:** `PenaltyController::adminRulesIndex()`
**View:** `views/admin/penalty_rules.php`
**Access:** Admin only

**Shows:**
- [x] All configured rules: name, type, suggested amount, currency, effective date, status
- [x] Add rule form (modal)
- [x] Edit rule (inline modal)
- [x] Enable/disable toggle per rule
- [x] Notice: "No penalty applied automatically — admin must act explicitly"

**Seeded sample rules (inactive by default except Task Overdue):**
- Task Overdue — 500,000 VND — Active
- Verification Missed — 500,000 VND — Inactive
- Checklist Missed — 500,000 VND — Inactive

---

### 4. Manager: Team Penalties (`/manager/penalties`)

**Route:** `GET /manager/penalties`
**Controller:** `PenaltyController::managerDashboard()`
**View:** `views/manager/penalties.php`
**Access:** Manager, Admin, CEO

**Shows:**
- [x] Store summary cards (penalty count + total fine + member count)
- [x] Member penalties table: name, store, count, total, max overdue, coaching flag
- [x] Coaching flag: triggered when member has 2+ penalties or 7+ days overdue
- [x] Open appeals from team (read-only, with context)

---

### 5. CEO: Accountability Dashboard (`/ceo/accountability`)

**Route:** `GET /ceo/accountability`
**Controller:** `AccountabilityController::index()`
**View:** `views/ceo/accountability.php`
**Access:** CEO, Admin (read-only)

**Shows:**
- [x] Accountability score (0–100) with visual indicator
- [x] Score label: Excellent / Needs Attention / Critical
- [x] Penalized users (30d) and total active users
- [x] 6-month trend bar chart with monthly totals
- [x] High risk users (3+ penalties in 90 days)
- [x] High risk stores (3+ penalties in 90 days)
- [x] Repeated violations with coaching recommendation
- [x] Active penalty rules (read-only view)
- [x] Read-only badge prominently displayed

---

## Sample Data Policy

No production user penalties were inserted automatically.

Sample data created:
- 3 penalty rule seeds (admin can edit amounts, effective dates, activate/deactivate)
- No `penalty_config` rows created (user enrollment requires explicit admin action)
- No `penalty_log` rows created

**Compliance:** Meets CEO directive "No production user receives penalty without admin action."
