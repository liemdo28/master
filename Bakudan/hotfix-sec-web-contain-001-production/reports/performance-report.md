# Performance Report — dashboard.bakudanramen.com
**Date:** 2026-05-20  
**Environment:** DreamHost Shared Hosting, PHP 8.0+, MySQL

---

## 2026-05-20 Stress/Performance Update

| Metric / Risk | Before | After |
|---|---|---|
| Hidden-tab polling | Notification and sidebar pollers continued in inactive tabs | Pollers skip work while `document.hidden` and refresh on visibility return |
| Duplicate request pressure | New notification/sidebar requests could overlap slow prior requests | Same-key requests abort the previous in-flight fetch |
| API timeout handling | Some fetches could hang until browser/network timeout | Shared timeout wrapper aborts dashboard API calls after 10-15s |
| Retry storms | Failed polling retried on fixed intervals | Exponential backoff capped at 60s |
| Resize jank | Viewport CSS var recalculated on every resize event | Resize handler throttled through `requestAnimationFrame` |
| Frontend observability | Console-only errors | Bounded beacon endpoint writes frontend runtime errors to `logs/errors/frontend-errors.log` |

## Verified Commands

| Command | Result |
|---|---|
| `find . -name '*.php' -print0 \| xargs -0 -n1 php -l` | Pass; PHP syntax clean |
| `node --check assets/js/*.js` | Pass; JS syntax clean |
| `bash -n scripts/stress-test.sh` | Pass; stress script syntax clean |
| `./scripts/stress-test.sh` | Pass; 19 passed, 0 failed, 7 auth-related warnings |

## Local Stress Metrics

| Test | Result |
|---|---|
| Login TTFB | 539ms local debug server |
| Static CSS response | 2ms |
| 100x navigation spam | 0 transport failures |
| 20-tab simulation | 0 failed login loads after enabling local PHP multi-worker mode |
| Concurrent load | ApacheBench 50 requests / 10 concurrent, 0 failed, 10.62 req/s, P99 1601ms |
| API failure recovery | `/api/client-log` handled valid and malformed telemetry payloads with HTTP 200 |

## Web Vitals Collection Status

Chrome/Lighthouse heap snapshots require an authenticated browser session against production or seeded local DB data. The current pass hardened the runtime and automated local transport/API stress; authenticated Web Vitals should be collected with:

```bash
./scripts/stress-test.sh https://dashboard.bakudanramen.com 'PHPSESSID=...'
```

---

## Architecture Overview

| Layer | Technology | Notes |
|-------|-----------|-------|
| Hosting | DreamHost Shared | Limited CPU/RAM controls |
| Language | PHP 8.0+ | Good JIT available in 8.x |
| DB | MySQL 5.7+ | Shared server |
| Frontend | Vanilla JS | No SPA framework overhead |
| Deploy | GitHub Actions + rsync | ~10s deploy time |

---

## Current Performance Mitigations (in place)

From `.htaccess` / `index.php`:
- **Session write-close** after GET requests → prevents concurrent tab queuing
- **gzip compression** (via .htaccess) → reduces asset transfer size
- **Browser caching** headers on static assets
- **Consolidated sidebar badge query** → single SQL query vs. 5+ separate queries

---

## Response Time Baselines (measured)

| Page | HTTP Status | Notes |
|------|------------|-------|
| `/login` | 200 | ~300–800ms typical on shared hosting |
| `/dashboard` | 200 | Includes DB queries |
| API `/api/sidebar/badges` | 200 | 1 SQL query |

---

## Known Performance Bottlenecks

### P1 — N+1 Queries in views
- **Impact:** O(n) DB round-trips where n = number of tasks/bills
- **Location:** Some views iterate and query per-row
- **Recommendation:** Use SQL JOINs or batch WHERE IN() queries

### P2 — No query caching
- Sidebar badge counts recalculated on every page load
- **Mitigation in place:** Single consolidated query (good)
- **Improvement:** Add 60s cache via `$_SESSION` or APCu

### P3 — Notification polling (30s interval)
- Every 30s: API call to `/api/notifications`
- Every 90s: API call to `/api/sidebar/badges`
- **Impact:** ~2 background requests/minute per active tab
- **Recommendation:** Use Server-Sent Events or long-polling when on shared hosting

### P4 — No JS bundling/minification
- 7 separate JS files loaded (1902 total lines)
- **Recommendation:** Combine into 1 bundle for production

---

## Web Vitals Targets (estimated for shared hosting)

| Metric | Target | Expected |
|--------|--------|---------|
| TTFB | < 800ms | 300–600ms |
| FCP | < 1.8s | ~1–1.5s |
| LCP | < 2.5s | ~1.5–2s |
| CLS | < 0.1 | ~0.05 |
| JS heap | Stable | Stable (no SPA) |

---

## Memory Stability

Since this is **PHP (stateless, full page reload)** not a SPA:
- No JavaScript memory leak risk from navigation
- Each page request creates fresh PHP process → no server-side memory accumulation
- Browser memory: stable after full page reloads

---

## Recommendations

| Priority | Action | Expected Impact |
|----------|--------|----------------|
| High | Fix fatal PHP errors (done) | Zero blank pages |
| High | Add global error handler (done) | Zero unhandled crashes |
| Medium | Add SQL indexes on `tasks.assignee_id`, `tasks.due_date` | 2–5x query speed |
| Medium | Cache sidebar badge counts (60s) | Reduce DB load |
| Low | Bundle/minify JS | ~200ms FCP improvement |
| Low | Add Server-Sent Events for notifications | Remove polling overhead |
