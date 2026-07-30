# OVERALL_STORE_SPEC.md — Overall Store Dashboard Specification

## Overview
The Overall Store Dashboard is an executive-level operational view showing the health status of every store at a glance.

## Route
- **URL:** `/overall-store`
- **Module name:** Overall Store
- **Sidebar section:** Stores

## Access Rules
| Role | Access |
|------|--------|
| CEO | All stores |
| Admin | All stores |
| Manager | Assigned stores only |
| Member | No access |

## Store Card Fields
Each store card displays:
- Store name
- Store code
- Manager name
- Health color (Green / Yellow / Red / Gray)
- Open tasks count
- Completed tasks count
- Overdue tasks count
- Due today tasks count
- Upcoming tasks count
- Open bills count
- Overdue bills count
- Unpaid bills count
- Next due bill date
- Last activity timestamp
- Current handler for highest-risk item

## Color Logic
### Green
- No overdue tasks
- No overdue bills
- No critical open issues

### Yellow
- Task due today
- Bill due within 3 days
- Medium risk

### Red
- Overdue task
- Overdue bill
- Critical task
- Unresolved compliance issue

### Gray
- No data / inactive / setup incomplete

## Sorting
1. Red stores first
2. Yellow stores second
3. Green stores last
4. Gray stores last

Within same color:
- More overdue items first
- Nearest due date first

## Drawer Sections
### 1. Overview
- Health summary, risk reason, manager, last update

### 2. Current Tasks
Sorted: overdue → due today → upcoming → in progress → completed recent
Columns: title, status, due date, priority, assignee, reviewer, store, action

### 3. Bills
Sorted: overdue → unpaid → upcoming → recurring
Columns: name, category, vendor, due date, amount, owner, status

### 4. Completed Tasks
Recently completed: title, completed date, completed by, reviewer

### 5. People
Manager, assigned members, task load per user

## Handler Visibility
Every task/bill shows responsible person(s). Missing handler shows "Needs owner" highlighted in yellow or red.

## Files Created
- `models/OverallStore.php` — Data model with store aggregation, tasks, bills queries
- `controllers/OverallStoreController.php` — Controller with index, API detail, tasks, bills endpoints
- `views/admin/overall_store/index.php` — Full SPA-like view with card grid, drawer, AJAX loading
