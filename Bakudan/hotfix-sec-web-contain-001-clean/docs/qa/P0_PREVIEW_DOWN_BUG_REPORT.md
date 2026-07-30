# P0 BUG REPORT — Preview Environment Completely Down

| Field | Value |
|-------|-------|
| **Severity** | P0 — Site Down |
| **Status** | OPEN |
| **Detected** | 2026-06-03 10:01 ICT |
| **Reporter** | Automated QA (DEV 2) |
| **Environment** | https://preview.dashboard.bakudanramen.com |
| **Affects** | ALL pages — entire preview site returns 500 |

---

## Summary

The **entire preview environment** is returning HTTP 500 errors on every page request. The root cause is a missing PHP file (`models/Section.php`) on the server that is required by the front controller (`index.php`).

## Root Cause

```
Failed opening required '/home/liemdo0208/phase11-preview/models/Section.php'
(include_path='.:/usr/share/php')
```

**`index.php` line** loads `models/Section.php` via `require_once`:
```php
require_once __DIR__ . '/models/Section.php';
```

Since `index.php` is the front controller for all routes, **every page** — including `/login`, `/dashboard`, `/logout`, and even the deploy endpoint — crashes before any application logic runs.

## Evidence

### Artifacts collected:
- **Screenshot**: `qa/artifacts/test-results/00-auth-setup-authenticate-and-save-session-auth-setup/test-failed-1.png`
- **Video**: `qa/artifacts/test-results/00-auth-setup-authenticate-and-save-session-auth-setup/video.webm`
- **Trace**: `qa/artifacts/test-results/00-auth-setup-authenticate-and-save-session-auth-setup/trace.zip`
- **Error Context**: `qa/artifacts/test-results/00-auth-setup-authenticate-and-save-session-auth-setup/error-context.md`

### Curl verification:
```bash
$ curl -s "https://preview.dashboard.bakudanramen.com/login"
→ <title>Something went wrong</title>
→ Failed opening required '.../models/Section.php'

$ curl -s "https://preview.dashboard.bakudanramen.com/"
→ <title>Something went wrong</title>
→ (same 500 error)

$ curl -s "https://preview.dashboard.bakudanramen.com/deploy_preview.php?key=preview-deploy-2026"
→ <title>Something went wrong</title>
→ (deploy endpoint also broken — likely missing from server or .htaccess outdated)
```

### Git verification:
```
$ git log --oneline -1 -- models/Section.php
a466f35 fix: add preview DB section repair script (SQLSTATE 23000)

$ git branch -r --contains a466f35
origin/HEAD -> origin/main
origin/main
```

**File exists in `origin/main` but was never deployed to the server.**

## Why self-healing failed

1. **`deploy_preview.php`** (web-based deploy) — Also returns 500 because the `.htaccess` pass-through rule expects the file to exist on disk, but if the server's git working copy is too old, the file doesn't exist and the request falls through to `index.php` → crash.

2. **SSH access** — Connection to `pdx1-shared-a3-05.dreamhost.com:22` times out from current network. Cannot run `git pull` on the server.

3. **Git push to dreamhost remote** — Same SSH timeout issue.

## Impact

| QA Test | Status | Blocked By |
|---------|--------|------------|
| 1. Login / auto-login | ❌ BLOCKED | 500 on /login |
| 2. Dashboard loads | ❌ BLOCKED | 500 on / |
| 3. /tasks loads | ❌ BLOCKED | 500 on all routes |
| 4. Create task | ❌ BLOCKED | 500 on all routes |
| 5. Save task | ❌ BLOCKED | 500 on all routes |
| 6. Reload task | ❌ BLOCKED | 500 on all routes |
| 7. Submit for review | ❌ BLOCKED | 500 on all routes |
| 8. Reviewer approve/reject | ❌ BLOCKED | 500 on all routes |
| 9. Approver accept | ❌ BLOCKED | 500 on all routes |
| 10. Attachments | ❌ BLOCKED | 500 on all routes |
| 11. Comments + @mentions | ❌ BLOCKED | 500 on all routes |
| 12. Notifications | ❌ BLOCKED | 500 on all routes |

**0 of 12 QA tests can run. QA is fully blocked.**

## Fix Required

### Option A (fastest — needs SSH access):
```bash
ssh liemdo0208@pdx1-shared-a3-05.dreamhost.com
cd /home/liemdo0208/phase11-preview
git fetch origin main
git reset --hard origin/main
```

### Option B (if SSH is unavailable from current network):
1. Use Dreamhost web panel to access Shell/Terminal
2. Or use a different network/VPN that allows SSH to port 22
3. Run the same git commands above

### Option C (emergency — manual file upload):
1. Upload `models/Section.php` via Dreamhost File Manager (web panel)
2. This is a band-aid — a full `git reset --hard origin/main` is recommended

## Post-Fix

After the server is restored:
1. Verify: `curl -s https://preview.dashboard.bakudanramen.com/login | grep "form"`
2. Re-run QA: `npm run qa`
3. Run DB health check: `GET /preview_db_health.php?token=PREVIEW_HEALTH_2026`

---

**QA STOPPED per protocol. No further tests attempted. No features built. Production untouched.**
