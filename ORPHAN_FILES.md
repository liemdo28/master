# ORPHAN FILES

Generated: 2026-06-01 19:03:40 +0700
Root: `E:\Project\Master`

## Root-Level Loose Files

| File | Classification | Action |
|---|---|---|
| `_cleanup_after_restart.bat` | Operational script | Move under Agent OS script executor or journal scripts after ownership decision. |
| `compare-projects.ps1` | Operational script | Keep as migration/audit tool; register as Script Executor candidate. |
| `copy-f-only-to-master.ps1` | Operational script | High-risk copy tool; require approval before execution. |
| `git-status-all.ps1` | Operational script | Useful Git Executor helper; migrate into Agent OS executor toolkit. |
| `sync-master-to-portable.ps1` | Operational script | High-risk sync tool; require approval and artifact log per run. |
| Historical root audit reports | Report / documentation | Keep as prior audit evidence; index from `master-journal` later. |
| Current audit reports | Report / documentation | Canonical output for this audit pass. |

## Empty / Placeholder Directories

- `-p`
- `agent-coding` at root
- `agentai-agency` at root

## Tool-State / Non-Project Directories

- `.claude` is assistant/tool state.
- `.wrangler` is Cloudflare tooling state.
- `reports` and `storage-audit-report` are artifact/report containers, not product code.

## Orphan Risk

Current root scripts can mutate large parts of the company workspace. Under Agent OS they should not remain loose executable files; they should be wrapped as explicit `Script Executor` commands with approval, logs, artifacts, and kill-switch support.
