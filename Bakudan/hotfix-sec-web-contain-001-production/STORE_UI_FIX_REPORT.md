# STORE UI FIX REPORT

**Date:** 2026-06-22  
**Status:** ✅ PASS

## Root Cause
Store Command Center views used **Tailwind CSS classes** (`p-6`, `flex`, `grid-cols-1`, `bg-white`, `rounded-lg`, `shadow`, etc.) but the app's layout (`views/layouts/main.php`) **does not load Tailwind CDN**. The app uses custom CSS: `tokens.css`, `style.css`, `executive-ui.css`, `detail-drawer.css`.

This caused: text floating, cards missing, grid not rendering, layout collapsed, health cards not visible.

## Files Fixed

### 1. `views/admin/store_command/index.php` (REWRITE)
- Replaced all Tailwind with app CSS: `var(--bg-card)`, `var(--border)`, `var(--radius-lg)`, `var(--bg-secondary)`, `var(--text-muted)`
- Custom grid: `.sc-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) }`
- Responsive: `@media(max-width:1100px)` → 2 cols, `@media(max-width:600px)` → 1 col
- Store cards show: name, address, manager, health score/grade, overdue/critical/unpaid stats, employee/task/bill counts

### 2. `views/admin/store_command/show.php` (REWRITE)
- Two-column layout: `.scs-main { grid-template-columns: 2fr 1fr }`
- Left: Today's tasks, Recent activity
- Right: Manager info, Team members, Health metrics bars, Quick actions
- Responsive: `@media(max-width:1100px)` → single column, `@media(max-width:600px)` → stack stats

### 3. `views/admin/stores.php` (UPDATED)
- Added columns: Manager, Status, Health (clickable), Tasks
- Health Score drawer: click score → slide-out panel with Task Completion, Financial, Incidents sections + formula
- `colspan` updated from 6→8 to match new column count

## CSS Classes Used (all from app's existing stylesheets)
- `var(--bg-card)`, `var(--bg-secondary)`, `var(--bg-tertiary)`, `var(--bg-primary)`
- `var(--border)`, `var(--border-hover)`
- `var(--text)`, `var(--text-muted)`
- `var(--radius-lg)`, `var(--radius-md)`, `var(--radius-sm)`
- `var(--accent)`, `var(--neon-pink)`, `var(--neon-cyan)`
- `.card`, `.card-header`, `.card-body`, `.data-table`, `.btn`, `.btn-primary`, `.btn-ghost`, `.badge`, `.badge-overdue`

## Responsive Breakpoints
| Screen | Grid | Cards/Row |
|--------|------|-----------|
| Desktop (>1100px) | 4-col | 4 |
| Tablet (600-1100px) | 2-col | 2 |
| Mobile (<600px) | 1-col | 1 |
