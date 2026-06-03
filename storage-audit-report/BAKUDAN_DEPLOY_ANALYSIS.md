# BAKUDAN DEPLOY ANALYSIS
**Generated:** 2026-06-01 | **Phase 0: SCAN ONLY**

---

## Domain: bakudanramen.com

### Deploy Source Confirmed

**SOURCE OF TRUTH:** `E:\Project\Master\Bakudan\bakudanramen.com-current`

| Evidence | Detail |
|----------|--------|
| Deploy script LOCAL_SRC | `E:\Project\Master\Bakudan\bakudanramen.com-current` |
| Deploy target REMOTE_WR | `/home/hoale24new/bakudanramen.com` (DreamHost) |
| Deploy method | SFTP via `_deploy_static_pages.py` |
| Stack | Static HTML/CSS/JS — no build pipeline |
| Git remote | `github.com/heoventure/BakudanWebsite.git` (branch: main) |
| Last commit | 2026-05-04 |
| Sub-pages deployed | `/links-temp/`, `/store-locations/`, `/order-smart/`, `/reservations/` |

### Server Info

| Field | Value |
|-------|-------|
| Host | `pdx1-shared-a3-05.dreamhost.com` |
| User | `hoale24new` |
| Remote path | `/home/hoale24new/bakudanramen.com` |
| Deploy method | SFTP (Paramiko) |

---

## All bakudanramen.com Sources — Classification

| Source | Path | Git Remote | Type | Status |
|--------|------|-----------|------|--------|
| **ACTIVE — CANONICAL** | `E:\Project\Master\Bakudan\bakudanramen.com-current` | `heoventure/BakudanWebsite.git` | Static HTML | ✅ PRODUCTION DEPLOY SOURCE |
| WordPress version | `E:\Project\bakudanramen.com` | `liemdo28/bakudanramen.com.git` | WordPress PHP | ⚠️ ACTIVE COMMITS — parallel version? |
| F portable mirror | `F:\Projects\bakudanramen.com` | `liemdo28/bakudanramen.com.git` | WordPress PHP | Mirror of WP version |
| E Master archive | `E:\Project\Master\_archive\bakudanramen.com-old-20260601` | `liemdo28/bakudanramen.com.git` | WordPress PHP | ✅ ARCHIVED (but WP in E:\Project is newer!) |
| F Archive snapshot | `F:\Projects\Archive\BakudanWebsite-main` | — | Static HTML | Old snapshot |
| F bakudan-sync | `F:\Projects\bakudan-sync\` | none | Multiple copies | ⚠️ REVIEW |

---

## ⚠️ Critical Issue: Two Active WordPress Repos

The WordPress source was archived into `E:\Project\Master\_archive\bakudanramen.com-old-20260601\` but there is **STILL AN ACTIVE VERSION** at:

```
E:\Project\bakudanramen.com
Git: liemdo28/bakudanramen.com.git
Last commit: 2026-05-05 (NEWER than archive date of 2026-04-22)
```

This means the WordPress codebase received **new commits AFTER being archived**. This is a data integrity risk.

### Decision Required

| Option | Description |
|--------|-------------|
| A | Accept two parallel codebases (static + WP) — add WP to Master |
| B | Declare static as the only canonical source — archive WP definitively |
| C | Merge WP features into static site |

---

## bakudan-sync Folder Analysis (F:\Projects\bakudan-sync\)

| Subfolder | Contents | Status |
|-----------|---------|--------|
| `bakudanwebsite_sub/` | Static site copy | Duplicate of `bakudanramen.com-current` |
| `ceo-source/` | Unknown | Review needed |
| `production-source/` | Static site copy | Duplicate |
| `_preserve/` | Preservation copy | May have unique files |

> **Total waste:** ~857M for 3-4 copies of the same static site.

---

## deploy scripts Location

| Script | Current Location | Purpose |
|--------|-----------------|---------|
| `_deploy_static_pages.py` | `bakudanramen.com-current/scripts/` | Deploy all sub-pages to DreamHost |
| `_deploy_links_temp.py` | `bakudanramen.com-current/scripts/` | Deploy /links-temp only |

---

## Dashboard Deploy Analysis

| Field | Value |
|-------|-------|
| **Source** | `E:\Project\Master\Bakudan\dashboard.bakudanramen.com` |
| Git remote | `liemdo28/dashboard.bakudanramen.com.git` |
| Deploy method | DreamHost git push: `ssh://liemdo0208@pdx1.../repo/dashboard.git` |
| Status | ✅ ACTIVE |
| Branch | `phase11-business-execution-platform` |

---

## Conclusion

| Domain | Canonical Source | Deploy Method | Status |
|--------|----------------|--------------|--------|
| `bakudanramen.com` | `E:\Project\Master\Bakudan\bakudanramen.com-current` | SFTP via Python script | ✅ CONFIRMED |
| `dashboard.bakudanramen.com` | `E:\Project\Master\Bakudan\dashboard.bakudanramen.com` | DreamHost git | ✅ CONFIRMED |
| WP `bakudanramen.com` | `E:\Project\bakudanramen.com` | Unknown (outside Master) | ⚠️ NEEDS DECISION |
