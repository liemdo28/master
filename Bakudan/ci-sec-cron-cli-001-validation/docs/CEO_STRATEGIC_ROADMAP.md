# CEO STRATEGIC ROADMAP — Bakudan Operational System

**Date:** 2026-06-02
**Git Commit:** `36604fd3db26776cc4238b3f3dab83bfa8dcc763`
**Environment:** PREVIEW ONLY (preview.dashboard.bakudanramen.com)

---

## CEO NON-NEGOTIABLE RULES

```
PREVIEW = Build + Test + Break
PRODUCTION = Publish + Operate
```

### RULE 1 — PREVIEW FIRST

Every code change must be developed, tested, and approved on:

**https://preview.dashboard.bakudanramen.com/**

No direct production development.

---

### RULE 2 — NO PRODUCTION TESTING

Production is not a QA environment.

**Do not:**
- test new workflows
- run experimental migrations
- validate unfinished features
- perform destructive operations

on production.

---

### RULE 3 — PREVIEW DB ONLY

Preview must use an isolated preview database.

**Never:**
- write test data into production
- create test tasks in production
- test approval workflow in production

---

### RULE 4 — RELEASE GATE

A release can only move to production when:

| Check | Status |
|-------|--------|
| Infrastructure Gate PASS | ⬜ |
| Core Workflow PASS | ⬜ |
| QA Walkthrough PASS | ⬜ |
| Admin Approval PASS | ⬜ |
| Rollback Point Created | ⬜ |

---

### RULE 5 — ROLLBACK ALWAYS AVAILABLE

Every production release must:

- create rollback point
- archive previous release
- retain release for 365 days
- support emergency rollback

---

## 🚨 EXECUTION ORDER

```
PHASE 0 — Infrastructure Stability (START HERE)
PHASE 1 — Core Workflow Stability
PHASE 2 — Reviewer Workspace
PHASE 3 — Operations Expansion
```

**STOP:** All new modules until Phase 0 passes.


---

# PHASE 0 — Infrastructure Stability 🔴 CRITICAL

**STOP ALL WORK until Infrastructure Gate passes.**

## Current Issues
```
DB access denied
Missing columns
Foreign key errors
section_id mismatch
503
```

## Infrastructure Gate (Must Pass First)

| Check | Status |
|-------|--------|
| Preview loads | ⬜ |
| Login works | ⬜ |
| Task List works | ⬜ |
| Task Detail works | ⬜ |
| Task Create works | ⬜ |
| Task Save works | ⬜ |
| No SQL fatal errors | ⬜ |
| No PHP fatal errors | ⬜ |

**If any gate fails → STOP QA, STOP Feature Work**

---

## P0.5 — Infrastructure & Security Audit

| Area | Checks |
|------|--------|
| Database Integrity | Foreign keys, constraints, indexes |
| Column Consistency | All tables have required columns |
| Environment Separation | Preview/Main DB isolation |
| File Uploads | Size limits, file types, storage |
| Permissions | Role-based access control |
| Notifications | Queue, delivery, retry |
| Credentials | No hardcoded secrets |

---

# PHASE 1 — Core Workflow Stability

**After Phase 0 passes.**

## Required Video Walkthroughs

Each role must have video showing full workflow:

### 1. Creator Video
```
Create → Edit → Comment → Attachment → Submit
```

### 2. Assignee Video
```
Accept → Complete → Notify
```

### 3. Reviewer Video
```
Review → Approve/Reject → Notify
```

### 4. Approver Video
```
Approve → Complete → Notify
```

### 5. Admin Video
```
Override → Manage → Archive
```

**Exit Criteria:** All 5 videos PASS 100%

---

## Missing 3 Items Added to Roadmap

### 1. Attachment System Audit ⭐

**Why Critical:** CEO mentions PDF, Excel, Screenshot, Payroll, QB Report, Bank Report frequently.

**Audit Checklist:**
```
□ Upload works
□ Download works
□ Delete works
□ Permission (who can see)
□ Versioning (overwrite vs new)
□ Storage (size limits, cleanup)
□ File type validation
```

**Warning:** If upload not stable → Reviewer Workspace useless

---

### 2. Notification Matrix ⭐

**Not just "notification sent" — must audit WHO gets WHAT.**

| Event | Creator | Assignee | Reviewer | Approver | Admin |
|-------|---------|----------|----------|----------|-------|
| Task Created | ✅ | ✅ | - | - | ✅ |
| Task Submitted | - | - | ✅ | - | ✅ |
| Review Approved | - | - | ✅ | ✅ | ✅ |
| Task Completed | ✅ | - | - | - | ✅ |
| Task Overdue | ✅ | ✅ | - | - | ✅ |
| SLA Warning | - | - | ✅ | ✅ | ✅ |

---

### 3. Permission Audit ⭐⭐⭐ CRITICAL

**Most dangerous area — test all roles.**

| Role | Can Do | Cannot Do |
|------|--------|-----------|
| Staff | View tasks, complete tasks | Edit others' tasks, view passwords, publish releases |
| Manager | View team tasks, reassign | Publish releases, edit release history |
| Reviewer | Review & approve | Publish releases, edit release history |
| Approver | Final approval | Edit release history, manage users |
| Admin | Full access | - |
| CEO | Full access | - |

**Test each role against each critical action.**

---

# PHASE 2 — Reviewer Workspace

**After Phase 1 passes.**

## Already In Progress
- Reviewer notes
- Task comments
- Approval workflow

## Enhanced Features (After Phase 1)
- Evidence Upload (required attachments)
- Dynamic Checklist
- Approval history

---

# PHASE 3 — Operations Expansion

**After Phase 2 passes.**

## Priority Order (After Phase 2)

| Priority | Module | Notes |
|----------|--------|-------|
| 1 | Evidence Engine | Require uploads before submit |
| 2 | Attachment Audit | Full system audit |
| 3 | Notification Matrix | Complete matrix audit |
| 4 | Checklist Engine | Per-task checklist |
| 5 | Credential Vault | Password management |
| 6 | Command Center | Green/Yellow/Red status |
| 7 | Escalation Engine | Auto-notify on SLA breach |

---

## 8 Future Modules (Detail)

### Module 1: Evidence Requirement Engine (P1)

**Current:**
```
Task → Submit
```

**Should Be:**
```
Task
→ Evidence Required
☑ Payroll Report PDF
☑ Toast Export
☑ Deposit Screenshot
→ Submit (if complete)
```

---

### Module 2: Dynamic Checklist Engine (P1)

**Current:**
```
Task → Description (text)
```

**Should Be:**
```
Task → Checklist
□ Download Bank Feed
□ Match Deposits
□ Match Toast Sales
□ Export Payroll
□ Upload Evidence
```

---

### Module 3: SLA & Escalation Engine (P2)

```
Submit > 24h → Reviewer not checked
↓
Auto Notify:
- Manager
- Creator
- CEO (optional)
```

---

### Module 4: Audit Trail Enhancement (P2)

**Already:** Who, What, When

**Missing:** Old Value, New Value, IP Address

---

### Module 5: Approval Matrix (P1)

**Current:** Reviewer → Approver

**Should:** Multi-level chain

```
Store Audit:
Store Manager → Area Manager → Operations Director
```

---

### Module 6: Role-based Dashboard (P2)

```
CEO: All overdue, blocked, pending approval
Manager: Team only
Staff: My tasks
```

---

### Module 7: Operational Command Center (P2)

```
Payroll      → 🟢/🟡/🔴
QuickBooks   → 🟢/🟡/🔴
Stores       → 🟢/🟡/🔴
Marketing    → 🟢/🟡/🔴
Finance      → 🟢/🟡/🔴
```

---

### Module 8: Password & Credential Vault (P2)

```
Credential Center:
- Website, URL, Username
- Password (encrypted)
- 2FA, Recovery Email
- Rotation Frequency

Permissions: CEO > Admin > Authorized Users
Audit: Who viewed, When
```

---

# ENVIRONMENT RULES

## Preview Only (preview.dashboard.bakudanramen.com)

**Allowed:**
- UI fixes
- Workflow fixes
- Task create/save
- Approval workflow
- Repeat schedule
- Reviewer workspace
- QA testing
- Migrations (preview DB only)

**NOT Allowed:**
- New feature deploy
- Schema migration
- Destructive action
- Task workflow change
- Database write/testing

## Production Only Receives

- QA-passed version
- Admin-approved release
- Scheduled publish
- Rollback point created
- Old version archived (1 year)

---

# SUMMARY

```
STOP: New modules until core passes
START: Infrastructure Gate (Phase 0)
THEN: Core Workflow (Phase 1)
THEN: Reviewer Workspace (Phase 2)
THEN: Operations Expansion (Phase 3)
```

---

# FILES CREATED

- `docs/CEO_STRATEGIC_ROADMAP.md` - This document
- `docs/P0_PREVIEW_AUDIT_REPORT.md` - 39-page audit
- `docs/QA_RELEASE_GOVERNANCE.md` - Release QA
- `views/layouts/main.php` - Repeat Schedule UI
- `controllers/TaskController.php` - Repeat persistence
