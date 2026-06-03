# MASTER FOLDER AUDIT REPORT — FINAL
**Date:** 2026-06-01  
**Root:** `E:\Project\Master`

---

## Before Tree (Start of Session)

```
E:\Project\Master\
  .gitignore                          ← loose file (no root git)
  _deploy.py                          ← loose deploy script
  _deploy_links_temp.py               ← loose deploy script
  _deploy_static_pages.py             ← loose deploy script
  bkdn_qa_screenshots.js              ← loose QA script
  bkdn_qa_walkthrough.js              ← loose QA script
  bkdn_sub_qa_shots.js                ← loose QA script
  bkdn_sub_qa_video.js                ← loose QA script
  bkdn_temp_shots.js                  ← loose QA script
  bkdn_temp_shots2.js                 ← loose QA script
  bkdn_temp_shots3.js                 ← loose QA script
  bkdn_temp_shots4.js                 ← loose QA script
  review-automation-system.zip        ← stray backup
  BakudanWebsite_Sub/                 ← main site (unclear name)
  BakudanWebsite_Sub2/                ← old branch (confusion risk)
  bakudanramen.com/                   ← WordPress old (confusion risk)
  bkdn_qa_shots/                      ← loose artifact folder
  bkdn_qa_video/                      ← loose artifact folder
  bkdn_sub_qa_shots/                  ← loose artifact folder
  bkdn_sub_qa_video/                  ← loose artifact folder
  bkdn_temp_shots/                    ← loose artifact folder
  LinkTreeHL/
  RawWebsite/
  agent-coding/
  agent-coding-api-keys/
  agentai-agency/                     ← duplicate of agent-coding/apps/agency
  dashboard.bakudanramen.com/
  growth-dashboard/
  integration-system/
  mobile_taskflow/
  packing-list/
  qa-stress-app/                      ← loose (no parent context)
  qa-stress-app-v2/                   ← loose
  qa-system/
  qa_runner/
  review-automation-system/
```

**Issues found: 25+ items with no grouping, 13 loose files, 5 loose artifact folders, 2 duplicate/legacy sources**

---

## After Tree (Current State)

```
E:\Project\Master\
  Bakudan/
    bakudanramen.com-current/         ← renamed from BakudanWebsite_Sub (MAIN deploy source)
    dashboard.bakudanramen.com/
    growth-dashboard/
    integration-system/
    mobile_taskflow/
    packing-list/
    review-automation-system/
  QA/
    qa-system/                        ← includes stress-tests/ subdir
    qa_runner/
  RawSushi/
    RawWebsite/
  Other/
    LinkTreeHL/
  Agent/                              ← see pending below
  _archive/
    bakudanramen.com-old-20260601/    ← WordPress archived
    BakudanWebsite_Sub2-20260601/     ← old branch archived
    agentai-agency-merged-20260601/   ← merged into agent-coding
    review-automation-system.zip
    scripts-old/_deploy.py
  MASTER_INVENTORY.md
  DUPLICATE_PROJECTS.md
  ORPHAN_FILES.md
  PROJECT_MAP.md
  MASTER_FOLDER_AUDIT_REPORT.md
  _cleanup_after_restart.bat         ← run to finish pending moves
```

**⚠️ Pending (Windows file lock — run `_cleanup_after_restart.bat` to complete):**
```
  agent-coding/         → Agent/agent-coding/
  agent-coding-api-keys/ → Agent/agent-coding-api-keys/
  packing-list/         → DELETE (already at Bakudan/packing-list/)
  LinkTreeHL/           → DELETE (already at Other/LinkTreeHL/)
  agentai-agency/       → DELETE (DEPRECATED, content merged)
```

---

## Moved Folders

| From (root) | To | Notes |
|------------|-----|-------|
| `BakudanWebsite_Sub/` | `Bakudan/bakudanramen.com-current/` | Renamed for clarity |
| `dashboard.bakudanramen.com/` | `Bakudan/dashboard.bakudanramen.com/` | |
| `growth-dashboard/` | `Bakudan/growth-dashboard/` | |
| `integration-system/` | `Bakudan/integration-system/` | |
| `mobile_taskflow/` | `Bakudan/mobile_taskflow/` | |
| `review-automation-system/` | `Bakudan/review-automation-system/` | |
| `packing-list/` | `Bakudan/packing-list/` | Root copy pending delete |
| `qa-system/` | `QA/qa-system/` | stress-tests/ already inside |
| `qa_runner/` | `QA/qa_runner/` | |
| `RawWebsite/` | `RawSushi/RawWebsite/` | |
| `LinkTreeHL/` | `Other/LinkTreeHL/` | Root copy pending delete |
| `bkdn_qa_screenshots.js` | `Bakudan/bakudanramen.com-current/qa/scripts/` | |
| `bkdn_qa_walkthrough.js` | `Bakudan/bakudanramen.com-current/qa/scripts/` | |
| `bkdn_sub_qa_shots.js` | `Bakudan/bakudanramen.com-current/qa/scripts/` | |
| `bkdn_sub_qa_video.js` | `Bakudan/bakudanramen.com-current/qa/scripts/` | |
| `bkdn_temp_shots.js/2/3/4` | `Bakudan/bakudanramen.com-current/qa/scripts/` | |
| `_deploy_links_temp.py` | `Bakudan/bakudanramen.com-current/scripts/` | Paths updated |
| `_deploy_static_pages.py` | `Bakudan/bakudanramen.com-current/scripts/` | Paths updated |
| `_deploy.py` | `_archive/scripts-old/` | WP plugin deploy |
| `bkdn_qa_shots/` | `Bakudan/bakudanramen.com-current/qa/artifacts/` | |
| `bkdn_qa_video/` | `Bakudan/bakudanramen.com-current/qa/artifacts/` | |
| `bkdn_sub_qa_shots/` | `Bakudan/bakudanramen.com-current/qa/artifacts/` | |
| `bkdn_sub_qa_video/` | `Bakudan/bakudanramen.com-current/qa/artifacts/` | |
| `bkdn_temp_shots/` | `Bakudan/bakudanramen.com-current/qa/artifacts/` | |
| `qa-stress-app/` | `QA/qa-system/stress-tests/` | |
| `qa-stress-app-v2/` | `QA/qa-system/stress-tests/` | |

## Merged Folders

| From | Into | Notes |
|------|------|-------|
| `agentai-agency/` | `Agent/agent-coding/apps/agency/` | Python FastAPI agency (1330 tests pass) |
| `BakudanWebsite_Sub2/` | `_archive/BakudanWebsite_Sub2-20260601/` | Not a merge — archived |

## Archived Folders

| Folder | Archive path | Reason |
|--------|-------------|--------|
| `bakudanramen.com/` | `_archive/bakudanramen.com-old-20260601/` | WordPress replaced by static site |
| `BakudanWebsite_Sub2/` | `_archive/BakudanWebsite_Sub2-20260601/` | Old branch superseded |
| `agentai-agency/` | `_archive/agentai-agency-merged-20260601/` | Merged into agent-coding monorepo |

## Deleted Folders

None deleted. Archive-only policy applied.

---

## Path Updates Applied

| File | Changed |
|------|---------|
| `Bakudan/bakudanramen.com-current/scripts/_deploy_links_temp.py` | LOCAL path updated |
| `Bakudan/bakudanramen.com-current/scripts/_deploy_static_pages.py` | LOCAL_SRC updated |
| `Bakudan/bakudanramen.com-current/qa/scripts/*.js` (8 files) | qa_runner path updated to QA/qa_runner |
| `QA/qa-system/config/projects.json` | All localPath entries updated to new group paths |
| `Agent/agent-coding/AGENTS.md` | Scope updated for both JS + Python |
| `Agent/agent-coding/.gitignore` | agency/ runtime exclusions added |
| `Bakudan/bakudanramen.com-current/README.md` | Deploy source note added |

---

## Risk / Rollback Plan

| Risk | Mitigation |
|------|-----------|
| Deploy scripts break | Paths updated in _deploy_*.py. Test: `python _deploy_static_pages.py --dry-run` |
| QA scripts can't find playwright | qa_runner at QA/qa_runner/ — paths updated in all 8 JS files |
| qa-system can't find projects | config/projects.json updated with new group paths |
| git history lost | .git preserved in all archived copies |
| agent-coding move not complete | Run `_cleanup_after_restart.bat` |

**Full rollback:** All archived content at `_archive/` with original `.git` intact. Reverse any move with `mv`.
