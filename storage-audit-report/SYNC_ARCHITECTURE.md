# SYNC ARCHITECTURE
**Generated:** 2026-06-01

---

## Role of Each Drive

| Drive | Label | Role | Sync Direction |
|-------|-------|------|---------------|
| `E:\Project\Master` | **MASTER SOURCE** | Primary development — all edits happen here | Source |
| `F:\Projects` | **PORTABLE MIRROR** | Samsung T7 — works on Mac/Laptop without E: | Destination |
| `G:\My Drive` | **CLOUD BACKUP** | Google Drive — business data + critical project snapshots | Backup |
| `D:\` | **DATA DRIVE** | QuickBooks + Game storage — not synced | Static |

---

## Sync Strategy

### 1. E → F (Daily / On-demand via Script)

```
E:\Project\Master  ──robocopy──►  F:\Projects
```

**Script:** `sync-master-to-portable.ps1`  
**When:** Before leaving office / switching to laptop  
**What:** All active projects excluding `node_modules`, `vendor`, `dist`, `build`, `__pycache__`  
**Direction:** ONE-WAY (E is always authoritative)

```powershell
# Usage
.\sync-master-to-portable.ps1 -Force          # Full sync
.\sync-master-to-portable.ps1 -DryRun          # Preview
.\sync-master-to-portable.ps1 -ProjectFilter "agent*"  # Single project
```

**Exclusions:**
```
node_modules/    vendor/     dist/      build/
__pycache__/    .next/      coverage/  logs/
tmp/            cache/      .wrangler/ out/
releases/       target/     .gradle/
```

---

### 2. E → G:\My Drive (Weekly / Critical Projects)

**Method:** Google Drive desktop sync + manual ZIP snapshots  
**What:** Critical business projects only (not full codebase)

| Project | Sync Method | Frequency |
|---------|------------|-----------|
| `Bakudan/dashboard.bakudanramen.com` | git push → GitHub | On commit |
| `Bakudan/bakudanramen.com-current` | git push → GitHub | On commit |
| `agent-coding` | git push → GitHub | On commit |
| QB data from `D:\QB\` | Manual ZIP → G:\My Drive\Work\QuickBooks-Backup | Monthly |
| Business docs (G:\My Drive\*) | Google Drive native sync | Real-time |

---

### 3. Git as Sync Layer (All Git Projects)

```
E:\Project\Master\<project>
        │
        ├── git push → GitHub ──► F:\Projects\<project>
        │                              │
        │                        git pull ◄──── (on laptop)
        │
        └── GitHub ──► Any new machine (clone)
```

**Projects with git remotes:** 12 active projects tracked on GitHub  
**Benefits:** Full history, branching, conflict resolution  
**Limitation:** Large files (`node_modules`) not in git — need robocopy for those

---

### 4. Two-Way Check (Before syncing back)

**Script:** `compare-projects.ps1`  
**When:** After working on laptop, before syncing changes back to E:

```powershell
.\compare-projects.ps1  # Shows diff without writing anything
```

**Workflow for laptop → PC:**
1. `git commit && git push` all changes on laptop
2. On PC: `git pull` each project
3. Run `compare-projects.ps1` to verify no file drift
4. Manually copy any non-git files if needed

---

## Automation Schedule (Proposed)

| Task | Trigger | Script | Method |
|------|---------|--------|--------|
| E → F sync | Manual (before leaving PC) | `sync-master-to-portable.ps1` | Robocopy |
| Git status check | Weekly | `git-status-all.ps1` | Git |
| Compare E vs F | Before laptop session | `compare-projects.ps1` | File diff |
| G: Drive backup | Google Drive native | Native | Real-time |
| QB backup | Monthly | Manual ZIP | Manual |

### Optional: Windows Task Scheduler Auto-Sync

```powershell
# Run at 6PM daily
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-File E:\Project\Master\sync-master-to-portable.ps1 -Force"
$trigger = New-ScheduledTaskTrigger -Daily -At "18:00"
Register-ScheduledTask -TaskName "SyncMasterToPortable" -Action $action -Trigger $trigger
```

---

## Portable Mode (Laptop/Mac)

```
Samsung T7 (F:)  →  Laptop
    │
    ├── Windows: open F:\Projects directly
    └── Mac:     T7 mounts, symlink /Users/liemdo/Projects → T7
```

**Mac symlink:** Already configured (confirmed in `RUN_ON_MAC_WINDOWS.md`)  
```bash
ln -s /Volumes/T7/Projects /Users/liemdo/Projects
```

**Requirements on laptop:**
- Node.js 20+, Python 3.11+, PHP 8.x, Flutter SDK
- Run `npm install` fresh per project (no node_modules synced)
- `.env` files: check `.env.example` and create locally
- Deploy scripts: update hardcoded `E:\` paths to local path

---

## Conflict Resolution Rules

| Scenario | Rule |
|----------|------|
| Same file changed in E and F | E wins (Master is authoritative) |
| New file created on laptop | `git push` → then `sync-master-to-portable.ps1` will propagate to E |
| File deleted from E | It will NOT be deleted from F (sync script never deletes) |
| Major F-only work done | Copy via `copy-f-only-to-master.ps1` before sync |

---

## Backup Tier Summary

```
Tier 1: Real-time  — GitHub (all git projects)
Tier 2: On-demand  — F:\Projects (robocopy E→F)
Tier 3: Cloud      — G:\My Drive (Google Drive + business data)
Tier 4: Local      — D:\QB (QuickBooks — manual monthly ZIP to G:)
```

> 🎯 **Single source of truth:** `E:\Project\Master`  
> Any file not in E: should be imported there FIRST before any sync.
