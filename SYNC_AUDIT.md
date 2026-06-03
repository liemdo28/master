# SYNC AUDIT REPORT
**Generated:** 2026-06-01  
**Master:** `E:\Project\Master` (MASTER SOURCE)  
**Portable:** `F:\Projects` (PORTABLE MIRROR)

---

## 1. Projects Only in E (Master)

| Project | Path | Git Remote | Size | Last Commit |
|---------|------|-----------|------|------------|
| Bakudan Website | `Bakudan/bakudanramen.com-current` | `heoventure/BakudanWebsite.git` | 1.3G* | 2026-05-04 |
| Bakudan Growth Dashboard | `Bakudan/growth-dashboard` | `liemdo28/growth-dashboard.git` | — | 2026-04-07 |
| Bakudan Mobile TaskFlow | `Bakudan/mobile_taskflow` | `liemdo28/mobile-taskflow.git` | — | 2026-04-21 |
| Bakudan Review Automation | `Bakudan/review-automation-system` | `liemdo28/review-automation-system.git` | — | 2026-04-16 |
| Bakudan Integration System | `Bakudan/integration-system` | `liemdo28/intergration-full.git` | — | 2026-04-17 |
| QA System | `QA/qa-system` | `liemdo28/qa-system.git` | — | 2026-04-24 |
| QA Playwright Runner | `QA/qa_runner` | none | — | 2026-06-01 |
| LinkTree HL | `Other/LinkTreeHL` | `liemdo28/LinkTreeHL.git` | — | 2026-04-21 |
| agentai-agency (deprecated) | `agentai-agency/` | none (locked) | — | 2026-06-01 |

*Size includes node_modules

---

## 2. Projects Only in F (Portable)

> ⚠️ These exist only on F — they have NEVER been synced to E. Action required.

| Project | Path | Git Remote | Size | Last Commit | Action |
|---------|------|-----------|------|------------|--------|
| **Phú Yên 2026** | `F:/Projects/phuyen-2026` | `git@github.com:liemdo28/phuyen-2026.git` | 345M | 2026-05-27 | **⚠️ COPY TO E** |
| Authorize.net Backup | `F:/Projects/authorize-net-backup` | none | 14M | 2026-05-22 | COPY TO E |
| Tester-QA | `F:/Projects/Tester-QA` | none | 52M | 2026-05-22 | COPY TO E |
| Shared Workspace | `F:/Projects/shared-workspace` | none | 18M | 2026-05-29 | COPY TO E |
| Guideline Record | `F:/Projects/guidline-record` | none (pkg: guideforge) | 217M | 2026-05-27 | COPY TO E (docs) |
| Bakudan Sync | `F:/Projects/bakudan-sync` | none | 857M | 2026-05-22 | REVIEW (contains copies) |

**Loose files in F root:**

| File | Size | Action |
|------|------|--------|
| `RUN_ON_MAC_WINDOWS.md` | 128K | KEEP (portable guide) |
| `agent-coding-boot-proof.png` | 128K | MOVE to archive |
| `dashboard.bakudanramen.com 2.zip` | 249M | MOVE to F/Archive |
| `dashboard.bakudanramen.com.zip` | 363M | MOVE to F/Archive |
| `integration-toasttab-qb.zip` | 4.4M | MOVE to F/Archive |

---

## 3. Projects in Both E and F

| Project | E Path | F Path | Same Git? | E Last | F Last | In Sync? |
|---------|--------|--------|-----------|--------|--------|---------|
| agent-coding | `agent-coding/` | `F:/Projects/agent-coding` | YES (`liemdo28/agent-coding.git`) | 2026-06-01 | 2026-05-22 | ❌ E AHEAD (10+ commits) |
| agent-coding-api-keys | `agent-coding-api-keys/` | `F:/Projects/agent-coding-api-keys` | NO git remote | 2026-06-01 | 2026-05-29 | ❌ NEEDS SYNC |
| Dashboard | `Bakudan/dashboard.bakudanramen.com` | `F:/Projects/dashboard.bakudanramen.com` | YES (`liemdo28/dashboard.bakudanramen.com.git`) | 2026-05-29 | (no commits cached) | ⚠️ CHECK |
| Packing List | `Bakudan/packing-list` | `F:/Projects/packinglist-price` | YES (`liemdo28/packing-list.git`) | 2026-05-08 | 2026-05-22 | ⚠️ DIFFERENT NAMES |
| Raw Sushi Bar | `RawSushi/RawWebsite` | `F:/Projects/rawsushibar` | YES (`liemdo28/rawwebsite.git`) | 2026-04-24 | 2026-05-22 | ⚠️ DIFFERENT NAMES |
| integration-toasttab-qb | `Bakudan/integration-system` | `F:/Projects/integration-toasttab-qb` | ❌ DIFFERENT (`intergration-full` vs `integration-toasttab-qb`) | 2026-04-17 | 2026-05-30 | ❌ DIFFERENT REPOS |

---

## 4. Duplicates Within F

| Duplicate Pair | Evidence | Action |
|---------------|---------|--------|
| `F/dashboard-bakudanramen` (115M) + `F/dashboard.bakudanramen.com` (997M) | Same git remote, identical file structure | **ARCHIVE `dashboard-bakudanramen`** |
| `F/bakudanramen.com` (1.3G, git:`liemdo28/bakudanramen.com.git`) vs `E/bakudanramen.com-current` (git:`heoventure/BakudanWebsite.git`) | DIFFERENT repos — F=WordPress, E=static | **DIFFERENT PRODUCTS** — F is WP version |

---

## 5. Critical Findings

### ⚠️ F-Only Active Project: phuyen-2026
- `F:/Projects/phuyen-2026` (345M) — Phú Yên 2026 AI Travel Assistant
- Has active git: `git@github.com:liemdo28/phuyen-2026.git`
- **NOT in E at all** — risk of losing this project if F drive fails

### ⚠️ Two Integration Repos
- `E/Bakudan/integration-system` → `liemdo28/intergration-full.git` (typo in name)
- `F/Projects/integration-toasttab-qb` → `liemdo28/integration-toasttab-qb.git`
- Last commit on F: 2026-05-30 (newer than E: 2026-04-17)
- **F version is newer** — needs investigation before deciding canonical

### ⚠️ agent-coding on F is stale
- F has old commits (no recent work)
- E has 10+ commits ahead including agency merge
- F/agent-coding needs full re-sync

---

## 6. Total Inventory Count

| Location | Count | Total Size |
|----------|-------|-----------|
| E:\Project\Master (active) | 14 projects | ~3-4G est. |
| F:\Projects (total) | 15 folders + loose files | 7.0G |
| E only | 9 projects | — |
| F only | 6 projects + loose files | ~1.6G |
| Both E+F | 6 projects | — |
| Duplicates in F | 1 pair | 115M wasted |
