# TaskFlow — QA Evidence Package

> **Standard**: No proof → no acceptance. No walkthrough → no trust.

---

## Test Environment

| Item | Value |
|---|---|
| Production URL | https://dashboard.bakudanramen.com |
| Database | `taskflow_db` on cachero.pdx1-mysql-a7-9b.dreamhost.com |
| Server | pdx1-shared-a3-05.dreamhost.com (DreamHost shared) |
| PHP | 8.x |
| Cron | Daily via cPanel, also triggerable via HTTP |
| Mobile | Flutter app (Android APK) |

---

## Roles Tested

| Role | Landing Page | Access Scope |
|---|---|---|
| `admin` | `/overview` | All data, all projects, all users |
| `ceo` | `/overview` | Same as admin (super-role) |
| `manager` | `/overview` | Team, projects, bills (no system admin) |
| `member` / `staff` | `/my-tasks` | Own tasks only |

---

## Test Scope

### Critical Flows (must pass)

| # | Flow | Endpoint(s) |
|---|---|---|
| CF-01 | Login → get token | `POST /api/v1/auth/login` |
| CF-02 | Focus feed loads | `GET /api/v1/focus` |
| CF-03 | Decision feed filtered by role | `GET /api/v1/focus/decisions` |
| CF-04 | Risk snapshot current | `GET /api/v1/focus/risk` |
| CF-05 | Approval queue pending | `GET /api/v1/focus/approvals` |
| CF-06 | Approve / reject decision | `POST /api/v1/focus/approvals/{id}/resolve` |
| CF-07 | Dashboard summary w/ assignee names | `GET /api/v1/dashboard/summary` |
| CF-08 | Projects visible for admin | `GET /api/v1/projects` |
| CF-09 | Task list | `GET /api/v1/tasks` |
| CF-10 | Bills list | `GET /api/v1/bills` |
| CF-11 | Cron pipeline completes | `GET /cron.php?key=taskflow-cron-2024-secret` |
| CF-12 | Risk score recomputes after cron | DB: `risk_snapshots` latest row |
| CF-13 | Decision feed refreshes after cron | DB: `decision_feed` `is_active=1` |
| CF-14 | Activity feed logs cron run | `GET /api/v1/focus/activity` |
| CF-15 | Session cleanup runs | DB: `api_tokens` revoked count |

---

## How to Run Tests

### Option A — Postman

1. Import `postman/TaskFlow-QA.postman_collection.json`
2. Set environment variable `BASE_URL = https://dashboard.bakudanramen.com`
3. Run **Auth / Login** first → token auto-saved to `{{token}}`
4. Run collection in order: Auth → Focus → Tasks → Finance → Approvals → Cron

### Option B — SQL Verification

```bash
# Connect to DB via DreamHost phpMyAdmin or MySQL CLI
mysql -h cachero.pdx1-mysql-a7-9b.dreamhost.com -u [user] -p taskflow_db
source qa/scripts/verify-db.sql
```

### Option C — Cron Test

```bash
bash qa/scripts/test-cron.sh
```

### Option D — Browser (manual QA)

Follow the scene-by-scene script in `videos/WALKTHROUGH_SCRIPT.md`

---

## Endpoint → Test Case Mapping

| Endpoint | Test Case | Expected |
|---|---|---|
| `POST /api/v1/auth/login` | CF-01 | HTTP 200, `access_token` in response |
| `GET /api/v1/focus` | CF-02 | `risk_chips` array, `top_decisions` array |
| `GET /api/v1/focus/decisions` | CF-03 | Filtered by role, `count` >= 0 |
| `GET /api/v1/focus/risk` | CF-04 | `unified_risk_score` numeric |
| `GET /api/v1/focus/activity` | CF-14 | Recent `cron_run` event present |
| `GET /api/v1/focus/approvals` | CF-05 | `approvals` array |
| `POST /api/v1/focus/approvals/{id}/resolve` | CF-06 | HTTP 200, status updated |
| `GET /api/v1/dashboard/summary` | CF-07 | `recent_tasks[*].assignee_name` not null |
| `GET /api/v1/projects` | CF-08 | All projects returned for admin |
| `GET /cron.php?key=...` | CF-11 | Line starts with `OK \|` |

---

## Known Issues / Limitations

| ID | Description | Status | Workaround |
|---|---|---|---|
| KI-01 | Existing DB notifications have Vietnamese titles (created before i18n fix) | Won't fix retroactively | Future notifications use `t()` |
| KI-02 | `ceo` route deprecated → redirects to `/overview` | By design | Use `/overview` directly |
| KI-03 | Mobile push queue (`mobile_push_queue`) requires FCM token | Not yet integrated | Queue populates, dispatch pending |
| KI-04 | `stale_after` in risk snapshot is 65 min — snapshot may show stale between cron runs | By design | Recomputes each cron cycle |

---

## Evidence Location

```
qa/evidence/
  api/        ← Postman run exports (JSON)
  db/         ← SQL query screenshots or CSV exports
  ui/         ← Browser screenshots
  videos/     ← Screen recording files
```

---

## Sign-off

> QA is valid only when all CF-01 through CF-15 pass with evidence attached.
