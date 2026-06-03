# PROJECT SYNC REPORT
**Generated:** 2026-06-01  
**Master (E):** `E:\Project\Master` — Desktop PC  
**Portable (F):** `F:\Projects` — Samsung T7 portable SSD (Mac: `/Users/liemdo/Projects`)

---

## Overview

| Metric | Count / Size |
|--------|-------------|
| Total projects in E (Master) | 14 active |
| Total projects in F (Portable) | 15 folders |
| Projects only in E | 9 |
| Projects only in F | 6 (⚠️ not yet in Master) |
| Projects in both E + F | 6 |
| Duplicate folders in F | 1 pair resolved |
| Total size E (active, est.) | ~4.5G |
| Total size F | 7.0G |
| Difference (F has more) | ~2.5G (includes WP source, archives, loose ZIPs) |

---

## Active Projects

### Bakudan Group (7)

| Project | E Path | F Path | Sync Status |
|---------|--------|--------|------------|
| Bakudan Website (static) | `Bakudan/bakudanramen.com-current` | `bakudanramen.com/` | ⚠️ PENDING — run sync script |
| Bakudan Dashboard (PHP) | `Bakudan/dashboard.bakudanramen.com` | `dashboard.bakudanramen.com/` | ⚠️ E ahead (newer commits) |
| Growth Dashboard | `Bakudan/growth-dashboard` | ❌ Not in F | PENDING SYNC |
| Restaurant Ops (packing-list) | `Bakudan/packing-list` | `packinglist-price/` | ⚠️ Same git, different folder name |
| Mobile TaskFlow | `Bakudan/mobile_taskflow` | ❌ Not in F | PENDING SYNC |
| Review Automation | `Bakudan/review-automation-system` | ❌ Not in F | PENDING SYNC |
| Integration System | `Bakudan/integration-system` | `integration-toasttab-qb/`* | ⚠️ DIFFERENT GIT REPOS |

*`integration-toasttab-qb` on F has a different remote (`integration-toasttab-qb.git`) vs E (`intergration-full.git`). F version is newer (2026-05-30). **Investigation required.**

### Agent Group (2)

| Project | E Path | F Path | Sync Status |
|---------|--------|--------|------------|
| Agent Coding (monorepo) | `agent-coding/` | `agent-coding/` | ❌ F is 10+ commits behind |
| AI Provider Gateway | `agent-coding-api-keys/` | `agent-coding-api-keys/` | ⚠️ No git remote — rsync only |

### QA Group (2)

| Project | E Path | F Path | Sync Status |
|---------|--------|--------|------------|
| QA System | `QA/qa-system` | ❌ Not in F | PENDING SYNC |
| QA Playwright Runner | `QA/qa_runner` | ❌ Not in F | PENDING SYNC |

### Raw Sushi / Other (2)

| Project | E Path | F Path | Sync Status |
|---------|--------|--------|------------|
| Raw Sushi Bar | `RawSushi/RawWebsite` | `rawsushibar/` | ⚠️ Same git, different name |
| LinkTree HL | `Other/LinkTreeHL` | ❌ Not in F | PENDING SYNC |

---

## Archive Projects

| Folder | Location | Notes |
|--------|---------|-------|
| `_archive/bakudanramen.com-old-20260601` | E only | WordPress archived |
| `_archive/BakudanWebsite_Sub2-20260601` | E only | Old branch |
| `_archive/agentai-agency-merged-20260601` | E only | Merged into agent-coding |
| `F:/Projects/Archive/` | F only | 628M — old versions |

---

## Duplicate Analysis

### Resolved Duplicates in F

| Pair | Status |
|------|--------|
| `F/dashboard-bakudanramen` (115M) vs `F/dashboard.bakudanramen.com` (997M) | **SAME GIT** — `dashboard-bakudanramen` is a stale copy. Archive it. |
| `F/bakudanramen.com` (1.3G, WordPress) vs `E/Bakudan/bakudanramen.com-current` (static HTML) | **DIFFERENT PRODUCTS** — F has WP version (different git remote). Both valid. |

### Action Required

```
F:\Projects\dashboard-bakudanramen  →  F:\Projects\Archive\dashboard-bakudanramen-old
```

---

## F-Only Projects (⚠️ Not in Master)

These projects exist ONLY on the portable drive. If F: fails → data lost.

| Project | Size | Git | Priority | Action |
|---------|------|-----|----------|--------|
| **phuyen-2026** | 345M | `git@github.com:liemdo28/phuyen-2026.git` | 🔴 HIGH | Copy to `E:\Project\Master\Other\phuyen-2026` |
| Tester-QA | 52M | none | 🟡 MEDIUM | Copy to `E:\Project\Master\QA\Tester-QA` |
| shared-workspace | 18M | none | 🟡 MEDIUM | Copy to `E:\Project\Master\Agent\shared-workspace` |
| authorize-net-backup | 14M | none | 🟢 LOW | Copy to `E:\Project\Master\Bakudan\authorize-net-backup` |
| guidline-record | 217M | none | 🟢 LOW | Copy to `E:\Project\Master\Bakudan\_docs\` |
| bakudan-sync | 857M | none | 🔵 REVIEW | Contains old website copies — may be archive material |

**Run:** `.\copy-f-only-to-master.ps1` to import these into E.

---

## Data Volume

| Path | Size | Notes |
|------|------|-------|
| `F:\Projects` (total) | **7.0G** | Includes node_modules, ZIPs, archives |
| `F:\Projects\Archive\` | 628M | Old versions |
| `F:\Projects\bakudan-sync\` | 857M | Contains 3 copies of bakudan website |
| `F:\Projects\dashboard.bakudanramen.com\` | 997M | Likely has node_modules |
| `F:\Projects\bakudanramen.com\` | 1.3G | WordPress install (large) |
| `F:\Projects\packinglist-price\` | 1.3G | Likely has vendor/deps |
| Loose ZIPs at F root | ~616M | `*.zip` files — move to Archive |

### F Storage Optimization (save ~1G+)

| Action | Savings |
|--------|---------|
| Delete `node_modules` in `dashboard.bakudanramen.com/` | ~400-600M est. |
| Move loose ZIPs to Archive | ~616M |
| Archive `dashboard-bakudanramen/` (duplicate) | 115M |

---

## Sync Scripts

| Script | Purpose | Run on |
|--------|---------|--------|
| `sync-master-to-portable.ps1` | E → F one-way mirror | Main PC (PowerShell) |
| `compare-projects.ps1` | Show E vs F diff (read-only) | Any machine |
| `copy-f-only-to-master.ps1` | Import F-only projects → E | Main PC |
| `git-status-all.ps1` | Git status across all projects | Main PC |

### Quick Sync Command

```powershell
# Preview (safe)
.\sync-master-to-portable.ps1 -DryRun

# Sync everything
.\sync-master-to-portable.ps1 -Force

# Sync one project
.\sync-master-to-portable.ps1 -ProjectFilter "agent-coding" -Force
```

---

## Portable Mode Checklist (F: on Laptop/Mac)

- [x] F: is Samsung T7 — works on Mac via `/Users/liemdo/Projects` symlink
- [x] `RUN_ON_MAC_WINDOWS.md` exists with setup instructions
- [x] No absolute `E:\` paths in core source files (deploy scripts excluded — they're PC-only tools)
- [ ] **phuyen-2026** not backed up to E — fix immediately
- [ ] `agent-coding` on F is stale — needs re-sync
- [ ] 6 projects missing from F — run `sync-master-to-portable.ps1`
- [ ] Loose ZIPs at F root — move to F/Archive

---

## Git Remote Summary

| Project | Remote | E Branch | Push Status |
|---------|--------|---------|------------|
| agent-coding | `liemdo28/agent-coding.git` | main | ✅ Pushed (ff03de4) |
| bakudanramen.com-current | `heoventure/BakudanWebsite.git` | main | ✅ |
| dashboard.bakudanramen.com | `liemdo28/dashboard.bakudanramen.com.git` | phase11-business-execution-platform | ✅ |
| qa-system | `liemdo28/qa-system.git` | feat/qa-phase2-wave1 | verify |
| packing-list | `liemdo28/packing-list.git` | master | verify |
| mobile_taskflow | `liemdo28/mobile-taskflow.git` | master | verify |
| review-automation-system | `liemdo28/review-automation-system.git` | master | verify |
| integration-system | `liemdo28/intergration-full.git` | main | verify |
| growth-dashboard | `liemdo28/growth-dashboard.git` | main | verify |
| RawWebsite | `liemdo28/rawwebsite.git` | master | verify |
| LinkTreeHL | `liemdo28/LinkTreeHL.git` | master | verify |
| F:phuyen-2026 | `git@github.com:liemdo28/phuyen-2026.git` | — | ⚠️ NOT IN E |
| F:integration-toasttab-qb | `liemdo28/integration-toasttab-qb.git` | — | ⚠️ DIFFERENT FROM E |

---

## Immediate Action Items (Priority Order)

| # | Action | Command |
|---|--------|---------|
| 1 | 🔴 Copy `phuyen-2026` to E | `.\copy-f-only-to-master.ps1` |
| 2 | 🔴 Sync E → F (6 missing projects) | `.\sync-master-to-portable.ps1 -Force` |
| 3 | 🟡 Investigate `integration-toasttab-qb` vs `integration-system` | Compare git logs |
| 4 | 🟡 Archive `F/dashboard-bakudanramen` | Manual move to `F/Archive` |
| 5 | 🟡 Move F root ZIPs to `F/Archive` | Manual |
| 6 | 🟢 Run full git status | `.\git-status-all.ps1` |
| 7 | 🟢 Register new E projects in agent-coding | `npm run projects:connect` |
