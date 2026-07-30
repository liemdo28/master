# P0 — PREVIEW RUNTIME FAILURE: models/Section.php

**Severity:** P0 — Complete Runtime Crash  
**Date:** 2026-06-03  
**Reporter:** Playwright Automation  
**Status:** Root Cause Identified — Awaiting Server-Side Verification

---

## Symptom

Playwright navigates to `/login` and expects `<input name="email">`.  
Instead, the page renders a fatal error:

```
Something went wrong

Failed opening required '/home/liemdo208/phase11-preview/models/Section.php'
```

Login page **never renders**. This is NOT a login failure — it is a runtime crash.

---

## Root Cause Analysis

### 1. The Require Chain

`index.php` (line 84) executes before ANY route logic:

```php
require_once __DIR__ . '/models/Section.php';
```

This is a **hard require** — if the file is missing, PHP emits a fatal error and stops execution.  
No route, no login form, no page of any kind will render.

### 2. File Status — LOCAL

| Check | Result |
|-------|--------|
| `models/Section.php` exists locally | ✅ YES |
| Tracked in git | ✅ `git ls-files` confirms |
| File size | 117 lines, valid PHP class |
| Class defined | `class Section` with `normalizeSectionId()` |

### 3. File Status — PREVIEW SERVER

The error path shows:
```
/home/liemdo208/phase11-preview/models/Section.php
```

**Hypothesis A — File not deployed:**  
`deploy_preview.php` performs `git reset --hard origin/main` but its post-deploy verification list did NOT include `models/Section.php`. If the reset failed silently or partially, the missing file would go undetected.

**Hypothesis B — Path/case mismatch:**  
Linux is case-sensitive. If any process created `section.php` instead of `Section.php`, the require fails.

**Hypothesis C — Stale deployment artifact:**  
The preview might be running from a cached/old release that predates when `Section.php` was added to the repo.

### 4. Autoload Path

**No autoload mechanism exists.** No `spl_autoload_register`, no Composer autoload, no PSR-4.  
This project uses explicit `require_once` for all dependencies.  
If a file is missing from the filesystem, there is zero fallback — PHP fatal error guaranteed.

### 5. References to Section.php in Codebase

| File | Line | Type |
|------|------|------|
| `index.php` | 84 | `require_once __DIR__ . '/models/Section.php'` |
| `controllers/api/v1/TaskApiController.php` | — | `require_once __DIR__ . '/../../../models/Section.php'` |
| `deploy.php` | — | Listed in post-deploy diagnostics |
| `ping.php` | — | `file_exists()` check only |

---

## Immediate Fix Actions

### Action 1: Re-deploy preview

```bash
# SSH into preview server
ssh liemdo0208@pdx1-shared-a3-05.dreamhost.com

# Navigate to preview root
cd /home/liemdo208/phase11-preview/

# Fetch and hard reset
git fetch origin main
git reset --hard origin/main

# Verify Section.php exists
ls -la models/Section.php
```

### Action 2: Verify case sensitivity

```bash
ls models/ | grep -i section
# Must show exactly: Section.php (capital S)
```

### Action 3: Run deploy_preview.php (updated)

```
GET /deploy_preview.php?key=preview-deploy-2026
```

The updated `deploy_preview.php` now verifies `models/Section.php` in its post-deploy checklist.

### Action 4: Verify fix

```
GET /login
```

Expected: Login form renders with `<input name="email">`.

---

## Preventive Fix Applied

`deploy_preview.php` verification list has been expanded to include:

- `models/Section.php`
- `models/User.php`
- `models/Task.php`
- `models/Project.php`
- `controllers/AuthController.php`
- `views/auth/login.php`

Any missing file will now be reported as `✗ MISSING` in deploy output.

---

## Deployment Architecture Note

| Component | Path |
|-----------|------|
| Git remote (Dreamhost) | `ssh://liemdo0208@pdx1-shared-a3-05.dreamhost.com/home/liemdo0208/repo/dashboard.git` |
| Preview runtime | `/home/liemdo208/phase11-preview/` |
| Production runtime | (separate) |
| Deploy mechanism | `git reset --hard origin/main` via PHP exec |

**Note:** The Dreamhost SSH user is `liemdo0208` but the preview path shows `/home/liemdo208/`. Verify this is correct or if there's a user/path mismatch.

---

## Conclusion

| Item | Status |
|------|--------|
| Root cause | `models/Section.php` missing on preview server filesystem |
| Local source | ✅ File exists, tracked, valid |
| Deploy script | ✅ Fixed — now verifies critical models |
| Server-side fix | ⏳ Requires SSH access to re-deploy |
| Login test | ⏳ Blocked until Section.php is present |

**Priority:** This blocks ALL functionality. No page renders until this file exists on the preview server.
