# Performance / Load Testing

k6-based load tests for the TaskFlow dashboard.  
**Target: staging environment only — never run against production.**

---

## Prerequisites

```bash
# Install k6 (Linux)
sudo gpg -k
sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# macOS
brew install k6
```

---

## Pre-test checklist (run once before any test)

### 1. Seed staging database

Create at least **2 projects** and **10–20 tasks** assigned to the test users.
Export the seeded IDs:

```bash
export TEST_PROJECT_IDS="3,4,5"    # real project IDs in staging DB
export TEST_TASK_IDS="10,11,12,13,14,15,16,17,18,19"
```

### 2. Create test accounts on staging

| Role    | Purpose                             |
|---------|-------------------------------------|
| staff   | Regular user flows (my-tasks, etc.) |
| admin   | Overview, team, penalty routes      |

### 3. Enable MySQL slow query log (on the staging DB server)

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.5;        -- log queries > 500 ms
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';
```

### 4. Set `SKIP_SCHEMA_CHECKS=1` on staging

In the staging web server environment or `.env`:

```
SKIP_SCHEMA_CHECKS=1
```

This stops Task and Project models from running INFORMATION_SCHEMA queries
on every request — a known bottleneck under concurrent load.
Run all SQL migrations first (`sql/schema_v*.sql`) before enabling this flag.

### 5. Disable real email sending

Set `MAIL_DRIVER=log` or equivalent so the email queue doesn't fire real SMTP
during the test. The email_queue table will still accumulate rows — that's
intentional, as it exercises the write path.

---

## Environment variables

| Variable                  | Required | Example                                        |
|---------------------------|----------|------------------------------------------------|
| `BASE_URL`                | Yes      | `https://staging.dashboard.bakudanramen.com`   |
| `TEST_USER_EMAIL`         | Yes      | `staff@example.com`                            |
| `TEST_USER_PASSWORD`      | Yes      | `testpass123`                                  |
| `TEST_ADMIN_EMAIL`        | No       | `admin@example.com` (falls back to user)       |
| `TEST_ADMIN_PASSWORD`     | No       | `adminpass123`                                 |
| `TEST_PROJECT_IDS`        | No       | `1,2,3` (falls back if not set)                |
| `TEST_TASK_IDS`           | No       | `1,2,3,4,5` (falls back if not set)            |
| `TEST_PENALIZED_USER_ID`  | No       | `5` — user ID targeted in penalty functional tests |
| `SCENARIO`                | No       | `smoke` / `load` / `stress` (default: stress)  |

---

## Run commands

### Smoke test — 2 VUs, 30 iterations (~2 min)

Validates scripts, CSRF flow, session handling, route stability.

```bash
k6 run \
  --env BASE_URL=https://staging.dashboard.bakudanramen.com \
  --env TEST_USER_EMAIL=staff@example.com \
  --env TEST_USER_PASSWORD=testpass123 \
  --env SCENARIO=smoke \
  --out json=performance/reports/smoke-$(date +%Y%m%d-%H%M).json \
  performance/k6/mixed-flow.js
```

### Medium load test — 50 → 200 VUs (~25 min)

Finds the first degradation point.

```bash
k6 run \
  --env BASE_URL=https://staging.dashboard.bakudanramen.com \
  --env TEST_USER_EMAIL=staff@example.com \
  --env TEST_USER_PASSWORD=testpass123 \
  --env TEST_ADMIN_EMAIL=admin@example.com \
  --env TEST_ADMIN_PASSWORD=adminpass123 \
  --env TEST_PROJECT_IDS=3,4,5 \
  --env TEST_TASK_IDS=10,11,12,13,14,15 \
  --env SCENARIO=load \
  --out json=performance/reports/load-$(date +%Y%m%d-%H%M).json \
  performance/k6/mixed-flow.js
```

### Full 500-user stress test — 4 phases (~50 min)

**Only run after smoke + medium load have passed.**

```bash
k6 run \
  --env BASE_URL=https://staging.dashboard.bakudanramen.com \
  --env TEST_USER_EMAIL=staff@example.com \
  --env TEST_USER_PASSWORD=testpass123 \
  --env TEST_ADMIN_EMAIL=admin@example.com \
  --env TEST_ADMIN_PASSWORD=adminpass123 \
  --env TEST_PROJECT_IDS=3,4,5 \
  --env TEST_TASK_IDS=10,11,12,13,14,15,16,17,18,19 \
  --out json=performance/reports/stress-$(date +%Y%m%d-%H%M).json \
  performance/k6/mixed-flow.js
```

Add `--out influxdb=http://localhost:8086/k6` to stream metrics to Grafana
in real time if your staging monitoring stack supports it.

---

## Test phases (stress test)

| Phase     | Time       | VUs       | Loop target | Purpose                        |
|-----------|------------|-----------|-------------|--------------------------------|
| Warmup    | 0–5 min    | 5→25      | ~5 000      | Verify scripts + DB warmup     |
| Ramp      | 5–20 min   | 25→200    | ~20 000     | Find first degradation point   |
| Sustained | 20–35 min  | 300       | ~25 000     | Observe slow queries + memory  |
| Spike     | 35–50 min  | 300→500→0 | ~10 000     | Measure failure mode           |

---

## Traffic mix

| Scenario               | Weight | Exercises                                             |
|------------------------|--------|-------------------------------------------------------|
| A – Auth               |  12 %  | Login page, POST /login, logout                       |
| B – Dashboard          |  25 %  | /my-tasks, notifications API, calendar, projects      |
| C – Task read          |  18 %  | Project list, project detail, task detail             |
| D – Task write         |  15 %  | POST /tasks, status/priority/date API updates         |
| E – Comments           |   8 %  | POST comment, notifications read                      |
| F – Secondary          |   7 %  | /calendar, /team, /inbox, command palette             |
| G – Penalty user read  |   7 %  | GET /api/penalty/my-summary, task with penalty chip   |
| H – Penalty admin read |   5 %  | GET /admin/penalty, /api/admin/penalty/summary+detail |
| I – Penalty admin write|   3 %  | POST add/update/toggle penalty config                 |

---

## Success criteria

| Metric           | Read endpoints | Write endpoints |
|------------------|---------------|-----------------|
| p95 response     | < 2 500 ms    | < 4 000 ms      |
| p99 response     | < 5 000 ms    | < 8 000 ms      |
| Error rate       | < 1 %         | < 1 %           |
| Spike error rate | < 5 %         | < 5 %           |

---

## Collecting server-side metrics

While k6 runs, gather server metrics separately:

```bash
# MySQL slow queries (tail during test)
tail -f /var/log/mysql/slow.log | grep -A4 "Query_time"

# PHP-FPM status (if enabled in pool config)
curl http://localhost/fpm-status?full

# OS metrics every 5 seconds
vmstat 5 | tee performance/reports/vmstat-$(date +%Y%m%d-%H%M).log

# MySQL connections
watch -n5 "mysql -e 'SHOW STATUS LIKE \"%connection%\";'"
```

---

## Report location

Raw JSON output: `performance/reports/`  
Files are gitignored by default — add specific reports to git if you want
to version them.

---

## Penalty feature — functional test

Run this **before** the load test to verify business logic correctness.  
It runs as a single user (vus:1, iterations:1) and every check must pass.

### Pre-conditions

1. Create a regular user on staging whose ID you will use as `TEST_PENALIZED_USER_ID`
2. That user should have at least 2–3 overdue tasks (due date in the past, not completed)
3. The user must NOT already have a penalty_config row — or accept that the test will overwrite it

### Run command

```bash
k6 run \
  --env BASE_URL=https://staging.dashboard.bakudanramen.com \
  --env TEST_ADMIN_EMAIL=admin@example.com \
  --env TEST_ADMIN_PASSWORD=adminpass \
  --env TEST_USER_EMAIL=staff@example.com \
  --env TEST_USER_PASSWORD=staffpass \
  --env TEST_PENALIZED_USER_ID=5 \
  performance/k6/penalty-functional.js
```

### Scenarios covered

| ID  | Scenario                         | Checks                                                |
|-----|----------------------------------|-------------------------------------------------------|
| P1  | Admin adds penalty               | 200 ok, record in summary, correct amount in detail   |
| P2  | User views own penalty           | Correct fields, cannot see other users or admin routes|
| P3  | Permission restrictions          | Non-admin gets 403 on add/update/remove/toggle        |
| P4  | Admin edits penalty amount       | Updated amount appears in detail API                  |
| P5  | Admin soft-removes penalty       | is_active=0, historical record preserved in summary   |
| P6  | Calculation consistency          | total_amount = late_count × amount_per_late_task      |
| P7  | Duplicate prevention             | Second /add on same user upserts, returns ok=true     |
| P8  | Invalid input rejection          | Negative amount → 422, missing user_id → 422          |
| P9  | Re-enable after remove           | /add re-activates with is_active=1                    |
| P10 | Unauthenticated access blocked   | Admin page + APIs return 401/403 without session      |

### Edge cases requiring manual DB verification

These cannot be fully automated via HTTP alone — document findings manually:

| Edge case | How to test |
|-----------|-------------|
| Task overdue < 1 day | Set task due_date = yesterday 23:59 VN time; verify late_days = 1 |
| Task completed exactly on deadline | Set completed_at = due_date 23:59; penalty should NOT appear |
| Task completed just after deadline | Set completed_at = due_date + 1 day; penalty should appear |
| Due date extended after penalty exists | Update due_date past today; run cron.php; verify syncLog deletes stale row |
| Task reassigned to another user | Update assignee_id; verify penalty follows new assignee |
| Timezone boundary (midnight VN) | Test at 23:58–00:02 VN time; verify due_date boundary is evaluated in +07:00 |

---

## Known bottlenecks (pre-test findings)

These are expected to appear as test load increases:

1. **Runtime schema checks** — `Task::ensureSchema()` runs on every request
   hitting INFORMATION_SCHEMA under concurrent load.
   Fix: set `SKIP_SCHEMA_CHECKS=1` (already implemented).

2. **Dashboard aggregate queries** — `/my-tasks` and `/overview` fire multiple
   COUNT/GROUP BY queries in one request. Under 200+ VUs these will show
   p95 > 2 500 ms first.

3. **Session locking** — PHP session file locking may queue requests from the
   same VU. Mitigation: ensure `session_write_close()` is called early on
   read-only routes.

4. **Write amplification** — each comment/task create triggers notification
   rows + email queue rows. Under 100+ concurrent writers the email_queue
   table becomes a hot write target.

5. **MySQL connection pool** — the app opens one PDO connection per PHP
   worker. Under 500 VUs with a shared host (limited workers) the
   queue at the web-server level will be the first hard ceiling.

6. **Penalty `getAllSummaries()` under load** — calls `calcUserPenalty()` for
   every penalized user in a loop, each firing a `getLateTasks()` query.
   Under load with many penalized users this can be a slow sequential N+1 query.
   Watch `/api/admin/penalty/summary` response times at 200+ VUs.
   Recommendation: cache the summary result for 60 seconds in APCu or Redis.

---

## Engineering recommendations — penalty module

### Immediate (before load test)

1. **Index `tasks.due_date + assignee_id`** — `getLateTasks()` queries on both columns.
   Add: `CREATE INDEX idx_tasks_assignee_due ON tasks(assignee_id, due_date, is_completed);`
   This replaces two single-column indexes with one covering index for the penalty query.

2. **`getAllSummaries()` N+1 pattern** — loops over every penalized user and fires
   one `getLateTasks()` query per user. Under 500 VUs with 20+ penalized users =
   10,000+ queries/sec just for the admin summary page. Cache or rewrite as a
   single SQL query with aggregation.

### Medium priority

3. **Audit log missing** — penalty add/edit/remove actions are not logged to
   `activity_log`. Under audit/compliance requirements, add an audit trail:
   who changed what amount, when, and for which user.

4. **Penalty total in dashboard widget** — the dashboard reads `getUserDetail()`
   for the current user every page load. This fires a `getLateTasks()` query
   even for users with 0 late tasks. Gate it behind `isUserPenalized()` first
   (already in PenaltyController) — confirm `DashboardController` uses the same guard.

5. **`syncAllLogs()` in cron** — runs `getLateTasks()` for every active penalized
   user. If this grows to 50+ users, the hourly cron run could take 5–10 seconds
   of sequential DB queries. Monitor cron log for `penalty_sync` line timing.

### Architecture for future scaling

6. **Realtime vs. cached calculation** — currently every `getUserDetail()` call
   fires live queries. At scale, consider materializing totals in `penalty_config`
   (`cached_total`, `cache_valid_until`) and refreshing via cron only.

7. **Penalty status field** — current model has only `is_active` (active/inactive).
   The CEO spec mentions waived, paid, resolved states. A `status` ENUM column
   in `penalty_config` would support this cleanly without a schema change later.
