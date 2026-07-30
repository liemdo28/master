# OVERALL_STORE_UI_REPORT.md — Desktop UI Report

## Implementation Summary
- **File:** `views/admin/overall_store/index.php`
- **Type:** Single-page SPA-like view with AJAX drawer

## Desktop Layout
- **Grid:** CSS Grid, responsive `repeat(auto-fill, minmax(340px, 1fr))`
- **Cards per row:** 3-4 depending on screen width
- **Color indicators:** Left border (4px) colored by health status + top banner in drawer
- **Touch targets:** Standard click behavior, hover effects

## Store Card Content
Each card contains:
1. Store name + code
2. Manager name with avatar
3. Health badge (color-coded)
4. Task KPI row (open / completed / overdue / due today)
5. Bill KPI row (open / overdue / unpaid)
6. Next due bill date
7. Last activity
8. Current handler (if any high-risk item)

## Drawer
- **Position:** Slides from right, 560px wide on desktop
- **Overlay:** Semi-transparent background, click-to-close
- **Sections:** Overview, Current Tasks, Bills, Completed, People (tabs)
- **Content:** AJAX-loaded per store

## Click Behavior
- Clicking any KPI number updates the drawer tab and highlights the relevant section
- Each store card click opens the drawer with Overview tab

## KPI Drilldown
All numbers are clickable (`cursor: pointer`, hover underline):
- Open tasks → tasks tab
- Overdue tasks → tasks tab (overdue filter)
- Due today → tasks tab (due-today filter)
- Open bills → bills tab
- Overdue bills → bills tab (overdue filter)
- Unpaid bills → bills tab (unpaid filter)

## Color Classes
- `.os-red` — border-left: #ef4444
- `.os-yellow` — border-left: #eab308
- `.os-green` — border-left: #22c55e
- `.os-gray` — border-left: #6b7280
