# P0 EXECUTION VERIFICATION — BILL SYSTEM + DUPLICATE CONTROL
**Status:** `BUILD COMPLETE · VERIFICATION NOT COMPLETE · DEPLOY NOT APPROVED`  
**Spec Date:** 2026-06-10  
**Verification Runner:** `https://dashboard.bakudanramen.com/run_p0_verification.php?key=bkd_verify_2026`

---

## HOW TO USE

1. Run `run_p0_verification.php` — auto-checks Phase A, D, J (schema + SQL)
2. Work through Phases B–C, E–I, K manually — capture screenshots/video
3. Fill PASS/FAIL/BLOCKED in each phase below
4. All PASS → create `reports/PRODUCTION_CERTIFICATION.md` → request deploy approval

---

## PHASE A — DATABASE VALIDATION
**Type:** Auto (run verification script)  
**Status:** `[ ] PASS  [ ] FAIL  [ ] BLOCKED`

### Tables that must exist
```
bill_categories
bill_evidence
bill_history
duplicate_groups
duplicate_group_items
duplicate_resolution_log
task_notifications
task_comments
task_mentions
task_reviewer_notes
task_approval_notes
```

### Columns on `bills` that must exist
```
responsible_user_id
checker_user_id
approver_user_id
verifier_user_id
payment_method
frequency
duplicate_hash
is_archived
last_paid_date
next_due_date
notes (on bills)
archived_at
archived_reason
duplicate_of_bill_id
```

### Columns on `tasks` that must exist
```
duplicate_hash
archived_duplicate
merged_into_task_id
duplicate_reason
assignment_notified_at
```

### Evidence
- [ ] Run `run_p0_verification.php` → attach screenshot of Phase A section showing all ✅
- [ ] If any ❌: run the corresponding migration SQL on production first

### How to run missing migrations on production
```
visit /run_p0_migration_bill.php?key=bkd_mig_bill_2026  (create this if needed)
```
Or run via SSH:
```bash
mysql -u {user} -p {db} < database/migrations/2026_06_10_bill_registry_upgrade.sql
mysql -u {user} -p {db} < database/migrations/2026_06_10_duplicate_control.sql
mysql -u {user} -p {db} < database/migrations/2026_06_10_assignment_flow_fix.sql
```

---

## PHASE B — DUPLICATE BILL DETECTION
**Type:** Manual — requires browser  
**Status:** `[ ] PASS  [ ] FAIL  [ ] BLOCKED`

### Test steps
1. Go to `GET /bills/create` (or store bill create)
2. Fill in:
   - Title: **Raw Stockton Rent**
   - Store: Raw Stockton
   - Due Date: 2026-06-30
   - Amount: $5,000
   - Category: Rent
3. Submit → bill created ✅
4. Go back to create form
5. Fill in **exact same fields**
6. **Expected:** Before submit (or on submit), duplicate modal appears:
   ```
   ⚠️ Possible Duplicate Found
   "Raw Stockton Rent — Raw Stockton — Jun 30"
   Status: pending · $5,000.00
   [ Open Existing ]  [ Merge Notes ]  [ Create Anyway ]  [ Cancel ]
   ```
7. Verify `Match Score` shown (e.g. 95%)
8. Click `Create Anyway` → bill created with `force_create=1`
9. Click `Open Existing` → redirects to existing bill

### Evidence required
- [ ] Screenshot: duplicate modal appearing
- [ ] Screenshot: match score visible
- [ ] Screenshot: DB — `SELECT id, title, duplicate_hash, is_archived FROM bills WHERE title LIKE '%Stockton Rent%'`
- [ ] Video (optional but recommended): full create → modal → resolve flow

### Failure conditions
- ❌ No modal shown → `DuplicateDetector::checkBillDuplicate()` not called in `createBill()`
- ❌ Modal shown but "Create Anyway" still blocked → check `force_create` flag in controller
- ❌ Hash not saved → check `computeAndSaveHash()` call after INSERT

---

## PHASE C — DUPLICATE TASK DETECTION
**Type:** Manual — requires browser  
**Status:** `[ ] PASS  [ ] FAIL  [ ] BLOCKED`

### Test steps
1. Create task:
   - Title: **Payroll Tax Q2**
   - Store: Bakudan Stockton
   - Due Date: 2026-07-15
   - Assignee: any user
   - Category: Tax
2. Create exact same task again
3. **Expected:** Duplicate modal with:
   ```
   [ Open Existing ]  [ Merge Notes ]  [ Create Anyway ]  [ Cancel ]
   ```

### Evidence required
- [ ] Screenshot: modal
- [ ] Screenshot: `SELECT id, title, duplicate_hash, archived_duplicate FROM tasks WHERE title LIKE '%Payroll Tax%'`

---

## PHASE D — DAILY SCANNER
**Type:** Semi-auto (run via CLI or web trigger)  
**Status:** `[ ] PASS  [ ] FAIL  [ ] BLOCKED`

### How to run
```bash
php crons/DailyDuplicateTaskBillScanner.php
```
Or create a temporary web trigger:
```php
// run_scanner_test.php?key=bkd_verify_2026
require_once __DIR__ . '/crons/DailyDuplicateTaskBillScanner.php';
```

### Expected DB state after run
```sql
SELECT COUNT(*) FROM duplicate_groups;           -- should be > 0 if duplicates exist
SELECT COUNT(*) FROM duplicate_group_items;      -- should be ≥ COUNT above * 2
SELECT * FROM duplicate_groups ORDER BY detected_at DESC LIMIT 10;
```

### Evidence required
- [ ] Screenshot: `SELECT COUNT(*) FROM duplicate_groups` showing count > 0
- [ ] Screenshot: `SELECT * FROM duplicate_groups LIMIT 5` showing real records
- [ ] No PHP fatal errors in output

---

## PHASE E — ADMIN DUPLICATE CENTER
**Type:** Manual — requires browser  
**Status:** `[ ] PASS  [ ] FAIL  [ ] BLOCKED`

### Test steps
1. Run scanner (Phase D) first to populate groups
2. Open `GET /admin/duplicates`
3. Verify table shows: Entity Type | Original | Duplicate | Fields Matched | Actions
4. Test **Archive Duplicate**:
   - Click Archive → `is_archived=1` set on duplicate record
   - Check `duplicate_resolution_log` has new row with `action='archived'`
5. Test **Ignore**:
   - Click Ignore → group status = 'ignored'
   - Check `duplicate_resolution_log` has new row
6. Test **Not Duplicate**:
   - Click Not Duplicate → group status = 'ignored' with reason

### Evidence required
- [ ] Screenshot: `/admin/duplicates` page showing groups
- [ ] Screenshot: DB `SELECT * FROM duplicate_resolution_log LIMIT 5` after each action
- [ ] Screenshot: `SELECT is_archived, archived_reason FROM bills WHERE id = {archived_id}`

---

## PHASE F — ASSIGNMENT FLOW (no accept required)
**Type:** Manual — 2 browser sessions  
**Status:** `[ ] PASS  [ ] FAIL  [ ] BLOCKED`

### Critical fix being verified
Old behavior: `Task.php` filtered `AND accepted_at IS NOT NULL` → assignee couldn't see task until accepting.  
New behavior: `accepted_at` filter REMOVED → task appears immediately.

### Test steps
1. Open browser as **Admin/CEO**
2. Create task → assign to Manager user
3. Open **second browser** as Manager user (or use incognito)
4. Go to Manager's task list (`/tasks` or `My Tasks`)
5. **Expected:** New task appears IMMEDIATELY — no "Accept Task" button required
6. Verify also in: dashboard task count, notification bell

### Must NOT see
- ❌ "Accept Task" button blocking access
- ❌ "Pending Acceptance" state
- ❌ Task missing from assignee's list

### Evidence required
- [ ] Screenshot: Admin assigns task
- [ ] Screenshot: Manager's task list showing the task immediately (timestamp close to creation)
- [ ] Screenshot: No "accept" gate visible

---

## PHASE G — POPUP NOTIFICATION ON ASSIGNMENT
**Type:** Manual  
**Status:** `[ ] PASS  [ ] FAIL  [ ] BLOCKED`

### Pre-condition
- `task_notifications` table exists (Phase A)
- `views/partials/task_assigned_popup.php` included in layout

### Test steps
1. Check `views/layouts/app.php` (or main layout) — confirm popup partial is included:
   ```php
   <?php include __DIR__ . '/../partials/task_assigned_popup.php'; ?>
   ```
   If NOT included → add it before `</body>`.
2. Assign task to user
3. Log in as that user
4. **Expected popup in top-right within 5 seconds:**
   ```
   📋 New Task Assigned
   Title: [task title]
   Store: [store name]
   Due: [date]
   Priority: [level]
   Assigned by: [name]
   [ View Task ]    [ Dismiss ]
   ```
5. Click **View Task** → redirects to `/tasks/{id}`
6. Click **Dismiss** → popup closes, notification marked read

### Evidence required
- [ ] Screenshot: popup visible on screen
- [ ] Screenshot: DB `SELECT * FROM task_notifications WHERE notification_type='task_assigned' LIMIT 5`
- [ ] Screenshot: After dismiss → `SELECT is_read FROM task_notifications WHERE id = {id}`

### If popup not showing
- Check popup partial is in layout
- Check `GET /api/notifications?type=task_assigned&unread=1` returns data
- Check browser console for JS errors

---

## PHASE H — BILL CATEGORIES AUDIT
**Type:** Manual + Auto (verification script)  
**Status:** `[ ] PASS  [ ] FAIL  [ ] BLOCKED`

### Required categories in `bill_categories` table
```sql
SELECT slug, name, default_frequency, requires_evidence FROM bill_categories ORDER BY sort_order;
```
Expected output:
| slug | name | default_frequency |
|---|---|---|
| rent | Rent | monthly |
| utility | Utility | monthly |
| tax | Tax | quarterly |
| insurance | Insurance | annual |
| credit_card | Company Credit Card | monthly |
| vendor | Vendor / Platform | monthly |
| payroll | Payroll | biweekly |
| compliance | Compliance | annual |
| other | Other | once |

### Test: Create one real bill per category
For each category, create a bill in the system. Example:
- Rent → "Joule Park West Rent" / Raw Stockton / $8,500 / monthly
- Utility → "PG&E" / Raw Stockton / due next month
- Tax → "Sales Tax Q2" / Bakudan / due 2026-07-20
- Insurance → "Business Insurance Annual" / All Stores / due 2026-08-01
- Credit Card → "AmEx Statement" / Bakudan / due 2026-06-25
- Vendor → "QuickBooks Subscription" / All Stores / monthly
- Payroll → "Staff Payroll" / Raw Stockton / biweekly
- Compliance → "ABC Alcohol Filing" / Raw Stockton / quarterly

### Evidence required
- [ ] Screenshot: `SELECT slug, name FROM bill_categories`
- [ ] Screenshot: bill list showing at least one bill per category

---

## PHASE I — CEO REAL DATA IMPORT
**Type:** Manual data entry / SQL seed  
**Status:** `[ ] PASS  [ ] FAIL  [ ] BLOCKED`

### Required CEO-known recurring bills to exist in production
If not existing → create them now. Use real stores, real amounts where known.

**Rent (monthly, each store)**
```
Joule Park West Rent   → Raw Stockton  → $8,500–$12,000 range
[Other store rents]    → each store
```

**Utility (monthly)**
```
PG&E                  → Raw Stockton, Raw QB, IFT, Heo Holding
CPS Energy            → [Texas stores if any]
Waste Management      → per store
Water                 → per store
```

**Tax (quarterly/monthly)**
```
CA Sales Tax          → Raw Stockton  → CDTFA filing
Raw Sales Tax         → Raw QB        → CDTFA
IFT Sales Tax         → IFT           → CDTFA
Heo Holding Sales Tax → Heo Holding   → CDTFA
Payroll Tax           → All stores    → EDD quarterly
ABC Filing            → [stores with liquor license]
```

**Insurance (annual)**
```
Business Insurance (General Liability)
Workers Compensation Insurance
Umbrella Insurance
EPLI (Employment Practices Liability)
```

**Company Credit Card (monthly)**
```
AmEx Business Card
Chase Ink
[other company cards]
```

**Vendor/Platform (monthly)**
```
QuickBooks Online     → $80/month
Toast POS             → per store
Yelp / Google Ads     → if any
```

### Evidence required
- [ ] Screenshot: `/bills` list showing all categories populated
- [ ] SQL: `SELECT category, COUNT(*) as cnt FROM bills GROUP BY category`

---

## PHASE J — TASK DETAIL REGRESSION (50 random tasks)
**Type:** Auto (verification script checks all task dependencies)  
**Status:** `[ ] PASS  [ ] FAIL  [ ] BLOCKED`

### The known P0 blocker
`task_approval_notes` table missing on production → `SQLSTATE[42S02]` crash on task detail.

All 5 tables guarded with `tableExists()`:
- `task_comments`
- `task_mentions`
- `task_notifications`
- `task_reviewer_notes`
- `task_approval_notes`

### Auto-check (verification script)
The `run_p0_verification.php` script will:
- Load 50 random task IDs
- Make HEAD requests to `/tasks/{id}` 
- Report any 500/404 responses

### Manual test checklist (spot-check 10 tasks)
For each tested task, verify ALL work:
- [ ] Task detail page loads (no SQL error)
- [ ] Comments section renders (even if empty)
- [ ] Add comment → saved → appears
- [ ] Upload evidence attachment → saved → downloadable
- [ ] Mark complete → status changes
- [ ] Approval notes section renders (even if empty)
- [ ] Reviewer notes section renders (even if empty)
- [ ] Task history shows

### Evidence required
- [ ] Screenshot: verification script Phase J showing 50/50 tasks load
- [ ] Screenshot: specific task with approval notes section visible
- [ ] Screenshot: comment added successfully

---

## PHASE K — DASHBOARD DRILL-DOWN AUDIT
**Type:** Manual — all dashboard cards  
**Status:** `[ ] PASS  [ ] FAIL  [ ] BLOCKED`

### Clickable cards that MUST work (no dead-ends)

**Overview Dashboard (`/overview`)**
| Card | Expected Link | Status |
|---|---|---|
| Cash Risk | `/overview/drilldown/cash-risk` | [ ] |
| Overdue Bills | `/overview/drilldown/overdue-bills` | [ ] |
| Critical Tasks | `/overview/drilldown/critical-tasks` | [ ] |
| Compliance Risk | `/overview/drilldown/compliance-risk` | [ ] |
| Execution Risk | `/overview/drilldown/execution-risk` | [ ] |
| Unified Risk Score | `/overview/drilldown/unified-risk` | [ ] |
| Finance Critical bills | `/overview/drilldown/finance-bills?risk=critical` | [ ] |
| Finance High bills | `/overview/drilldown/finance-bills?risk=high` | [ ] |
| Finance Medium bills | `/overview/drilldown/finance-bills?risk=medium` | [ ] |
| Finance Low bills | `/overview/drilldown/finance-bills?risk=low` | [ ] |
| Store rows | `/overview/store/{id}` | [ ] |
| Team member rows | `/overview/member/{id}` | [ ] |

**Drill-down pages — columns must include**
- [ ] Responsible / Owner column visible (not just assignee_id)
- [ ] Checker column visible
- [ ] Approver column visible
- [ ] Evidence count visible (📎 or count)
- [ ] "View Bill →" / "View Task →" links work
- [ ] No 500 errors on any drill-down page

### Evidence required
- [ ] Screenshot: each drill-down page loaded with data
- [ ] Screenshot: clicking "View Bill →" opens bill detail
- [ ] Screenshot: no dead-end cards (all numbers are links)

---

## PHASE L — PRODUCTION CERTIFICATION REPORTS

Create these files (fill in actual PASS/FAIL/BLOCKED based on phases above):

### `reports/BILL_SYSTEM_VERIFICATION.md`
```markdown
# Bill System Verification
Date: [date]
Tester: [name]

| Check | Status | Evidence |
|---|---|---|
| bill_categories table exists | PASS/FAIL | screenshot |
| bill_evidence table exists | PASS/FAIL | screenshot |
| bills.responsible_user_id exists | PASS/FAIL | screenshot |
| bill_categories seeded (9 rows) | PASS/FAIL | screenshot |
| Create bill with responsible/checker/approver | PASS/FAIL | screenshot |
| Bill evidence upload works | PASS/FAIL | screenshot |
| Workflow transition API works | PASS/FAIL | screenshot |
| CEO known bills (Rent/Tax/Utility) imported | PASS/FAIL | screenshot |
```

### `reports/DUPLICATE_SYSTEM_VERIFICATION.md`
```markdown
# Duplicate System Verification
Date: [date]
Tester: [name]

| Check | Status | Evidence |
|---|---|---|
| duplicate_groups table exists | PASS/FAIL | |
| Duplicate modal on bill create | PASS/FAIL | screenshot |
| Duplicate modal on task create | PASS/FAIL | screenshot |
| DailyDuplicateTaskBillScanner runs | PASS/FAIL | output |
| /admin/duplicates page loads | PASS/FAIL | screenshot |
| Archive action works | PASS/FAIL | DB screenshot |
| Archived bills excluded from dashboard count | PASS/FAIL | |
```

### `reports/ASSIGNMENT_FLOW_VERIFICATION.md`
```markdown
# Assignment Flow Verification
Date: [date]

| Check | Status | Evidence |
|---|---|---|
| Task appears without accept | PASS/FAIL | assignee screenshot |
| No "Accept Task" button | PASS/FAIL | screenshot |
| Popup notification shows | PASS/FAIL | screenshot |
| Popup has View Task + Dismiss | PASS/FAIL | screenshot |
| task_notifications row inserted | PASS/FAIL | DB screenshot |
```

### `reports/DASHBOARD_DRILLDOWN_VERIFICATION.md`
```markdown
# Dashboard Drill-Down Verification
Date: [date]

| Card | Drill-Down Route | Loads | Has Data | No 500 |
|---|---|---|---|---|
| Cash Risk | /overview/drilldown/cash-risk | PASS/FAIL | | |
| Overdue Bills | /overview/drilldown/overdue-bills | | | |
| Critical Tasks | /overview/drilldown/critical-tasks | | | |
| Compliance Risk | /overview/drilldown/compliance-risk | | | |
| Execution Risk | /overview/drilldown/execution-risk | | | |
| Unified Risk | /overview/drilldown/unified-risk | | | |
| Finance Critical | /overview/drilldown/finance-bills?risk=critical | | | |
| Store row | /overview/store/{id} | | | |
| Member row | /overview/member/{id} | | | |
```

### `reports/PRODUCTION_CERTIFICATION.md`
```markdown
# Production Certification

BUILD STATUS: [APPROVED FOR DEPLOY / NOT READY]

| Phase | Status | Blocker |
|---|---|---|
| A — Database | PASS/FAIL/BLOCKED | |
| B — Bill Duplicate | | |
| C — Task Duplicate | | |
| D — Daily Scanner | | |
| E — Admin Duplicate Center | | |
| F — Assignment Flow | | |
| G — Popup Notification | | |
| H — Bill Categories | | |
| I — CEO Data Import | | |
| J — Task Detail Regression | | |
| K — Dashboard Drill-Down | | |

SIGN-OFF: [name] — [date]

DEPLOY APPROVED: YES / NO
```

---

## CEO ACCEPTANCE CRITERIA

Phase is accepted **only when ALL boxes checked**:

```
[ ] Migrations executed on production DB
[ ] Phase A verification script shows all ✅
[ ] Duplicate modal works (bill + task)
[ ] Daily scanner runs and populates duplicate_groups
[ ] /admin/duplicates works (archive/ignore/not-duplicate)
[ ] Task assignee sees task immediately (no accept gate)
[ ] Popup notification works with View Task + Dismiss
[ ] bill_categories has all 9 CEO categories
[ ] CEO-known recurring bills (Rent/Utility/Tax/Insurance/CC/Vendor) imported
[ ] 50 random task detail pages load without SQL error
[ ] All Overview dashboard cards click to drill-down
[ ] Drill-down pages show source records with owner/checker/approver
[ ] All 5 verification reports created with PASS status
[ ] PRODUCTION_CERTIFICATION.md signed off

OTHERWISE: STATUS = NOT READY FOR CEO REVIEW
```

---

*This verification spec must be completed before any production deploy.*  
*Each evidence item = screenshot or DB query output attached to the report.*
