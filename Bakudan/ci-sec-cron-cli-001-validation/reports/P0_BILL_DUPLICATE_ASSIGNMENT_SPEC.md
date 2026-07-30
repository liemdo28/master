# P0 — BILL SYSTEM + DUPLICATE CONTROL + TASK ASSIGNMENT FLOW
**Spec Version:** 2026-06-10  
**Priority:** P0 — Block all non-critical work until complete  
**Requestor:** CEO / Hoang Le  
**Codebase:** PHP custom MVC — `dashboard.bakudanramen.com`

---

## CURRENT STATE AUDIT (before this spec)

### Bills — What Exists
| Feature | Status | Location |
|---|---|---|
| `bills` table | ✅ exists | `migrations/2026_03_05_tracking_bills.sql` |
| Basic create/edit/pay | ✅ | `controllers/BillController.php` |
| Categories (10 types) | ✅ | ENUM: utilities, tax, insurance, rent, payroll, subscription, supplies, maintenance, banking, general |
| Evidence upload | ✅ | `POST /bills/{id}/upload` |
| Mark paid / record payment | ✅ | `POST /bills/{id}/pay`, `POST /bills/{id}/paid` |
| `workflow_status` column | ✅ | migration `2026_05_29` |
| Workflow stages (submitted/checked/accepted/rejected) | ✅ | columns exist on `bills` |
| Checker / Approver / Verifier fields | ❌ MISSING | Not in schema |
| `responsible_user_id` | ❌ MISSING | Not in schema |
| `payment_method` | ❌ MISSING | Not in schema |
| `frequency` / `next_due_date` / `last_paid_date` | ❌ MISSING | Not in schema |
| `bill_categories` admin table | ❌ MISSING | Category is hardcoded ENUM |
| `bill_verification_steps` | ❌ MISSING | |
| `bill_history` audit log | ❌ MISSING | |

### Duplicate Detection — What Exists
| Feature | Status | Location |
|---|---|---|
| `task_duplicate_audit` table | ✅ exists | migration `2026_05_29` |
| `duplicate_hash` / `archived_duplicate` / `merged_into_task_id` on tasks | ❌ MISSING | Not added |
| Pre-create duplicate check (modal) | ❌ MISSING | No UI/API guard |
| Daily scanner cron | ❌ MISSING | |
| `/admin/duplicates` page | ❌ MISSING | |
| Bill duplicate detection | ❌ MISSING | `task_duplicate_audit` is tasks only |

### Assignment Flow — What Exists
| Feature | Status | Location |
|---|---|---|
| Task assignee | ✅ `assignee_id` on tasks | `models/Task.php` |
| Accept/reject task assignment | ✅ (but blocks task appearing) | `accepted_at` column |
| Popup notification on assignment | ❌ MISSING | Not implemented |
| Task auto-appears in assignee list without accept | ❌ MISSING | Currently requires acceptance |

---

## PART 1 — BILL/PAYMENT REGISTRY SCHEMA UPGRADE

### New columns needed on `bills` table
```sql
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS responsible_user_id  INT NULL,
  ADD COLUMN IF NOT EXISTS checker_user_id      INT NULL,
  ADD COLUMN IF NOT EXISTS approver_user_id     INT NULL,
  ADD COLUMN IF NOT EXISTS verifier_user_id     INT NULL,
  ADD COLUMN IF NOT EXISTS payment_method       ENUM('bank_transfer','check','credit_card','ach','wire','wells_fargo','other') NULL,
  ADD COLUMN IF NOT EXISTS frequency            ENUM('once','weekly','biweekly','monthly','quarterly','annual') NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS last_paid_date       DATE NULL,
  ADD COLUMN IF NOT EXISTS next_due_date        DATE NULL,
  ADD COLUMN IF NOT EXISTS notes                TEXT NULL,
  ADD COLUMN IF NOT EXISTS is_archived          TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at          DATETIME NULL,
  ADD COLUMN IF NOT EXISTS archived_reason      VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS duplicate_of_bill_id INT NULL,
  ADD COLUMN IF NOT EXISTS duplicate_hash       VARCHAR(64) NULL,
  ADD FOREIGN KEY (responsible_user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD FOREIGN KEY (checker_user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD FOREIGN KEY (approver_user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD FOREIGN KEY (verifier_user_id) REFERENCES users(id) ON DELETE SET NULL;
```

### Required bill fields (full model)
```
bill_name            VARCHAR(255) NOT NULL
category             FK → bill_categories.id
store_id             FK → stores.id
vendor               VARCHAR(255)
amount               DECIMAL(12,2)
due_date             DATE
frequency            ENUM(once/weekly/biweekly/monthly/quarterly/annual)
payment_method       ENUM(...)
responsible_user_id  FK → users.id   ← who pays
checker_user_id      FK → users.id   ← who checks payment
approver_user_id     FK → users.id   ← who approves before payment
verifier_user_id     FK → users.id   ← who confirms money out
status               ENUM(pending/submitted/checked/approved/paid/verified/completed/cancelled/archived)
workflow_status      (existing)
notes                TEXT
last_paid_date       DATE
next_due_date        DATE
duplicate_hash       VARCHAR(64)     ← for dedup
is_archived          TINYINT(1)
```

### CEO's known bill categories (seed data)
```
Rent:
  - Restaurant rent (store-specific)
  - Building / landlord payment (e.g., "Joule Park West Rent")
  - Payment route: Wells Fargo personal → vendor transfer

Utility:
  - PG&E (gas+electricity)
  - CPS (water/waste)
  - Waste management
  - Water
  - Electricity
  - Gas

Tax:
  - Sales Tax (monthly, CDTFA)
  - Raw Sales Tax
  - Payroll Tax (quarterly)
  - Quarterly Filing
  - Annual Filing
  - T-ABC Alcohol Beverage Filing (per store with liquor)

Insurance:
  - Business Insurance
  - Workers' Comp Insurance
  - Umbrella Insurance
  - EPLI (Employment Practices Liability)

Company Credit Card:
  - Company credit card payment
  - Statement payment
  - Due date tracking (no late fees)

Vendor / Platform:
  - QuickBooks subscription
  - Software subscriptions
  - Service vendors (cleaning, POS, etc.)

Payroll:
  - Staff payroll
  - Payroll processing fee

Compliance:
  - Health permit renewal
  - Business license renewal
  - Alcohol license (ABC)

Other:
  - Miscellaneous
```

---

## PART 2 — BILL_CATEGORIES TABLE

Create `bill_categories` admin-managed table:

```sql
CREATE TABLE IF NOT EXISTS bill_categories (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  name                  VARCHAR(100) NOT NULL,
  slug                  VARCHAR(100) NOT NULL UNIQUE,
  default_frequency     ENUM('once','weekly','biweekly','monthly','quarterly','annual') DEFAULT 'monthly',
  default_reminder_days INT NOT NULL DEFAULT 7,
  requires_evidence     TINYINT(1) NOT NULL DEFAULT 0,
  verification_steps    JSON NULL,         -- array of step labels
  department            VARCHAR(100) NULL,
  penalty_rule          TEXT NULL,         -- e.g. "Late fee 10% + interest"
  is_active             TINYINT(1) NOT NULL DEFAULT 1,
  sort_order            INT NOT NULL DEFAULT 0,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Seed with CEO's categories above.  
Admin UI: `GET /admin/bill-categories` — CRUD.

---

## PART 3 — BILL WORKFLOW

### Standard Workflow (Rent, Utility, Insurance, Vendor, Credit Card)
```
Created → Assigned → Checked → Approved → Paid → Payment Verified → Completed
```

`workflow_status` ENUM (extend existing):
```
draft | assigned | checked | approved | paid | verified | completed | rejected | cancelled | archived
```

### Tax/Compliance Workflow
```
Created → Submitted (filing done) → Verified Submitted → Accepted (by agency) → Money Withdrawn Confirmed → Completed
```

`workflow_status` for tax flow:
```
draft | submitted | verified_submitted | accepted | money_withdrawn | completed
```

### API routes to add
```
POST /bills/{id}/workflow/submit       — mark submitted
POST /bills/{id}/workflow/verify       — checker marks verified
POST /bills/{id}/workflow/accept       — approver accepts
POST /bills/{id}/workflow/confirm-withdrawal  — verifier confirms money out
POST /bills/{id}/workflow/complete     — mark completed
POST /bills/{id}/workflow/reject       — reject with reason
```

Each transition: log to `bill_history` table.

---

## PART 4 — BILL FROM IMAGE/EMAIL/WHATSAPP

### What to build NOW (no OCR yet)
- Add attachment to bill at creation (not just after creation)
- Create form section: "Upload evidence / receipt / screenshot"
- Accept: jpg, png, pdf, webp (max 20MB)
- Store in `/uploads/bills/{bill_id}/`
- Show thumbnail grid on bill detail page
- Label field: "Type" — Receipt / WhatsApp screenshot / Email / Invoice / Other

### `bill_evidence` table
```sql
CREATE TABLE IF NOT EXISTS bill_evidence (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bill_id      INT NOT NULL,
  uploader_id  INT NOT NULL,
  file_path    VARCHAR(500) NOT NULL,
  file_name    VARCHAR(255) NOT NULL,
  file_type    VARCHAR(50) NULL,             -- receipt/whatsapp/email/invoice/other
  mime_type    VARCHAR(100) NULL,
  file_size    INT NULL,
  label        VARCHAR(255) NULL,
  uploaded_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Note: `bill_attachments` may already exist — check and merge/reuse.

---

## PART 5 — DUPLICATE DETECTION (pre-create guard)

### Duplicate hash algorithm
Before INSERT on tasks or bills, compute hash:

**For bills:**
```php
$hash = md5(implode('|', [
    strtolower(trim($title)),
    (int)$store_id,
    $due_date,                // Y-m-d
    (int)round($amount),      // rounded to nearest dollar
    strtolower(trim($vendor ?? '')),
    strtolower($category ?? ''),
]));
```

**For tasks:**
```php
$hash = md5(implode('|', [
    strtolower(trim($title)),
    (int)$store_id,
    $due_date,
    (int)$assignee_id,
    strtolower($category ?? ''),
]));
```

### Pre-create check (API)
```
POST /api/bills/check-duplicate    { title, store_id, due_date, amount, vendor, category }
POST /api/tasks/check-duplicate    { title, store_id, due_date, assignee_id, category }

Response: { duplicate: bool, match: { id, title, store, due_date, status }, score: 0-100 }
```

### Frontend modal (JS)
When score >= 70, show modal before form submit:
```
┌─────────────────────────────────────────────┐
│  ⚠️ Possible Duplicate Found                 │
│                                             │
│  "Raw Sale Tax — Raw Stockton — Apr 20"     │
│  Status: overdue · $1,240.00               │
│                                             │
│  [ Open Existing ]  [ Merge Notes ]         │
│  [ Create Anyway ]  [ Cancel ]              │
└─────────────────────────────────────────────┘
```
- **Open Existing** → redirect to existing record  
- **Merge Notes** → open side-by-side merge UI  
- **Create Anyway** → submit with `force_create=1` flag  
- **Cancel** → dismiss  

Do NOT auto-create. Do NOT auto-reject.

---

## PART 6 — CLEAN EXISTING DUPLICATES

### Migration script logic (run once)
1. Compute `duplicate_hash` for all existing bills → `UPDATE bills SET duplicate_hash = MD5(...)`
2. Find groups where same hash appears >1 time
3. For each group: keep record with lowest `id` as canonical
4. Archive duplicates: `is_archived=1`, `archived_reason='auto_dedup_2026_06'`, `duplicate_of_bill_id={canonical_id}`
5. Merge: copy notes/evidence from duplicates to canonical
6. Log to `duplicate_resolution_log`
7. Same flow for tasks → `merged_into_task_id`, `archived_duplicate=1`

### Dashboard metrics must exclude archived
Any query counting bills/tasks must add: `AND is_archived = 0` (bills) / `AND archived_duplicate = 0` (tasks).

---

## PART 7 — DAILY DUPLICATE SCANNER

### Cron job: `DailyDuplicateTaskBillScanner`
Schedule: daily at 02:00  
File: `crons/DailyDuplicateTaskBillScanner.php`

Scan:
1. All active (non-archived, non-completed) bills → compute hash → find collisions
2. All incomplete tasks → compute hash → find collisions  
3. Recurring bill children with same title+store+amount in same month  
4. Insert new groups into `duplicate_groups` + `duplicate_group_items`  
5. Skip groups already in `duplicate_resolution_log` with status=ignored/merged  

### `duplicate_groups` + `duplicate_group_items` tables
```sql
CREATE TABLE IF NOT EXISTS duplicate_groups (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  entity_type     ENUM('bill','task','payment') NOT NULL,
  duplicate_hash  VARCHAR(64) NOT NULL,
  canonical_id    INT NULL,
  status          ENUM('pending','resolved','ignored') NOT NULL DEFAULT 'pending',
  detected_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at     DATETIME NULL,
  resolved_by     INT NULL,
  INDEX idx_dg_hash (duplicate_hash),
  INDEX idx_dg_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS duplicate_group_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  group_id    INT NOT NULL,
  entity_id   INT NOT NULL,
  is_canonical TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (group_id) REFERENCES duplicate_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS duplicate_resolution_log (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  group_id      INT NOT NULL,
  action        ENUM('archived','merged','ignored','marked_not_duplicate') NOT NULL,
  performed_by  INT NULL,
  notes         TEXT NULL,
  performed_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `/admin/duplicates` UI
Route: `GET /admin/duplicates`  
Shows table per entity_type, grouped:
| Original | Duplicate | Fields Matched | Action |
|---|---|---|---|
| Raw Sale Tax — Stockton | Raw Sale Tax — Stockton | title, store, date, amount | Open Original · Open Dup · Archive Dup · Merge Notes · Ignore · Not Duplicate |

---

## PART 8 — ASSIGNMENT FLOW FIX

### Problem
Currently `accepted_at IS NULL` blocks task from appearing in assignee's list.

### Fix
Remove the acceptance gate. Task appears in assignee's list immediately on assignment.  
Keep `accepted_at` column for audit but stop using it as a filter.

**Files to update:**
- `models/Task.php` — remove `AND accepted_at IS NOT NULL` from getByAssignee queries
- `controllers/TaskController.php` — remove accept/reject endpoints or keep as optional
- `views/tasks/` — remove "Accept Task" prompt

### Popup notification on assignment
When `assignee_id` is set (on create or update):
1. Insert into `task_notifications`:
```php
TaskNotification::create([
  'user_id'           => $assignee_id,
  'task_id'           => $task_id,
  'notification_type' => 'task_assigned',
  'inbox_category'    => 'task',
  'title'             => 'New Task Assigned',
  'message'           => "{$assigned_by_name} assigned you: {$task_title}",
  'from_user_id'      => $current_user_id,
  'metadata'          => json_encode([
    'store'      => $store_name,
    'due_date'   => $due_date,
    'priority'   => $priority,
    'assigned_by'=> $assigned_by_name,
  ]),
]);
```
2. Frontend: on dashboard load, check `GET /api/notifications/unread` → show popup for `task_assigned` type if created_at within last 5 min.

Popup UI:
```
┌────────────────────────────────────────┐
│  📋 New Task Assigned                  │
│                                        │
│  Title:   Review Menu Rollout          │
│  Store:   Bakudan Stockton             │
│  Due:     June 15, 2026                │
│  Priority: High                        │
│  Assigned by: Hoang Le                 │
│                                        │
│  [ View Task ]         [ Dismiss ]     │
└────────────────────────────────────────┘
```

---

## PART 9 — BILL DASHBOARD DRILL-DOWN

Every bill metric on Overview dashboard must link to source records.

### Routes
```
GET /overview/drilldown/overdue-bills          ← already exists (DrilldownController)
GET /overview/drilldown/finance-bills?risk=    ← already exists
GET /overview/drilldown/bills/category/{slug}  ← NEW — by category
GET /overview/drilldown/bills/store/{id}       ← NEW — by store
```

### Required columns on drill-down table
```
Bill Name | Category | Store | Vendor | Amount | Due Date | Overdue Days
Responsible | Checker | Approver | Payment Status | Evidence (📎 count) | Action
```

Action column:
- `View Bill →` → `/bills/{id}`
- `Mark Paid` button (quick action, CEO only)
- `Upload Evidence` → opens upload modal inline

---

## PART 10 — DATABASE SUMMARY

### Migrations to write
```
database/migrations/2026_06_10_bill_registry_upgrade.sql
  - ALTER bills: add responsible_user_id, checker_user_id, approver_user_id, verifier_user_id
  - ALTER bills: add payment_method, frequency, last_paid_date, next_due_date, notes
  - ALTER bills: add is_archived, archived_at, archived_reason, duplicate_of_bill_id, duplicate_hash
  - CREATE bill_categories
  - CREATE bill_evidence (or rename bill_attachments)
  - CREATE bill_history

database/migrations/2026_06_10_duplicate_control.sql
  - CREATE duplicate_groups
  - CREATE duplicate_group_items
  - CREATE duplicate_resolution_log
  - ALTER tasks: add duplicate_hash, archived_duplicate, merged_into_task_id, duplicate_reason
  - ALTER bills: duplicate columns (above)

database/migrations/2026_06_10_assignment_flow_fix.sql
  - Remove any NOT NULL constraint on tasks.accepted_at that gates visibility
  - Verify task_notifications table exists (already in 2026_06_02)
```

### task columns to add
```sql
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS duplicate_hash       VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS archived_duplicate   TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS merged_into_task_id  INT NULL,
  ADD COLUMN IF NOT EXISTS duplicate_reason     VARCHAR(255) NULL;
```

---

## PART 11 — REQUIRED REPORTS

Create these files in `reports/`:
```
reports/BILL_CATEGORY_AUDIT.md         — catalog all CEO's known bills by category, map to existing DB records
reports/BILL_PAYMENT_WORKFLOW_AUDIT.md — update existing file with new workflow stages
reports/DUPLICATE_TASK_AUDIT.md        — how many task duplicates exist, which were cleaned, rules for future
reports/DUPLICATE_BILL_AUDIT.md        — how many bill duplicates exist/cleaned
reports/DUPLICATE_CLEANUP_LOG.md       — every archived/merged record with reason
reports/ASSIGNMENT_FLOW_FIX.md         — before/after for accepted_at gate removal
reports/BILL_DASHBOARD_DRILLDOWN_QA.md — QA checklist: each bill metric → verify drill-down works
```

---

## IMPLEMENTATION ORDER (for dev)

### Phase A — Database (do first, unblocks everything)
1. `2026_06_10_bill_registry_upgrade.sql` — extend bills table
2. `2026_06_10_duplicate_control.sql` — duplicate tables + task columns
3. Seed `bill_categories` with CEO's 8 categories

### Phase B — Bill module fixes
4. Update `BillController::createBill()` and `updateBill()` to handle new fields
5. Update `views/bills/create.php` + `edit.php` — add responsible/checker/approver/verifier pickers
6. Update `views/bills/detail.php` — show workflow stage, evidence grid, user chain
7. Update `views/bills/create.php` — add attachment upload on creation form
8. `GET /admin/bill-categories` — CRUD for categories

### Phase C — Duplicate detection
9. `models/DuplicateDetector.php` — hash computation + scoring for bills and tasks
10. `POST /api/bills/check-duplicate` + `POST /api/tasks/check-duplicate`
11. JS modal on bill create form + task create form
12. One-time migration script to hash + archive existing duplicates

### Phase D — Daily scanner + admin UI
13. `crons/DailyDuplicateTaskBillScanner.php`
14. Register in cron system
15. `controllers/AdminDuplicatesController.php` + `views/admin/duplicates/index.php`

### Phase E — Assignment flow
16. Remove `accepted_at` gate from task queries in `Task.php`
17. Add notification insert in `TaskController` on assign
18. Frontend popup: `views/partials/task_assigned_popup.php`

### Phase F — Dashboard drill-down
19. Add new bill columns to existing `DrilldownController::overdueBills()` query
20. Add `/overview/drilldown/bills/category/{slug}` and `/bills/store/{id}` routes
21. Update `views/drilldown/overdue_bills.php` with new columns

---

## ACCEPTANCE CRITERIA CHECKLIST

```
Bills:
[ ] Rent bills exist in dashboard (all stores)
[ ] Utility bills exist (PG&E, CPS, Water, Waste)
[ ] Tax bills exist (Sales Tax, Payroll, T-ABC)
[ ] Insurance bills exist (Business, Workers Comp, Umbrella, EPLI)
[ ] Credit Card bills exist with due date tracking
[ ] Vendor/Platform bills exist (QuickBooks, subscriptions)
[ ] Each bill has: responsible / checker / approver / verifier assigned
[ ] Bill image/evidence upload works at creation AND on existing bills
[ ] Uploading WhatsApp screenshot to bill works

Duplicate Detection:
[ ] Creating bill with same title+store+date shows modal
[ ] Creating task with same title+store+date+assignee shows modal
[ ] Modal has: Open Existing / Merge Notes / Create Anyway / Cancel
[ ] No auto-create / no auto-reject
[ ] Existing duplicates archived (is_archived=1 on bills, archived_duplicate=1 on tasks)
[ ] Archived records NOT counted in dashboard metrics
[ ] Daily scanner runs at 02:00 without error
[ ] /admin/duplicates shows pending groups with action buttons

Assignment Flow:
[ ] Task assigned → immediately appears in assignee's task list (no accept needed)
[ ] Assignee receives popup notification with task details
[ ] Popup has: View Task / Dismiss buttons
[ ] Reviewer/Checker/Approver flow unchanged

Dashboard:
[ ] "Overdue Bills 190" → click → opens bill list with all new columns
[ ] Bill drill-down shows: Responsible / Checker / Approver columns
[ ] Bill drill-down shows: Evidence attachment count
[ ] Quick "Mark Paid" on drill-down works
[ ] Archived/duplicate bills not counted in overdue metric
```

---

## KEY FILES TO TOUCH

```
controllers/BillController.php          — new fields, workflow API, duplicate check
controllers/AdminDuplicatesController.php — NEW
controllers/DrilldownController.php     — extend overdueBills() columns
models/Bill.php                         — new fields, hash method, archive method
models/DuplicateDetector.php            — NEW
models/Task.php                         — remove accepted_at gate
models/TaskNotification.php             — extend for task_assigned type
crons/DailyDuplicateTaskBillScanner.php — NEW
views/bills/create.php + edit.php + detail.php
views/admin/duplicates/index.php        — NEW
views/drilldown/overdue_bills.php       — extend columns
views/partials/task_assigned_popup.php  — NEW
index.php                               — new routes
```

---

*Generated: 2026-06-10 — Merge of CEO WhatsApp evidence + existing codebase audit*
