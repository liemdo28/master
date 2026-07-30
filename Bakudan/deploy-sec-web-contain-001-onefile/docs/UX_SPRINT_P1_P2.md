# UX Sprint — P1 + P2 ticket breakdown

> Driven by UX stress test on commit `b757e1d` (project timeline, 14/04/2026).
> Goal: turn the "accumulation of features" into a guided workflow.

---

## P1 — must-ship (this sprint)

### TKT-101 · Kill full-page reloads on task actions
**Why:** #3 — `toggleTask()` in list view reloads the whole page after every
complete/reopen. For managers closing 10 tasks in a row this breaks rhythm
and resets scroll.
**Files:** `views/projects/show.php` (`toggleTask`, `submitComment`,
`uploadFile`, `submitQuickTask`), `views/calendar/index.php`,
`assets/js/task-drawer.js`
**AC:**
- Complete/reopen returns new task JSON, no reload
- Row toggles `row-completed` class + adds/removes strikethrough in-place
- KPI counters re-calculated client-side (or re-fetched silently)
- Toast on success ("✓ done" / "↺ reopened")
- Subtasks: optimistic UI, roll back if server errors
- Drawer already uses this pattern via `TaskDrawer`; propagate to list/board

### TKT-102 · Unify navigation: one dominant interaction model
**Why:** #2 — cell→drawer, task-in-cell→modal, action→reload, drawer-open→page
is 4 different patterns.
**Decision:** drawer is primary; modal = deep edit only; full page = share URL / read longform.
**Files:** `views/projects/show.php`, `views/calendar/index.php`, `assets/js/task-drawer.js`
**AC:**
- Any click on a task (cell, list row, search result) opens TaskDrawer with that task as focus
- Drawer supports ← / → to go prev/next task within the same day (and hot-keys `J`/`K`)
- Deep edit ("Open full") remains one click inside drawer
- `openTaskDetail()` modal removed from project/timeline; replaced by drawer `focusTask(id)`

### TKT-103 · Timezone cleanup on project timeline screen
**Why:** #4 — Remaining `date()`, `mktime()`, `strtotime()`, `new Date().toISOString()` risk off-by-one.
**Files:** `views/projects/show.php` lines 188 / 216 / 424 / 485
**AC:**
- Every "today" / month bound comes from `app_today()` / `app_month_start()` / `app_month_end()`
- Month picker jumps and prev/next URLs use workspace TZ
- `new Date().toISOString()` replaced with `new Date().toLocaleDateString('en-CA')` (YYYY-MM-DD local) or data from server
- Add a unit smoke: with workspace TZ Asia/Ho_Chi_Minh, all "today" computations match

### TKT-104 · Smart-default preset chips (Today / Overdue / Mine)
**Why:** #1 — first-time user hesitates with too many controls; give a guided starting path.
**Files:** `views/projects/show.php` header area, `controllers/ProjectController.php`
**AC:**
- New horizontal chip row above the filter bar: `🌅 Hôm nay` `🔥 Quá hạn` `👤 Của tôi` `📋 Tất cả`
- Each chip applies a preset query (replaces filter params)
- Active chip visually distinct
- Default landing when no query params = `🌅 Hôm nay`

### TKT-105 · Collapse advanced filters behind a toggle
**Why:** #1 — header has 6 filter dropdowns + sort + group + density before chips.
**Files:** `views/projects/show.php` filter bar
**AC:**
- By default: only `Search` + `Preset chips` + `View tabs` + `Apply/Reset` visible
- "Bộ lọc nâng cao (4)" toggle button expands: Status / Assignee / Priority / Due / Recurrence / Sort / Group / Density
- Toggle state stored in localStorage so returning user keeps their choice
- Count in toggle = number of active non-default filters

### TKT-106 · Drawer → full action surface
**Why:** #6 — current drawer misses reassign and status/priority change.
**Files:** `assets/js/task-drawer.js`, `assets/css/task-drawer.css`, `index.php`
(new endpoint for priority + status PATCH)
**AC:**
- New quick actions in each task card:
  - `👤 Reassign` → inline dropdown of users
  - `🔄 Status` → inline radio-pill (todo/in_progress/review/done)
  - `⚡ Priority` → inline radio-pill (low/medium/high/urgent)
- Keyboard navigation inside drawer: ↑↓ task, ←→ day, `Enter` = open, `Space` = complete
- Prev/Next arrows at top of drawer to move between days

### TKT-107 · Tone down urgency visuals for enterprise clarity
**Why:** #7 — pulsing glow + flame feels demo-y for a finance ops tool.
**Files:** `assets/css/pages/calendar.css`, `views/projects/show.php`
**AC:**
- Replace pulse animation with static red left-border + subtle bg tint
- Keep 🔥 prefix but only on "critical overdue" (> 7 days late); ≤ 7 days gets a cleaner `!` chip
- Lower intensity of red from #991b1b to #7f1d1d (less bleeding)
- Retain accessibility contrast ≥ 4.5:1

### TKT-108 · Preserve query context on prev/next month links
**Why:** #5 — month picker preserves filters but prev/next links drop them.
**Files:** `views/projects/show.php` line 245 + 485 (`jumpProjectTimeline`)
**AC:**
- `<a>` prev/next month buttons include current `$_GET` (except month/year)
- `jumpProjectTimeline()` builds URL off `URLSearchParams(location.search)` instead of fresh URL

---

## P2 — next sprint

### TKT-201 · "Your workday" home panel
Landing page: 3 cards (Today / Overdue / Recent) + 1 focus task selected by urgency score.

### TKT-202 · Inline edit in task row (no drawer, no modal)
Row click on title → input becomes editable; Esc cancels, Enter saves.

### TKT-203 · Saved views
User saves a filter combo as named view; appears as a chip next to presets.

### TKT-204 · Bulk actions
Shift-click to select, action bar floats at bottom: Complete · Reassign · Delete · Move.

### TKT-205 · Task comment inline from drawer
Add comment area below actions in drawer — no modal round-trip.

### TKT-206 · Subtask counts + expand on cards
If task has subtasks → show `0/3 subtasks` chip, click to expand inline.

### TKT-207 · Empty-state coaching
First-time project with 0 tasks → inline hint: "Create your first task", guided button.

### TKT-208 · Recurrence inspector
Click recurrence chip → popover showing upcoming 5 occurrences.

---

## Implementation order (this sprint)

1. **TKT-103** (TZ cleanup — small, trust issue) → 30 min
2. **TKT-108** (prev/next preserve query — trivial) → 10 min
3. **TKT-101** (no-reload list actions — moderate) → 60 min
4. **TKT-104 + TKT-105** (preset chips + collapse filters — UI pair) → 90 min
5. **TKT-106** (drawer action surface — bigger) → 90 min
6. **TKT-102** (unify navigation — touches many files) → 60 min
7. **TKT-107** (visual polish — final pass) → 20 min

Total: ~6 hrs focused work.
