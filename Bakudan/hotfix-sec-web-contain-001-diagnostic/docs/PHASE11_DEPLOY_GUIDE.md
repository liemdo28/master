# Phase 11 Deployment Guide
## Branch: `phase11-business-execution-platform` | Commit: `3161f68`

> **Governance Rule:** No direct push to `main`. This release goes through Draft → Preview → Review → QA → Approval → Schedule → Production.

---

## STEP 1 — Verify Branch Is Pushed ✅

```bash
git fetch origin
git log --oneline origin/phase11-business-execution-platform -1
# Expected: 3161f68 Phase 11: Bakudan Business Execution Platform
```

---

## STEP 2 — Deploy to DreamHost Preview

### Option A: SSH (Recommended — requires DreamHost SSH key)

```bash
# Connect to DreamHost
ssh liemdo0208@pdx1-shared-a3-05.dreamhost.com

# Navigate to the dashboard repo on DreamHost
cd ~/repo/dashboard

# Pull the feature branch
git fetch origin phase11-business-execution-platform
git checkout phase11-business-execution-platform
git pull origin phase11-business-execution-platform

# Link to preview web directory
cd ~/dashboard.bakudanramen.com
git fetch origin phase11-business-execution-platform
git checkout phase11-business-execution-platform
git pull origin phase11-business-execution-platform

echo "Branch deployed to preview"
```

### Option B: DreamHost Web Panel

1. Log into https://panel.dreamhost.com
2. Go to **Domains → Subdomains** or **Git Integration** (if available)
3. Set the preview deployment to use branch `phase11-business-execution-platform`
4. Trigger a pull/deploy

---

## STEP 3 — Run Migration in Preview Database

```bash
# SSH into DreamHost
ssh liemdo0208@pdx1-shared-a3-05.dreamhost.com

# Find preview database credentials from .env
cat ~/dashboard.bakudanramen.com/.env | grep DB_

# Run the Phase 11 migration (preview DB)
mysql -u root -p preview_database < /home/liemdo0208/dashboard.bakudanramen.com/database/migrations/phase11_store_checklists.sql

# Verify table was created
mysql -u root -p preview_database -e "DESCRIBE store_checklists;"
```

> **WARNING:** Run ONLY in the preview database. Do NOT run on the production database until the release is approved.

---

## STEP 4 — Create Release Draft via Web UI

1. Open **production dashboard**: https://dashboard.bakudanramen.com
2. Navigate to: `/admin/releases`
3. Click **New Release Draft**
4. Fill in:

```
Name:        Phase 11 — Bakudan Business Execution Platform
Version:     v11.0.0
Status:      Draft
Branch:      phase11-business-execution-platform
Commit Hash: 3161f68382e08720592d24285a54e82de214e91e
```

**Summary:**
> Adds Daily Operations Center, Manager Command Center, Action Center, Store Opening/Closing Checklist, Company Calendar, Execution Score, Morning Briefing, CEO Mobile View, and Control Tower modules.

**Release Notes:**

```markdown
## New Features
- Daily Operations Center (`/operations/today`)
- Manager Command Center (`/manager/command`)
- Action Center (`/action-center`)
- Store Opening/Closing Checklist (`/store/checklist/open`, `/store/checklist/close`)
- Company Operating Calendar (`/company/calendar`)
- Execution Score
- Morning Briefing
- CEO Mobile View
- Control Tower (`/control-tower`)

## Migration
- `database/migrations/phase11_store_checklists.sql`
  - Creates `store_checklists` table
  - Fields: store_id, type (open/close), items (JSON), cash_count, timestamps

## Risk Notes
- Multiple new routes, controllers, and views
- Database migration adds new table
- No existing tables are altered

## Rollback Plan
1. Revert code to previous release commit
2. `store_checklists` table can remain (harmless if unused)
3. Disable Phase 11 navigation links in sidebar via config
4. No existing data migration required for rollback
```

**Preview URL:** `https://preview.dashboard.bakudanramen.com`

5. Click **Save Draft**

---

## STEP 5 — Walkthrough QA

### CEO Walkthrough
- [ ] `/control-tower` — Control Tower loads, overall health score visible
- [ ] `/operations/today` — Daily Operations Center renders all sections
- [ ] `/action-center` — Action Center shows pending actions
- [ ] `/company/calendar` — Company Calendar renders

### Manager Walkthrough
- [ ] `/manager/command` — Manager Command Center shows team, stores, payroll
- [ ] `/store/checklist/open` — Opening checklist form loads
- [ ] `/store/checklist/open/submit` — POST submission works (redirect after save)
- [ ] `/store/checklist/close` — Closing checklist form loads
- [ ] `/store/checklist/close/submit` — POST submission works
- [ ] `/store/checklist/history` — History view shows past checklists

### Member Walkthrough
- [ ] `/my-tasks` — Tasks render correctly
- [ ] Checklist execution (if assigned a store checklist task)
- [ ] Comments on tasks work
- [ ] Task completion works

### Admin Walkthrough
- [ ] `/admin/releases` — Release center shows Phase 11 draft
- [ ] Preview status visible
- [ ] Publish controls available (disabled until approved)
- [ ] Rollback controls available

---

## STEP 6 — Smoke Test Routes

Run these in the **preview environment**:

```
✅ GET /operations/today       → 200 OK, no SQLSTATE errors
✅ GET /manager/command         → 200 OK, no 500 error
✅ GET /action-center           → 200 OK, no permission leak
✅ GET /store/checklist/open    → 200 OK, form renders
✅ GET /store/checklist/close   → 200 OK, form renders
✅ GET /company/calendar        → 200 OK, calendar renders
✅ GET /control-tower           → 200 OK, health widgets render
✅ GET /admin/releases          → 200 OK, release center loads
```

**Reject criteria:**
- Any SQLSTATE error
- Any HTTP 500
- Any permission leak (member seeing admin-only data)
- Any broken widget or missing view
- Any migration mismatch (table not found)

---

## STEP 7 — Admin Review

Admin reviews:
1. Preview link and confirmation it loads correctly
2. Release notes completeness
3. Walkthrough QA results (all items passed)
4. Known issues list
5. Migration impact assessment
6. Rollback plan confirmation

---

## STEP 8 — Schedule Publish

After Admin approval, from `/admin/releases/{id}`:

**Option A — Publish Now:**
Click **Publish Now** (requires all gates to pass)

**Option B — Schedule Publish:**
1. Click **Schedule Publish**
2. Set date/time in Asia/Ho_Chi_Minh timezone
3. Confirm

---

## Rollback Instructions

If anything goes wrong post-publish:

```bash
# SSH to DreamHost
ssh liemdo0208@pdx1-shared-a3-05.dreamhost.com

# Revert to previous release commit (the commit BEFORE 3161f68)
cd ~/dashboard.bakudanramen.com
git checkout 41a31f9
git pull origin 41a31f9

# No database rollback needed — store_checklists is a new table
```

---

## Current State Summary

| Item | Value |
|------|-------|
| Feature Branch | `phase11-business-execution-platform` ✅ |
| Branch Pushed to GitHub | `3161f68` ✅ |
| Main Branch | `41a31f9` (Phase 11 NOT on main) ✅ |
| Migration | `phase11_store_checklists.sql` ready ✅ |
| Release Management System | Fully implemented ✅ |
| Deploy Freeze Active | Check before publishing |
