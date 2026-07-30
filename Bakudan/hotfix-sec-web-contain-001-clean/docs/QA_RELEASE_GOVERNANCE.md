# DEV 3 — SIDEBAR UI + RELEASE GOVERNANCE QA REPORT

**Date:** 2026-06-02
**Environment:** Preview only (DO NOT PUBLISH TO PRODUCTION)
**Git Commit:** `36604fd3db26776cc4238b3f3dab83bfa8dcc763`

---

## 1. SIDEBAR UI QA

### 1.1 Sidebar Structure
- **File:** `views/layouts/main.php` (lines 215-500)
- **CSS:** `assets/css/layout.css` (lines 89-400)
- **Theme:** Dark GitHub-style (#0D1117 background)

### 1.2 Screen Size Testing Checklist
| Screen | Resolution | Zoom | Status |
|--------|------------|------|--------|
| 13" laptop | 1280x800 | 100% | ⬜ |
| 13" laptop | 1280x800 | 110% | ⬜ |
| 13" laptop | 1280x800 | 125% | ⬜ |
| 15" laptop | 1440x900 | 100% | ⬜ |
| 15" laptop | 1440x900 | 110% | ⬜ |
| 15" laptop | 1440x900 | 125% | ⬜ |
| 27" monitor | 2560x1440 | 100% | ⬜ |
| 27" monitor | 2560x1440 | 110% | ⬜ |
| 27" monitor | 2560x1440 | 125% | ⬜ |

### 1.3 Sidebar Features
- ✅ Sidebar search (lines 220-235 in main.php)
  - Input: `sbSearchInput`
  - Clear button: `sbSearchClear`
  - Live filtering on keystroke
- ✅ Active state indicator (red left border)
- ✅ Badge counts (priority, overdue, payments)
- ✅ Section groups: Operations, Projects, Tasks, Team, Stores, Governance, Finance
- ✅ Responsive mobile layout (sidebar overlay on <768px)

### 1.4 CSS Readability Features
- Font: Inter (fallback: system sans-serif)
- Text contrast: #E6EDF3 on #0D1117 (7.5:1 ratio)
- Active item: #EF4444 accent color
- Section headers: uppercase, letter-spacing 1.2px

---

## 2. RELEASE GOVERNANCE QA

### 2.1 Database Tables
| Table | Purpose | Status |
|-------|---------|--------|
| `release_drafts` | Draft management + QA status | ✅ |
| `release_versions` | Version tracking + artifacts | ✅ |
| `release_approvals` | Approval workflow | ✅ |
| `release_schedule` | Scheduled publishing | ✅ |
| `release_archive` | 1-year retention | ✅ |
| `rollback_points` | Rollback snapshots | ✅ |

### 2.2 Table Schemas

**release_drafts**
- id, release_id, draft_key, preview_url
- qa_status (pending/running/passed/failed)
- source_branch, source_commit
- created_by, timestamps

**release_versions**
- id, release_id, version_label
- commit_hash, artifact_path
- source_snapshot_path, db_snapshot_path
- is_live, published_at

**release_approvals**
- id, release_id, approver_id
- approval_role, status (pending/approved/rejected/cancelled)
- note, approved_at

**release_schedule**
- id, release_id, scheduled_for
- timezone (default: Asia/Ho_Chi_Minh)
- status (scheduled/running/published/cancelled/failed)
- publish_started_at, publish_finished_at

**release_archive**
- id, release_id, release_version_id
- archived_at, retain_until (1 year default)
- is_locked, used_for_rollback, required_for_audit
- deletion_eligible_at, deleted_at

**rollback_points**
- id, release_id, release_version_id
- qa_status, approval_status
- created_by, created_at, used_at

### 2.3 Controller: ReleaseController
Location: `controllers/ReleaseController.php`

**Methods:**
- index() - List all releases
- show() - Release detail view
- create() - Create new draft
- store() - Save draft
- edit() - Edit release
- update() - Update release
- delete() - Delete release
- publish() - Publish release
- schedule() - Schedule publish
- cancel() - Cancel scheduled
- duplicate() - Clone release
- auditLog() - View audit trail

### 2.4 Views
Location: `views/releases/`

| File | Purpose |
|------|---------|
| index.php | Release list |
| create.php | Create draft form |
| show.php | Release detail |
| artifacts.php | Artifact management |
| public_review.php | Public review page |
| version_details_modal.php | Version modal |
| partials/_show_main.php | Main section |
| partials/_show_sidebar.php | Sidebar info |

---

## 3. ADMIN CAPABILITIES

### 3.1 Create Draft
- ✅ Name, Version, Title, Summary
- ✅ Branch, Commit Hash, Preview URL
- ✅ Release Notes, Change Log, Bug Fixes
- ✅ Known Issues, Risk Notes
- ✅ Rollback Notes, Contact

### 3.2 QA Preview
- ✅ Preview URL per draft
- ✅ QA status tracking (pending/running/passed/failed)
- ✅ Source branch/commit display

### 3.3 Schedule Publish
- ✅ Schedule date/time picker
- ✅ Timezone selection
- ✅ Status tracking (scheduled/running/published/cancelled/failed)

### 3.4 Retention Policy
- ✅ 1-year retention (retain_until field)
- ✅ Auto-archive on publish
- ✅ Deletion eligibility tracking

### 3.5 Rollback Support
- ✅ Rollback points with snapshots
- ✅ Database snapshot storage
- ✅ Source snapshot storage
- ✅ Used-for-rollback flag

---

## 4. RELEASE FLOW

```
[Draft] → [Preview/QA] → [Review] → [Approval] → [Scheduled] → [Published] → [Archived]
              ↓
         [Changes Requested] → [Draft]
```

### 4.1 Flow Steps
1. **Create Draft** - Admin fills form, saves as draft
2. **Preview** - Generate preview URL, run QA
3. **Review** - Stakeholder reviews preview
4. **Approval** - Admin approves release
5. **Schedule** - Set publish date/time
6. **Publish** - Execute scheduled publish
7. **Archive** - Move to archive with 1-year retention

---

## 5. ACTION ITEMS

### Must Verify Before Merge
- [ ] Sidebar readable on all screen sizes
- [ ] Sidebar search filters correctly
- [ ] Active state visible and clear
- [ ] Release draft creation works
- [ ] QA preview URL generates
- [ ] Schedule publish saves correctly
- [ ] 1-year retention set on archive
- [ ] Rollback creates snapshot

### Known Limitations
- Production publish blocked (preview only)
- Migration must be run: `php migrate.php`

---

## 6. FILES CHANGED

### CSS Changes
- `assets/css/layout.css` - Sidebar v2 styling

### View Changes
- `views/layouts/main.php` - Sidebar + Create Task modal

### Migration Files
- `database/migrations/2026_06_02_release_governance.sql` - All governance tables

### Documentation
- `docs/QA_RELEASE_GOVERNANCE.md` - This report
