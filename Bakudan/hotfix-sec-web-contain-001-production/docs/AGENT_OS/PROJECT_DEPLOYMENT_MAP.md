# PROJECT DEPLOYMENT MAP — Dashboard.bakudanramen.com
**Complete deployment topology for the Bakudan Dashboard.**
*Last updated: 2026-06-04 16:15 (Asia/Saigon, UTC+7)*

---

## 1. Deployment Topology

```
[Local Dev]  E:\Project\Master\Bakudan\dashboard.bakudanramen.com
     │
     │  git push origin main
     ▼
[GitHub]  https://github.com/liemdo28/dashboard.bakudanramen.com (main branch)
     │
     ├──► [Preview]  https://preview.dashboard.bakudanramen.com
     │         deploy key: preview-deploy-2026
     │         health: preview_db_health.php?token=PREVIEW_HEALTH_2026
     │         repair: repair_preview.php
     │
     └──► [Production]  Dreamhost shared hosting
               ssh://liemdo0208@pdx1-shared-a3-05.dreamhost.com
               repo: /home/liemdo0208/repo/dashboard.git
               deploy key: (manual via deploy.php)
```

---

## 2. Deploy Commands

### Preview Deploy
```bash
# From anywhere (or curl from anywhere)
curl "https://preview.dashboard.bakudanramen.com/deploy_preview.php?key=preview-deploy-2026"

# Or locally:
cd E:\Project\Master\Bakudan\dashboard.bakudanramen.com
git push origin main
```

**Next after deploy:**
```bash
curl "https://preview.dashboard.bakudanramen.com/preview_db_health.php?token=PREVIEW_HEALTH_2026"
curl "https://preview.dashboard.bakudanramen.com/validate_preview_workflow.php"
```

### Production Deploy
```bash
# SSH to Dreamhost
ssh liemdo0208@pdx1-shared-a3-05.dreamhost.com

# In repo directory
cd /home/liemdo0208/repo/dashboard
git pull origin main

# Run migration if schema changed
php migrate.php

# Validate
curl "https://dashboard.bakudanramen.com/ping"
```

---

## 3. Environment Config

### Preview (`.env.preview`)
```
APP_ENV=staging
APP_URL=https://preview.dashboard.bakudanramen.com
PREVIEW_QA_BYPASS=1
PREVIEW_QA_EMAIL=qa.bot@bakudanramen.com
```

### Production (`.env`)
```
APP_ENV=production
APP_URL=https://dashboard.bakudanramen.com
PREVIEW_QA_BYPASS=0
# Safety guard ACTIVE on production
```

---

## 4. Safety Guard Config

**File:** `config/safety-guard.php`

| Env | Status | Notes |
|-----|--------|-------|
| Production | ✅ ACTIVE | All safety checks enforced; no bypass |
| Preview | ⚠️ BYPASS | `PREVIEW_QA_BYPASS=1` — disabled for QA testing |
| Local Dev | ⚠️ BYPASS | Configured via env vars |

**Never set `PREVIEW_QA_BYPASS=1` on production.**

---

## 5. Database

| Env | Host | Database | User | Auth |
|-----|------|----------|------|------|
| Production | `localhost` | `bakudan_dashboard` | `liemdo0208` | Env vars |
| Preview | `localhost` | `bakudan_preview` | `liemdo0208` | Env vars |

**Config file:** `config/database.php` — reads from `$_ENV` (via `.env` or server vars).

---

## 6. Agent OS Scripts (Preview-only)

All scripts require a secret key for HTTP access. CLI access is unrestricted.

| Script | Key | Purpose |
|--------|-----|---------|
| `create_rbac_test_users.php` | `rbac-setup-2026` | Provision user1/user2/user3 |
| `rbac-validate.php` | `rbac-val-2026` | RBAC validation (note: use diag.php for password check) |
| `diag.php` | `diag-2026` | Standalone password verify diagnostic |
| `db-check.php` | `dbcheck-2026` | Schema inspection |
| `create_qa_user.php` | `qa-setup-2026` | QA bot user |
| `deploy_preview.php` | `preview-deploy-2026` | Preview deploy trigger |

---

## 7. Quick Answers

> **"What is the deployment path?"**
> 1. `git push origin main` → GitHub
> 2. `curl /deploy_preview.php?key=preview-deploy-2026` → Preview
> 3. `curl /preview_db_health.php?token=PREVIEW_HEALTH_2026` → Validate
> 4. `curl /validate_preview_workflow.php` → Workflow check
> 5. SSH to Dreamhost → `git pull origin main` → Production

> **"What is the current deployment target?"**
> Both preview and production are active. Preview = staging. Production = live.

> **"Is preview in sync with main?"**
> Run: `curl "https://preview.dashboard.bakudanramen.com/preview_db_health.php?token=PREVIEW_HEALTH_2026"`
> Look for: `DEPLOY_OK` in response.

> **"How do I deploy to production?"**
> SSH to Dreamhost and run: `cd /home/liemdo0208/repo/dashboard && git pull origin main && php migrate.php`