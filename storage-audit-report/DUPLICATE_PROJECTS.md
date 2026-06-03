# DUPLICATE PROJECTS REPORT
**Generated:** 2026-06-01 | **Phase 0: SCAN ONLY**

---

## Critical Duplicates (Same Git Remote)

### 1. bakudanramen.com — 4 Copies Found

| Copy | Path | Git Remote | Last Commit | Size | Status |
|------|------|-----------|------------|------|--------|
| **CANONICAL** | `E:\Project\Master\Bakudan\bakudanramen.com-current` | `heoventure/BakudanWebsite.git` | 2026-05-04 | ~400M | ✅ ACTIVE — static site, deploy source |
| Shadow copy | `E:\Project\bakudanramen.com` | `liemdo28/bakudanramen.com.git` | 2026-05-05 | 347M | ⚠️ DIFFERENT REPO — WordPress version, outside Master |
| F portable | `F:\Projects\bakudanramen.com` | `liemdo28/bakudanramen.com.git` | 2026-05-28 | 1.3G | WP version mirror |
| G snapshot | `G:\My Drive\Code\BakudanWebsite-main` | — | — | — | Old snapshot |
| F archive | `F:\Projects\Archive\BakudanWebsite-main` | — | — | — | Snapshot folder |
| F bakudan-sync | `F:\Projects\bakudan-sync\bakudanwebsite_sub` | — | — | 857M total | Contains multiple copies |

> **Note:** Two separate repos exist:  
> - `heoventure/BakudanWebsite.git` = **static HTML site** (current production)  
> - `liemdo28/bakudanramen.com.git` = **WordPress** (old/parallel version, still active commits)  
> These are NOT the same codebase — but deploy to the same domain.

### 2. Bakudan Dashboard — 3+ Copies

| Copy | Path | Git Remote | Last Commit | Status |
|------|------|-----------|------------|--------|
| **CANONICAL** | `E:\Project\Master\Bakudan\dashboard.bakudanramen.com` | `liemdo28/dashboard.bakudanramen.com.git` | 2026-05-29 | ✅ ACTIVE |
| F portable | `F:\Projects\dashboard.bakudanramen.com` | `liemdo28/dashboard.bakudanramen.com.git` | 2026-05-31 | Portable mirror |
| F archive (old) | `F:\Projects\Archive\dashboard-bakudanramen-old-20260601` | same git | — | ✅ ARCHIVED |
| E shadow | `E:\Project\Bakudan\Dashboard*` | none | — | ⚠️ OLD COPIES |
| E personal | `E:\Project\Personal\Dashboard*` | none | — | ⚠️ OLD COPIES |

### 3. integration-toasttab-qb — 2 Different Repos

| Copy | Path | Git Remote | Last Commit | Status |
|------|------|-----------|------------|--------|
| E integration-system | `E:\Project\Master\Bakudan\integration-system` | `liemdo28/intergration-full.git` | 2026-04-17 | ✅ ACTIVE |
| F integration | `F:\Projects\integration-toasttab-qb` | `liemdo28/integration-toasttab-qb.git` | 2026-05-30 | ⚠️ DIFFERENT REPO, F NEWER |
| E Toasttab Quickbook | `E:\Project\Toasttab Quickbook\` | none | — | ⚠️ Old copy? |

> **Action Required:** Determine which integration repo is canonical. F is 43 days newer.

### 4. packing-list — 2 Copies (Same Git)

| Copy | Path | Git Remote | Status |
|------|------|-----------|--------|
| **CANONICAL** | `E:\Project\Master\Bakudan\packing-list` | `liemdo28/packing-list.git` | ✅ ACTIVE |
| F portable | `F:\Projects\packinglist-price` | `liemdo28/packing-list.git` | Portable mirror |

### 5. rawsushibar — 2 Copies (Same Git)

| Copy | Path | Git Remote | Status |
|------|------|-----------|--------|
| **CANONICAL** | `E:\Project\Master\RawSushi\RawWebsite` | `liemdo28/rawwebsite.git` | ✅ ACTIVE |
| F portable | `F:\Projects\rawsushibar` | `liemdo28/rawwebsite.git` | Portable mirror |

### 6. agent-coding — 2 Copies + Archive

| Copy | Path | Git Remote | Last Commit | Status |
|------|------|-----------|------------|--------|
| **CANONICAL** | `E:\Project\Master\agent-coding` | `liemdo28/agent-coding.git` | 2026-06-01 | ✅ ACTIVE |
| F portable | `F:\Projects\agent-coding` | `liemdo28/agent-coding.git` | 2026-05-22 | ⚠️ Stale (10+ commits behind) |
| F archive snapshot | `F:\Projects\Archive\agent-coding_snapshot_2026-05-21.zip` | — | — | Archive |

### 7. agentai-agency — 3 Copies (RESOLVED)

| Copy | Path | Status |
|------|------|--------|
| Merged | `E:\Project\Master\agent-coding\apps\agency\` | ✅ Merged into monorepo |
| Locked remnant | `E:\Project\Master\agentai-agency\` | ⚠️ Windows-locked, DEPRECATED.md |
| E Personal shadow | `E:\Project\Personal\agentai-agency\` | ⚠️ Old copy, should be deleted |
| Archive | `E:\Project\Master\_archive\agentai-agency-merged-20260601\` | ✅ Archived |

---

## Within-F Duplicates

| Duplicate | Status |
|-----------|--------|
| `F:\Projects\dashboard-bakudanramen` + `F:\Projects\dashboard.bakudanramen.com` | ✅ RESOLVED — old one moved to Archive |
| `F:\Projects\Archive\dashboard.bakudanramen.com 2.zip` + `dashboard.bakudanramen.com.zip` | Two ZIPs of same project |
| `F:\Projects\bakudan-sync\bakudanwebsite_sub` + `bakudanramen.com-current` in E | Website copies |

---

## Classification Summary

| Project | Status | Canonical Location |
|---------|--------|-------------------|
| Bakudan Website (static) | ACTIVE | `E:\Project\Master\Bakudan\bakudanramen.com-current` |
| Bakudan Website (WordPress) | ACTIVE (parallel) | `E:\Project\bakudanramen.com` → needs consolidation decision |
| Bakudan Dashboard | ACTIVE | `E:\Project\Master\Bakudan\dashboard.bakudanramen.com` |
| Integration Toast↔QB | ACTIVE (2 repos!) | Needs investigation |
| agent-coding | ACTIVE | `E:\Project\Master\agent-coding` |
| agentai-agency | MERGED | `agent-coding\apps\agency\` |
| Old Dashboard copies (E\Project\Bakudan, Personal) | ARCHIVE | Move to `_archive` |
