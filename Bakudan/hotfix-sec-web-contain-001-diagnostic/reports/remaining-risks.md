# Remaining Risks — dashboard.bakudanramen.com
**Date:** 2026-05-20

---

## Updated After Stabilization Pass

| Risk | Status | Note |
|---|---|---|
| Authenticated browser profiling | Remaining | Requires a valid production/local authenticated session to collect Lighthouse, heap snapshots, and real Web Vitals for protected pages |
| WebSocket-specific testing | Not applicable/currently unverified | This PHP MVC repo does not expose a websocket client in the audited source; realtime behavior appears polling/API based |
| Full API load with database bottleneck metrics | Remaining | Requires seeded DB and authenticated cookie; script can now run local transport checks and production authenticated checks |
| Frontend error telemetry storage | Basic implementation | Logs bounded JSONL to `logs/errors/frontend-errors.log`; production alerting/rotation should be added |
| CSRF on telemetry endpoint | Accepted low risk | Endpoint is write-only, bounded to 8KB, no DB dependency, and stores hashed IP/user-agent for observability |

---

## Risk: MEDIUM

### R-01 — SQL indexes may be missing on hot columns
- **Affected:** `tasks.assignee_id`, `tasks.due_date`, `tasks.status`, `bills.due_date`
- **Impact:** Full table scans as data grows
- **Detect:** `EXPLAIN SELECT * FROM tasks WHERE assignee_id=? AND due_date<?`
- **Fix:** `ALTER TABLE tasks ADD INDEX idx_assignee_due (assignee_id, due_date, is_completed);`

### R-02 — Shared hosting resource limits
- DreamHost shared hosting can kill PHP processes that exceed memory/CPU
- **Symptom:** 500 errors under load, random timeouts
- **Mitigation:** Query consolidation (done), session write-close (done)
- **Recommendation:** Consider upgrading to VPS if traffic grows

### ~~R-03 — No HTTP security headers~~ ✅ FIXED (commit `2de246c`)
- Added to `.htaccess`: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- Also added `Options -Indexes` to block directory listing on `/controllers/` etc.

---

## Risk: LOW

### R-04 — No rate limiting on auth endpoints
- `/login` POST has no brute-force protection
- **Fix:** Add IP-based attempt counter in session or DB

### R-05 — Error messages may expose internal paths
- The new global error handler shows `$e->getMessage()` to users
- PHP errors may include file paths
- **Fix:** In production, show generic message; log full details only
- **Current state:** Error handler strips base path prefix (mitigated)

### R-06 — N+1 queries in penalty/bill views  
- Iterating records and querying inside foreach
- **Impact:** O(n) DB calls — slow with 100+ bills
- **Fix:** Batch load with JOIN or WHERE IN()

### R-07 — No CSRF on some API endpoints
- Some internal API calls rely on session auth only (no CSRF token)
- **Impact:** CSRF attack requires authenticated session
- **Fix:** Add `X-CSRF-Token` header check to state-changing APIs

---

## Monitoring Recommendations

1. Set up error alert: watch `logs/errors/php-errors.log` for new entries
2. Run `./scripts/stress-test.sh` after every deploy
3. Check GitHub Actions deploy status after each push
4. Monthly: run `EXPLAIN` on slow queries

---

## Refactor Recommendations (Long-term)

| Area | Recommendation | Effort |
|------|---------------|--------|
| DB queries | Add Repository pattern / query builder | High |
| Error handling | Centralize in middleware | Medium |
| JS | Bundle with esbuild/Vite | Medium |
| Notifications | Replace polling with SSE | Medium |
| Testing | Add PHPUnit unit tests for models | High |
