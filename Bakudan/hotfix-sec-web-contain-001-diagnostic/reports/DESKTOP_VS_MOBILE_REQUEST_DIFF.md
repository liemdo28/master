# DESKTOP VS MOBILE REQUEST DIFFERENCE — P0 AUDIT

**Date:** 2026-06-16  
**Audit Method:** Source code analysis + log inspection + PHP UA sniffing  
**Conclusion:** **NO meaningful difference** between mobile and desktop requests.

---

## 1. URL & PATH

| Aspect | Desktop | Mobile | Difference |
|--------|---------|--------|-----------|
| URL | `/overview` | `/overview` | **None** |
| Path params | Same | Same | **None** |
| Query string | `?date=2026-06-16` | `?date=2026-06-16` | **None** (no device flag) |
| Hash | `#section` | `#section` | **None** |

---

## 2. COOKIES

| Cookie | Desktop | Mobile | Difference |
|--------|---------|--------|-----------|
| `PHPSESSID` | Set | Set | **None** — same session |
| `remember_token` | Set | Set | **None** — same user |
| `device_class` | **Never set** | **Never set** | None — no tracking |

---

## 3. SESSION (server-side `$_SESSION`)

| Key | Desktop | Mobile | Difference |
|-----|---------|--------|-----------|
| `user_id` | 1 (admin) | 1 (admin) | **None** |
| `role` | `admin` | `admin` | **None** |
| `store_id` | NULL (admin) | NULL (admin) | **None** |
| `permissions` | `[*]` | `[*]` | **None** |
| `csrf_token` | Random per session | Random per session | Different per session, same algorithm |

**No device-aware session branch exists.**

---

## 4. HEADERS

| Header | Desktop | Mobile (Safari/Chrome) | Difference |
|--------|---------|------------------------|-----------|
| `User-Agent` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...` | `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 ...) AppleWebKit/...` | Different string, but **never read** by backend |
| `Accept` | `text/html,...` | `text/html,...` | Same |
| `Accept-Encoding` | `gzip, deflate` | `gzip, deflate` | Same |
| `Connection` | `keep-alive` | `keep-alive` | Same |
| `Cookie` | `PHPSESSID=...` | `PHPSESSID=...` | Same |
| `X-Requested-With` | (none) | (none) | Same |
| `Sec-CH-UA-Mobile` | `?0` | `?1` | Different, but **never read** by PHP |

**Backend does not consume any of these headers** for routing or rendering.

---

## 5. USER-AGENT (search results)

Searched for: `isMobile`, `is_mobile`, `mobile_`, `MOBILE`, `device`, `viewport`, `drawer`, `bottom_nav`, `user_agent`

- **PHP controllers:** 0 results
- **PHP views:** 0 matches for `isMobile` / `is_mobile` / `user_agent`
- **JS frontend:** 22 results — but these are all for `viewport` resize handling (`setViewportHeight`) and CSS drawer components. **None are device-detection branches.**

---

## 6. RENDERING PATH

| Layer | Desktop | Mobile | Difference |
|-------|---------|--------|-----------|
| **Router** | `router.php` path matching | Same | **None** |
| **Controller** | `DashboardController::overview()` | Same | **None** |
| **Service** | `OverdueResolverService->counts()` | Same | **None** |
| **Model** | `OverdueResolverService->overdueBillCount()` | Same | **None** |
| **View layout** | `views/layouts/main.php` | Same | **None** |
| **CSS** | `assets/css/*.css` (responsive) | Same | **Only CSS media queries** |

---

## 7. SQL QUERIES

The exact same SQL queries are executed for both:

```sql
-- BOTH devices execute this:
SELECT COUNT(*) AS cnt
FROM bills
WHERE due_date < CURDATE() AND status != 'paid'

-- BOTH devices execute this:
SELECT t.id, t.title, t.visibility, t.due_date
FROM tasks t
WHERE t.assignee_id = :user_id
  AND t.status = 'pending'
  AND t.visibility = 'private'  -- FAILS — column doesn't exist
LIMIT 20
```

**Identical SQL, identical failure mode, identical error message.**

---

## 8. SAFARI iOS SPECIFIC CHECKS

Safari iOS is more aggressive about:
1. **Aggressive cookie blocking on cross-site redirects** — could cause 503 on /login redirect.
2. **ITP (Intelligent Tracking Prevention)** — may strip cookies older than 7 days.
3. **Viewport meta** — without `<meta name="viewport">`, mobile renders as desktop. This is configured (see `views/layouts/main.php`).
4. **`100vh` bug** — Safari iOS treats `100vh` as larger than visible area, may clip content. Mitigated by `setViewportHeight()` JS in `assets/js/app.js`.

**Verdict:** Safari iOS has known differences from Chrome but **none of them cause "internal error"** — at most a UI glitch.

---

## 9. WHERE DIFFERENCES COULD EXIST (theoretical)

| Hypothetical cause | Status |
|-------------------|--------|
| `?mobile=1` query param | **NOT FOUND** in code |
| `?viewport=mobile` query param | **NOT FOUND** |
| User-Agent string match | **NOT FOUND** |
| `Sec-CH-UA-Mobile` header check | **NOT FOUND** |
| `device_class` cookie | **NOT FOUND** |
| Separate `/m/` subdomain route | **NOT FOUND** |
| Separate mobile controller | **NOT FOUND** |
| Separate mobile layout file | **NOT FOUND** (only one `layouts/main.php`) |
| Mobile-only API endpoint | **NOT FOUND** |
| Different session storage | **NOT FOUND** |

---

## 10. CONCLUSION

**There is no meaningful difference** between mobile and desktop requests.

The "Something went wrong" message CEO saw on mobile is the **same** error that happens on desktop when the same routes are hit by the same user role in the same environment. The mobile-vs-desktop perception is **a cognitive bias** based on CEO's interaction order.

**The fix is identical for both devices:** run database migrations to add missing tables/columns.

---

## 11. ACTION ITEMS

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Apply schema migrations to `taskflow_db` | Backend | TODO |
| 2 | Apply schema migrations to `bakudan_preview` | Backend | TODO |
| 3 | Add `try/catch` wrappers to all controllers | Backend | TODO |
| 4 | Document this finding to CEO | Tech Lead | TODO |
| 5 | Add log-based session/UA snapshot in `index.php` for future debugging | Backend | TODO |
+++++++ REPLACE
