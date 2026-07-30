# OVERALL STORE P0 FIX REPORT

**Date:** 2026-06-23
**Severity:** P0 (CEO Evidence)
**Route:** `/overall-store`

---

## Symptom (Before)

CEO screenshots showed:

1. Store cards displayed `No manager` — misleading (a store without a manager should never look like a healthy card).
2. Cards were not actionable enough: numbers were present, but the *reason* a store is critical was missing.
3. A store with no manager could still be green if it had no overdue items — wrong.
4. The drawer was inconsistent: tasks/bills didn't always show owner/reviewer.
5. Setup-incomplete stores were indistinguishable from healthy empty stores.

---

## Root Cause

In `models/OverallStore.php`:

- `calculateHealthColor()` only considered task/bill metrics. It had no concept of "the store is not set up yet" (no manager, no financial coverage, etc.).
- `getStoreHighestRiskHandler()` returned `'All clear'` for stores with no data, which is a useful default for a populated store but confusing for an empty one.
- The view (`views/admin/overall_store/index.php`) hardcoded the "No manager" label and did not surface a Top Issue per card.

---

## Fixes Applied

### A. Manager Display (View)

Replaced the hardcoded `No manager` block in `views/admin/overall_store/index.php` with:

```php
<?php if (!empty($store['manager_name'])): ?>
    <div class="os-card__manager">👤 <strong><?= htmlspecialchars($store['manager_name']) ?></strong></div>
<?php else: ?>
    <div class="os-card__manager" style="color:#9ca3af;font-style:italic">⚠️ <?= e(t('overall_store.manager_not_assigned')) ?></div>
<?php endif; ?>
```

Manager now reads **"Manager: Not Assigned"** (i18n) when missing.

### B. Setup-Incomplete Logic (Model)

Added `private function needsSetup($store)` in `models/OverallStore.php`:

```php
private function needsSetup($store) {
    return empty($store['manager_id']) || empty($store['manager_name']);
}
```

`calculateHealthColor()` now short-circuits to `'gray'` when `needs_setup` is true, **before** any other check. A store with no manager can never be green.

### C. Top Issue (Model + View)

Added `private function buildTopIssue($store, $today, $threeDaysLater)`:

```php
private function buildTopIssue($store, $today, $threeDaysLater) {
    $reasons = [];
    if ($this->needsSetup($store)) {
        $reasons[] = t('overall_store.manager_not_assigned');          // "Manager: Not Assigned"
    }
    if (($store['overdue_tasks'] ?? 0) > 0) {
        $reasons[] = $store['overdue_tasks'] . ' ' . t('overall_store.overdue') . ' ' . t('overall_store.task');
        // → "3 overdue task"
    }
    if (($store['overdue_bills'] ?? 0) > 0) {
        $reasons[] = $store['overdue_bills'] . ' ' . t('overall_store.overdue') . ' ' . t('overall_store.bill');
    }
    if (($store['critical_tasks'] ?? 0) > 0) {
        $reasons[] = $store['critical_tasks'] . ' ' . t('overall_store.task') . ' (' . t('status.critical') . ')';
    }
    if (($store['due_today_tasks'] ?? 0) > 0) {
        $reasons[] = $store['due_today_tasks'] . ' ' . t('overall_store.task') . ' ' . t('overall_store.due_today_count');
    }
    if (($store['unpaid_bills'] ?? 0) > 0 && ($store['overdue_bills'] ?? 0) == 0) {
        $reasons[] = $store['unpaid_bills'] . ' ' . t('overall_store.bill') . ' ' . t('overall_store.unpaid');
    }
    return implode(' · ', $reasons) ?: t('overall_store.no_open_issues');
}
```

The card now renders a coloured Top Issue pill that matches the health color:

- **Red card** → red-tinted pill, e.g. `Top Issue: 3 overdue task · 1 overdue bill`
- **Yellow card** → amber pill
- **Gray card** → muted pill with `Manager: Not Assigned`
- **Green card** → green pill, e.g. `Top Issue: 1 task Due Today`

### D. Handler Visibility

The drawer now always renders the manager line. If missing, it shows `⚠️ Manager: Not Assigned`. Each row in the tasks and bills tables already shows `assignee_name` and `owner_name` (with `COALESCE(..., 'Needs owner')` SQL guards).

### E. Card Actionability

Each card now shows:

- Store name + health badge
- Manager / Manager: Not Assigned
- **Top Issue** (new)
- Open tasks / completed / overdue / due today / upcoming
- Open bills / overdue / unpaid
- Current handler (highest-risk owner)
- Last activity

### F. Drawer Content

Already had:

1. Overview (drilldown cards)
2. Tasks (overdue → due today → active → completed recent)
3. Bills (overdue → unpaid → upcoming → recurring)
4. Completed
5. People

**Added**:

- Top Issue pill on the Overview tab (color-coded by health).
- "Manager: Not Assigned" warning if the manager is missing.
- Tasks table ordered with `FIELD(priority, urgent, critical, high, medium, low)` so the highest-risk rows are always on top.

---

## Health Color Logic (Final)

| Condition                              | Color |
|----------------------------------------|-------|
| `needs_setup` (manager missing)        | gray  |
| All metrics = 0                        | gray  |
| overdue_tasks > 0                      | red   |
| overdue_bills > 0                      | red   |
| critical_tasks > 0                     | red   |
| due_today > 0                          | yellow|
| due_soon_bills > 0                     | yellow|
| otherwise (open items, no risks)       | green |

A store without a manager **cannot** be green. That is the central fix.

---

## Data Flow

`getEnrichedStores()` (and `getStoreDetail()` for the drawer) now produces:

```
{
  id, name, store_code, manager_id, manager_name, manager_email,
  open_tasks, completed_tasks, overdue_tasks, due_today_tasks, upcoming_tasks, critical_tasks,
  open_bills, overdue_bills, unpaid_bills, due_soon_bills, next_due_bill,
  last_activity, current_handler,
  needs_setup:  bool,
  health_color: 'red' | 'yellow' | 'green' | 'gray',
  health_label: 'Critical' | 'Needs Attention' | 'Healthy' | 'Setup Incomplete',
  top_issue:    'Manager: Not Assigned · 3 overdue task'
}
```

---

## Translations

Added 41 new keys to `lang/en-US.php`, `lang/es-US.php`, `lang/vi-VN.php` for:

- `overall_store.manager_not_assigned`
- `overall_store.top_issue`
- `overall_store.no_open_issues`
- `overall_store.open` / `overdue` / `due_today_count` / `unpaid`
- `overall_store.assignee` / `reviewer` / `checker` / `approver` / `owner`
- `overall_store.task` / `bill` / `due` / `priority` / `status`
- `overall_store.no_team` / `no_open_tasks` / `no_bills` / `no_completed`
- drawer labels: `drawer_overview` / `drawer_tasks` / `drawer_bills` / `drawer_completed` / `drawer_people`
- `overall_store.open_task_count` / `done_task_count` / `people_load`

---

## Files Touched

```
models/OverallStore.php
views/admin/overall_store/index.php
lang/en-US.php
lang/es-US.php
lang/vi-VN.php
```

---

## Verdict

- `needs_setup` prevents a no-manager store from being healthy.
- Top Issue is now visible on every card and on the drawer Overview.
- Manager display is `Manager: Not Assigned` (not "No manager").
- 41 i18n keys added to all three locales.

The `/overall-store` page is now CEO-actionable: each card answers *why* a store is critical in one sentence.
