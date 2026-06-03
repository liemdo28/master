# CLEANUP PLAN
**Generated:** 2026-06-01  
**⚠️ DO NOT EXECUTE — awaiting CEO approval**  
**Phase 0: This file is read-only planning. No actions taken.**

---

## Priority Tiers

| Priority | Risk | Action Type |
|----------|------|------------|
| 🔴 P0 | Zero risk | Delete test/junk files |
| 🟡 P1 | Low risk | Move stale copies to archive |
| 🟢 P2 | Medium risk | Consolidate projects |
| 🔵 P3 | Requires planning | Structural reorganization |

---

## 🔴 P0 — Zero Risk (Safe to Delete Immediately)

### E:\ Root Junk Files
| File | Size | Reason |
|------|------|--------|
| `E:\test.txt` | <1KB | Test file |
| `E:\test_node.txt` | <1KB | Test file |
| `E:\test_write.txt` | <1KB | Test file |
| `E:\Local Disk (C) - Shortcut.lnk` | <1KB | Stale shortcut |
| **Total recoverable:** | ~5KB | |

### D:\ QuickBooks Auto-Recovery Old Files
| File | Size | Reason |
|------|------|--------|
| `D:\QB\B1\QuickBooksAutoDataRecovery\*.ADR.old` | 134M | Old recovery file |
| `D:\QB\Raw\QuickBooksAutoDataRecovery\*.ADR.old` | 320M | Old recovery file |
| **Total recoverable:** | ~454MB | |

---

## 🟡 P1 — Low Risk (Move to Archive)

### F:\.Trashes — Mac Trash (Empty This!)
| Path | Size | Reason |
|------|------|--------|
| `F:\.Trashes\501\Slipt Fiction\` | ~170GB | Mac trash — Split Fiction game |
| `F:\.Trashes\501\It take two\` | ~33GB | Mac trash — It Takes Two game |
| `F:\.Trashes\501\*.zip` (3 files) | ~660MB | Mac trash — old dashboard ZIPs |
| **Total recoverable:** | **~204GB** | Empty Mac Trash from Finder |

### E:\ Test Files at Root
Already listed in P0 above.

### Duplicate ZIPs in F:\Projects\Archive
| File | Size | Reason |
|------|------|--------|
| `F:\Projects\Archive\dashboard.bakudanramen.com.zip` | 363M | ZIP already in `dashboard.bakudanramen.com 2.zip` |
| `F:\Projects\Archive\guidline-record_snapshot_2026-05-22.zip` | 1.3M | Small, keep |
| **Total recoverable:** | ~363MB | Keep only one copy |

---

## 🟢 P2 — Project Consolidation

### 1. Move E:\Project shadow projects → E:\Project\Master

| Move | From | To | Risk |
|------|------|----|------|
| bakudanramen.com (WP) | `E:\Project\bakudanramen.com` | `E:\Project\Master\Bakudan\bakudanramen.com-wordpress` | Low — just a move |
| Bakudan old copies | `E:\Project\Bakudan\` | `E:\Project\Master\_archive\Bakudan-old-20260601` | Low |
| Raw | `E:\Project\Raw\` | `E:\Project\Master\_archive\Raw-old-20260601` | Low |
| review-management-mcp | `E:\Project\review-management-mcp` | `E:\Project\Master\Agent\review-management-mcp` | Low |
| Toasttab Quickbook | `E:\Project\Toasttab Quickbook` | `E:\Project\Master\Bakudan\integration-toasttab-old` or archive | Low |
| VC | `E:\Project\VC` | `E:\Project\Master\Other\VC` | Low |

**Est. cleanup:** Reduces E:\Project clutter significantly

### 2. Resolve agent-coding locked folders (run after restart)
| Action | Command |
|--------|---------|
| Run cleanup script | `E:\Project\Master\_cleanup_after_restart.bat` |
| Moves agent-coding, agent-coding-api-keys, packing-list (root copies), LinkTreeHL, agentai-agency |

### 3. Consolidate F:\ project names to match E:\
| Current F: name | Target F: name | Reason |
|-----------------|---------------|--------|
| `packinglist-price` | `packing-list` | Match E canonical name |
| `rawsushibar` | `RawWebsite` | Match E canonical name |
| `integration-toasttab-qb` | `integration-toasttab-qb` | Keep — different repo |

### 4. Investigate and resolve integration repos
| Action | Detail |
|--------|--------|
| Compare `E:\integration-system` vs `F:\integration-toasttab-qb` | Different git remotes |
| Decide which is canonical | F version is 43 days newer (2026-05-30) |
| Merge or keep both as separate projects | CEO decision needed |

---

## 🔵 P3 — Large-Scale Cleanup

### F:\ Games — Move Duplicate Installers
| Path | Size | Action |
|------|------|--------|
| `D:\Game\0272570196*.rar` (It Takes Two installers) | 47GB | Game already installed in F:\Game — delete D: installers |
| `F:\Game\Brothers A Tale...\Brothers.A.Tale*.bin` (4GB×3) | 12GB | GOG installer after game extracted |
| Keep: All F:\Game installed game folders | ~200GB | Keep for playing |

**Est. recoverable:** ~60GB

### G:\My Drive — Organize
| Action | Detail |
|--------|--------|
| Create `Work/` and `Personal/` subfolders | Move files into proper categories |
| Move Commission sheets → `Work/Bakudan/Finance/` | |
| Move Airbnb P&L → `Work/Bakudan/Finance/` | |
| Clean up unnamed folders (`New folder`, `Untitled`) | |

---

## Space Recovery Estimate

| Category | Action | Recoverable |
|----------|--------|------------|
| F:\.Trashes (Mac Trash) | Empty trash from Mac | **~204GB** |
| D:\Game duplicate installers | Delete after verifying games work | **~47GB** |
| GOG game installer .bin files | Delete after install | **~12GB** |
| QB auto-recovery .old files | Delete .ADR.old only | **~454MB** |
| Duplicate dashboard ZIPs | Keep one copy | **~363MB** |
| E:\ root junk | Delete test files | **~5KB** |
| F:\Projects\Archive\bakudanramen-debug | Git debug artifacts | **~409MB** |
| **TOTAL RECOVERABLE** | | **~265GB** |

---

## Files Safe to Delete (Full List)

### Confirmed Junk (P0)
```
E:\test.txt
E:\test_node.txt
E:\test_write.txt
E:\Local Disk (C) - Shortcut.lnk
D:\QB\B1\QuickBooksAutoDataRecovery\jht ventures inc (Feb 2025).qbw.ADR.old
D:\QB\Raw\QuickBooksAutoDataRecovery\RawStockton.qbw.ADR.old
```

### After CEO Approval (P1)
```
F:\.Trashes\501\*  (via Mac Finder > Empty Trash)
F:\Projects\Archive\dashboard.bakudanramen.com.zip  (keep the 2.zip version)
```

### After Investigation (P2/P3)
```
D:\Game\0272570196.dmh.it.takes.two.v20241213.part*.rar  (if game works in F:\)
F:\Projects\Archive\bakudanramen-debug\  (if git history not needed)
```

---

## Execution Order (After CEO Approval)

1. `_cleanup_after_restart.bat` — locked folder moves
2. P0 junk file deletes
3. Empty F:\.Trashes from Mac (saves 204GB)
4. P1 archive moves
5. P2 project consolidation
6. Run `sync-master-to-portable.ps1` to sync E→F
7. Verify all projects still build
8. P3 large-scale cleanup
