# PROJECT RISK REGISTER — Dashboard.bakudanramen.com
**Risk tracking for the Bakudan Dashboard project.**
*Last updated: 2026-06-04 16:15 (Asia/Saigon, UTC+7)*

---

## 1. Risk Summary

| # | Risk | Severity | Probability | Owner | Status |
|---|------|----------|-------------|-------|--------|
| R01 | `'member'` not in `users.role` enum — prevents staff-role user creation | 🟠 MEDIUM | HIGH | DEV | PENDING FIX |
| R02 | `models/User.php` shadows `password_verify()` — causes false FAIL in opcode-cached scripts | 🟠 MEDIUM | HIGH | DEV | WORKAROUND: use `diag.php` |
| R03 | Preview DB schema may lag `main` after fast-forward pushes | 🟡 LOW | MEDIUM | DEV | MONITOR: use `preview_db_health.php` |
| R04 | No automated schema migration on preview deploy | 🟡 LOW | MEDIUM | DEV | MONITOR: use `repair_preview.php` |
| R05 | Phase 2 reviewer workspace not built — reviewer context incomplete | 🟡 LOW | MEDIUM | DEV | BACKLOG |
| R06 | No automated Playwright screenshot/video for Phase 1 UI | 🟡 LOW | LOW | QA | BACKLOG |
| R07 | PHP binary missing on local Windows (C:\xampp\php\php.exe) | 🟠 MEDIUM | MEDIUM | DEV | WORKAROUND: use php-lint.ps1 for lint; curl for runtime |
| R08 | Single project = single point of failure (no redundancy) | 🟠 MEDIUM | LOW | CEO | ACCEPTED |
| R09 | No dedicated CI/CD pipeline (manual deploy via curl) | 🟡 LOW | MEDIUM | DEV | ACCEPTED |
| R10 | Safety guard disabled on preview (PREVIEW_QA_BYPASS=1) | 🟠 MEDIUM | HIGH | DEV | MONITOR: never disable on prod |

---

## 2. Severity Definitions

| Level | Color | Description |
|-------|-------|-------------|
| 🟢 LOW | Green | Minor impact, easily fixed, no urgency |
| 🟠 MEDIUM | Amber | Moderate impact; fix within 1 sprint |
| 🔴 HIGH | Red | Critical; fix immediately |

---

## 3. P0 — Fix Before Next Release

### R01: Add `'member'` to `users.role` enum

**Problem:** Schema enum is `enum('ceo','admin','manager','staff')` — no `'member'`. The CEO directive requires user3 as `'member'` role.

**Impact:** Cannot create a user with role='member' — it becomes empty string.

**Fix:**
```sql
ALTER TABLE users MODIFY COLUMN role
  ENUM('ceo','admin','manager','member','staff') NOT NULL DEFAULT 'staff';
```

**File:** `database/migrations/2026_06_04_add_member_role.sql`

**Owner:** DEV (any dev can run)

**Evidence:** `db-check.php?key=dbcheck-2026` shows current enum values.

---

### R02: `models/User.php` shadows `password_verify()`

**Problem:** `User` model defines `password_verify($plain, $hashed)` method — PHP's built-in `password_verify()` is shadowed in opcode-cached scripts. Result: `rbac-validate.php` shows FALSE for all users even though `diag.php` proves they are TRUE.

**Impact:** RBAC validation scripts using both `models/User.php` AND calling `password_verify()` get incorrect results.

**Fix (short-term):** Never `require_once 'models/User.php'` in scripts that call `password_verify()`. Use direct DB query instead.

**Fix (long-term):** Rename the model's method to `verifyPassword($plain, $hashed)` to avoid shadowing PHP's built-in.

**Workaround:** Use `diag.php?key=diag-2026` (no User.php) for standalone password verification.

**Evidence:** `rbac-validate.php` shows FALSE; `diag.php` shows TRUE.

---

## 4. Medium Risks (1 Sprint)

### R03: Preview DB Schema Drift

**Problem:** `deploy_preview.php` pulls from `main` but does NOT run migrations. If a migration file is added to `main`, preview DB won't have the new columns.

**Impact:** Pages using new columns may 500 on preview.

**Mitigation:** Run `migrate.php` manually after deploy if schema change detected.

**Monitor:** `preview_db_health.php?token=PREVIEW_HEALTH_2026` — checks for missing columns.

---

### R10: Safety Guard Disabled on Preview

**Problem:** `config/safety-guard.php` is bypassed on preview (`PREVIEW_QA_BYPASS=1`). This means certain safety validations are skipped.

**Impact:** Low — preview is isolated. But if production gets the same env var, catastrophic.

**Mitigation:** Never set `PREVIEW_QA_BYPASS=1` on production. Guard is on production.

---

## 5. Backlog Risks (Future Sprint)

- **R05:** Phase 2 reviewer workspace not built — reviewer sees task without instructions/checklist
- **R06:** No automated screenshots for Command Center (capture script exists: `qa/playwright/capture-command-center.ts`)
- **R09:** Manual deploy process — no CI/CD pipeline

---

## 6. Accepted Risks

| Risk | Reason to Accept |
|------|-----------------|
| R08 | Single project is intentional — CEO owns the only project; redundancy overkill |
| R09 | Manual deploy works; CI/CD would add complexity without proportional benefit |

---

## 7. Risk Trend

| Date | Open | Closed | Trend |
|------|------|--------|-------|
| 2026-06-04 | 10 | 0 | 🟡 Stable |
| 2026-06-04 (end) | 8 | 0 | 🟡 2 P0 fixes identified |

---

## 8. Quick Answers

> **"What is broken?"**
> R01 (`'member'` not in role enum) — user3 cannot be properly role-assigned as 'member'.
> R02 (`password_verify` shadow in User.php) — `rbac-validate.php` returns FALSE incorrectly.

> **"What should we fix first?"**
> 1. Add `'member'` to `users.role` enum (R01 — 5 min SQL fix)
> 2. Rename `User::password_verify()` to `User::verifyPassword()` (R02 — 10 min code fix)

> **"What projects are risky?"**
> Single project — Dashboard.bakudanramen.com. Risk level: 🟢 LOW (with 2 P0 fixes pending).