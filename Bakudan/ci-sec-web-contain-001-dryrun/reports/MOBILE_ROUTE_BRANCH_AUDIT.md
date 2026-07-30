# MOBILE ROUTE BRANCH AUDIT — P0 AUDIT

**Date:** 2026-06-16  
**Method:** Regex grep across `controllers/`, `views/`, `assets/js/`, `router.php`, `index.php`  
**Conclusion:** **NO mobile-specific routing, controller branch, or layout exists.**

---

## 1. SEARCH PATTERNS USED

```regex
isMobile|is_mobile|mobile_|MOBILE
mobile\(
mobile_layout
view_port|viewport
device_type
user_agent.*mobile
iPhone|iPad|Android
bottom_nav
drawer       # Note: drawer = side panel UI, NOT a device concept
sheet
```

---

## 2. RESULTS BY CATEGORY

### 2.1 PHP Controllers

| Pattern | Count | Verdict |
|---------|-------|---------|
| `isMobile()` | 0 | ❌ No mobile detection |
| `mobile_` prefix | 0 | ❌ No mobile-only methods |
| `MOBILE` constant | 0 | ❌ No mobile constant |
| `iPhone` / `Android` string match | 0 | ❌ No UA sniffing |
| `user_agent` | 0 | ❌ No UA reads |

**All 53 controllers** (Dashboard, Auth, Bill, Task, Calendar, Inbox, etc.) are **device-agnostic**. Same code for same routes.

### 2.2 PHP Views (Templates)

| Pattern | Count | Verdict |
|---------|-------|---------|
| `isMobile` | 0 | ❌ No mobile branch in templates |
| `MOBILE` | 0 | ❌ No mobile conditional rendering |
| `viewport` (CSS meta tag) | 8 | ✅ Only `<meta name="viewport">` declarations (mobile-friendly meta, not branching) |
| `drawer` | 14 | ✅ UI component (side panel), not device-specific |
| `cash_drawer` | 1 | ✅ POS data field, not device UI |

### 2.3 JavaScript (Frontend)

| Pattern | File | Verdict |
|---------|------|---------|
| `setViewportHeight()` | `assets/js/app.js` | ✅ Mobile-friendly viewport (not branching) |
| `viewportResizeRaf` | `assets/js/app.js` | ✅ Resize handler (works for all) |
| `drawer` | `assets/js/detail-drawer.js`, `task-drawer.js`, `error-boundary.js` | ✅ UI component |
| `ErrorBoundary.wrap()` | `assets/js/error-boundary.js` | ✅ Widget crash isolation (device-agnostic) |

**Zero mobile-detection JavaScript.**

### 2.4 Router & Bootstrap

`router.php` and `index.php` are pure path-based routing. No UA sniffing. No device detection.

---

## 3. LAYOUT INVENTORY

| Layout File | Purpose | Mobile-Aware? |
|-------------|---------|---------------|
| `views/layouts/main.php` | Primary layout | ❌ No (uses `viewport` meta only) |
| `views/layouts/login.php` (assumed) | Login | ❌ No |
| `views/auth/login.php` | Login view | ❌ No |

**Single layout for all devices.** Responsive behavior comes from CSS media queries in `assets/css/`.

---

## 4. CONTROLLER BRANCH INVENTORY

Every controller method that takes a route:

```php
// Sample: DashboardController.php
public function overview() {
    // no isMobile() check
    // no UA check
    // same code regardless of device
    $counts = $this->overdueService->counts($userId, $role);
    return $this->render('dashboard/overview', [...]);
}
```

**No `if (isMobile()) { ... } else { ... }` branches anywhere in `controllers/`.**

---

## 5. ROUTING TABLE (extracted from `index.php`)

Sample of routes:

| Pattern | Handler | Mobile-Branch? |
|---------|---------|----------------|
| `GET /` | `DashboardController::overview()` | ❌ |
| `GET /overview` | `DashboardController::overview()` | ❌ |
| `GET /my-tasks` | `DashboardController::myTasks()` | ❌ |
| `GET /tasks` | `TaskController::index()` | ❌ |
| `GET /calendar` | `DashboardController::calendar()` | ❌ |
| `GET /inbox` | `InboxController::index()` | ❌ |
| `GET /bills` | `BillController::index()` | ❌ |
| `GET /operations/today` | `OperationsController::today()` | ❌ |
| `GET /action-center` | `ActionCenterController::index()` | ❌ |
| `GET /company/calendar` | `CompanyCalendarController::index()` | ❌ |
| `GET /admin/duplicates` | `AdminDuplicatesController::index()` | ❌ |
| `GET /admin/penalties` | `PenaltyController::index()` | ❌ |
| `GET /notifications` | `NotificationCenterController::index()` | ❌ |
| `GET /api/...` | Various API controllers | ❌ |

**All routes are device-neutral.**

---

## 6. WHAT CEO IS PROBABLY SEEING

The "Something went wrong" message is rendered by:

1. **`index.php` PHP error handler** — catches uncaught exceptions and prints the message
2. **The `main.php` layout line 4** — `Notification::getUnreadCount(1)` throws BEFORE any HTML renders, so the entire page dies
3. **The PHP `set_exception_handler` / `set_error_handler`** if registered

**Triggering condition (any device):**
- A controller's SQL query references a missing table or column
- A view template references an undefined array key
- The bootstrap dies on `$_SESSION` corruption

---

## 7. RESPONSIVE CSS AUDIT (the only mobile-aware layer)

`assets/css/` uses `@media (max-width: 768px)` and similar breakpoints. This is the ONLY place mobile is treated differently — and it only changes **visual layout**, not code path.

**Examples:**
- Sidebar collapses to drawer on `< 768px`
- Tables become scrollable on mobile
- Bottom nav appears on mobile

**None of these change which controller is called or which SQL is executed.**

---

## 8. ROUTER.PHP CONTENT

`router.php` is a simple path matcher:

```php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// match path to controller
```

**No UA, no device flags, no mobile prefix.**

---

## 9. CONCLUSION

| Question | Answer |
|----------|--------|
| Is there a `/m/` mobile subdomain? | **No** |
| Is there a `?mobile=1` query param? | **No** |
| Is there a mobile-only controller? | **No** |
| Is there a mobile-only layout? | **No** |
| Is there a mobile-only view template? | **No** |
| Is there UA sniffing? | **No** |
| Is there a device-specific session? | **No** |
| Is there a mobile-only API endpoint? | **No** |

**The application has exactly ONE code path per route, regardless of device.**

---

## 10. RECOMMENDATION

Because there is no mobile-specific code:
- **There is no mobile-specific bug to fix.**
- All "mobile internal errors" are symptoms of the SAME underlying issue: schema mismatch.
- The fix is universal: run migrations.
- Optional P2 improvement: add a defensive `try/catch` in each controller that returns an empty state instead of the generic error message.

---
