# ROOT ORPHAN FILES
**Generated:** 2026-06-01 | **Phase 0: SCAN ONLY**

---

## E:\Project\Master — Root Level (Current State)

> All source files previously at root have been cleaned up. Current root is clean.

### Files at `E:\Project\Master\` root (legitimate)

| File/Folder | Type | Status |
|-------------|------|--------|
| `MASTER_INVENTORY.md` | Index doc | KEEP |
| `MASTER_PROJECT_INDEX.md` | Index doc | KEEP |
| `MASTER_FOLDER_AUDIT_REPORT.md` | Audit doc | KEEP |
| `DUPLICATE_PROJECTS.md` | Audit doc | KEEP |
| `ORPHAN_FILES.md` | Audit doc | KEEP |
| `PROJECT_MAP.md` | Index doc | KEEP |
| `PROJECT_SYNC_REPORT.md` | Sync doc | KEEP |
| `SYNC_AUDIT.md` | Sync doc | KEEP |
| `sync-master-to-portable.ps1` | Sync script | KEEP |
| `compare-projects.ps1` | Sync script | KEEP |
| `copy-f-only-to-master.ps1` | Sync script | KEEP |
| `git-status-all.ps1` | Audit script | KEEP |
| `_cleanup_after_restart.bat` | Pending cleanup | RUN WHEN READY |
| `storage-audit-report/` | This audit | KEEP |

### Locked/Deprecated folders at root (pending cleanup)

| Folder | Status | Action |
|--------|--------|--------|
| `agentai-agency/` | DEPRECATED — Windows file lock | Delete after restart |
| `packing-list/` | Duplicate — already in `Bakudan/` | Delete after restart |
| `LinkTreeHL/` | Duplicate — already in `Other/` | Delete after restart |
| `agent-coding/` | Should move to `Agent/agent-coding/` | Move after restart |
| `agent-coding-api-keys/` | Should move to `Agent/` | Move after restart |

---

## ⚠️ E:\Project\ — Shadow Projects (Major Finding)

These are source projects sitting OUTSIDE `E:\Project\Master\`. They are untracked, not in the agent-coding registry, and risk being forgotten.

| File/Folder | Path | Belongs To | Status |
|-------------|------|-----------|--------|
| `bakudanramen.com\` | `E:\Project\bakudanramen.com\` | Bakudan — WordPress version | ⚠️ ACTIVE git, outside Master |
| `Bakudan\` | `E:\Project\Bakudan\` | Old Dashboard copies | ⚠️ Stale, not in Master |
| `Personal\` | `E:\Project\Personal\` | Mixed — Dashboard, games, agentai-agency | ⚠️ NOT organized |
| `Raw\` | `E:\Project\Raw\` | Raw Sushi Bar | ⚠️ Duplicate of `RawSushi/RawWebsite` |
| `VC\` | `E:\Project\VC\` | CV/HR project | ⚠️ Not in Master |
| `PC-QA-Stability-Certification\` | `E:\Project\PC-QA-Stability-Certification\` | QA cert | ⚠️ Not in Master |
| `review-management-mcp\` | `E:\Project\review-management-mcp\` | MCP server | ⚠️ Not in Master |
| `Toasttab Quickbook\` | `E:\Project\Toasttab Quickbook\` | Integration copy | ⚠️ Not in Master |

### E:\ Root Loose Files

| File | Path | Category | Action |
|------|------|----------|--------|
| `Screenshot 2026-03-24 160416.png` | `E:\` root | Screenshot | Move to Personal |
| `test.txt` | `E:\` root | Test file | DELETE |
| `test_node.txt` | `E:\` root | Test file | DELETE |
| `test_write.txt` | `E:\` root | Test file | DELETE |
| `Local Disk (C) - Shortcut.lnk` | `E:\` root | Shortcut | DELETE |

---

## Previously Orphaned Files (Now Resolved)

Before the cleanup session (2026-06-01), these were at `E:\Project\Master\` root:

| Was Orphan | Moved To | Status |
|-----------|----------|--------|
| `_deploy.py` | `_archive/scripts-old/` | ✅ |
| `_deploy_links_temp.py` | `Bakudan/bakudanramen.com-current/scripts/` | ✅ |
| `_deploy_static_pages.py` | `Bakudan/bakudanramen.com-current/scripts/` | ✅ |
| `bkdn_qa_screenshots.js` | `Bakudan/bakudanramen.com-current/qa/scripts/` | ✅ |
| `bkdn_qa_walkthrough.js` | `Bakudan/bakudanramen.com-current/qa/scripts/` | ✅ |
| `bkdn_sub_qa_shots.js` | `Bakudan/bakudanramen.com-current/qa/scripts/` | ✅ |
| `bkdn_sub_qa_video.js` | `Bakudan/bakudanramen.com-current/qa/scripts/` | ✅ |
| `bkdn_temp_shots.js/2/3/4` | `Bakudan/bakudanramen.com-current/qa/scripts/` | ✅ |
| `bkdn_qa_shots/` (folder) | `Bakudan/bakudanramen.com-current/qa/artifacts/` | ✅ |
| `bkdn_qa_video/` (folder) | `Bakudan/bakudanramen.com-current/qa/artifacts/` | ✅ |
| `bkdn_sub_qa_shots/` | `Bakudan/bakudanramen.com-current/qa/artifacts/` | ✅ |
| `bkdn_sub_qa_video/` | `Bakudan/bakudanramen.com-current/qa/artifacts/` | ✅ |
| `bkdn_temp_shots/` | `Bakudan/bakudanramen.com-current/qa/artifacts/` | ✅ |
| `review-automation-system.zip` | `_archive/` | ✅ |
