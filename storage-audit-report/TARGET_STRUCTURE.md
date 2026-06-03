# TARGET STRUCTURE — PROPOSED
**Generated:** 2026-06-01 | **Status: PROPOSAL — awaiting CEO approval**

---

## E:\Project\Master (MASTER SOURCE — current + target)

```
E:\Project\Master\
│
├─ Bakudan\                          # Bakudan Ramen ecosystem
│   ├─ bakudanramen.com-current\     # ✅ EXISTS — static site (canonical)
│   ├─ bakudanramen.com-wordpress\   # ← MOVE FROM E:\Project\bakudanramen.com
│   ├─ dashboard.bakudanramen.com\   # ✅ EXISTS
│   ├─ growth-dashboard\             # ✅ EXISTS
│   ├─ packing-list\                 # ✅ EXISTS
│   ├─ mobile_taskflow\              # ✅ EXISTS
│   ├─ review-automation-system\     # ✅ EXISTS
│   ├─ integration-system\           # ✅ EXISTS (intergration-full)
│   ├─ authorize-net-backup\         # ✅ EXISTS
│   └─ _docs\                        # Dashboard guidelines, audit docs
│       └─ guidline-record\
│
├─ Agent\                            # AI/Agent ecosystem
│   ├─ agent-coding\                 # ← MOVE from root (pending restart)
│   ├─ agent-coding-api-keys\        # ← MOVE from root (pending restart)
│   ├─ shared-workspace\             # ✅ EXISTS
│   └─ review-management-mcp\        # ← MOVE from E:\Project\review-management-mcp
│
├─ QA\                               # Quality assurance tools
│   ├─ qa-system\                    # ✅ EXISTS
│   ├─ qa_runner\                    # ✅ EXISTS
│   └─ Tester-QA\                    # ✅ EXISTS
│
├─ RawSushi\                         # Raw Sushi Bar
│   └─ RawWebsite\                   # ✅ EXISTS
│
├─ Other\                            # Miscellaneous active
│   ├─ LinkTreeHL\                   # ✅ EXISTS
│   ├─ phuyen-2026\                  # ✅ EXISTS
│   └─ VC\                           # ← MOVE from E:\Project\VC
│
├─ _archive\                         # Archived/legacy (do not edit)
│   ├─ bakudanramen.com-old-20260601\
│   ├─ BakudanWebsite_Sub2-20260601\
│   ├─ agentai-agency-merged-20260601\
│   └─ review-automation-system.zip
│
├─ _scripts\                         # Shared scripts (sync, audit, etc.)
│   ├─ sync-master-to-portable.ps1
│   ├─ compare-projects.ps1
│   ├─ git-status-all.ps1
│   └─ copy-f-only-to-master.ps1
│
└─ storage-audit-report\             # ✅ EXISTS — audit reports
```

---

## F:\Projects (PORTABLE MIRROR — current + target)

```
F:\Projects\
│
├─ bakudanramen.com\                 # Mirror of E canonical (static)
├─ bakudanramen.com-wordpress\       # Mirror of WP version
├─ dashboard.bakudanramen.com\       # Mirror
├─ growth-dashboard\                 # ← ADD (missing)
├─ packing-list\                     # (currently: packinglist-price)
├─ mobile_taskflow\                  # ← ADD (missing)
├─ review-automation-system\         # ← ADD (missing)
├─ integration-system\               # (currently: integration-toasttab-qb — different repo!)
├─ agent-coding\                     # Mirror (currently stale)
├─ agent-coding-api-keys\            # Mirror
├─ qa-system\                        # ← ADD (missing)
├─ RawWebsite\                       # (currently: rawsushibar)
├─ phuyen-2026\                      # ✅ EXISTS
├─ Tester-QA\                        # ✅ EXISTS
├─ shared-workspace\                 # ✅ EXISTS
│
├─ Archive\                          # ✅ EXISTS — old snapshots
│
└─ RUN_ON_MAC_WINDOWS.md             # ✅ EXISTS — portable guide
```

---

## G:\My Drive (CLOUD BACKUP — current + target)

```
G:\My Drive\
│
├─ Work\                             # ← REORGANIZE existing work files
│   ├─ Bakudan\
│   │   ├─ Finance\                  # Commissions, expenses, P&L
│   │   ├─ QuickBooks-Backup\        # QB backups from D:\
│   │   └─ Operations\
│   ├─ BST\                          # ✅ EXISTS (730M)
│   ├─ RawSushi\
│   ├─ ATF\
│   └─ Projects-Backup\              # Source code backups (critical projects)
│       ├─ agent-coding-backup\
│       └─ dashboard-backup\
│
├─ Personal\                         # ✅ EXISTS (2.4G)
│   ├─ Photos\
│   ├─ Music\
│   └─ Docs\
│
└─ Shared\                           # ✅ EXISTS (team files)
    ├─ Team VN\
    └─ Hoang Le\
```

---

## D:\ (BUSINESS DATA — minimal change)

```
D:\
├─ QB\                               # ✅ KEEP AS-IS — QuickBooks data
│   ├─ B1\  (Bakudan Ramen + JHT)
│   ├─ B2\  (Bakudan BP)
│   ├─ B3\
│   ├─ Copper\
│   ├─ IFT\
│   └─ Raw\ (Raw Sushi Bar)
│
├─ Bakudan Download\                 # Business downloads
│   └─ Invoice\
│
└─ Game\                             # Personal games — MOVE TO F:\Game or delete installers
```

---

## Naming Conventions (Proposed)

| Rule | Example |
|------|---------|
| Active project: domain name | `bakudanramen.com-current`, `dashboard.bakudanramen.com` |
| Archived project: name + date | `bakudanramen.com-old-20260601` |
| Group folders: PascalCase | `Bakudan/`, `Agent/`, `QA/` |
| Scripts: kebab-case | `sync-master-to-portable.ps1` |
| No spaces in project names | `packing-list` not `Packing List` |
