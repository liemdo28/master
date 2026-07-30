# MI ARCHITECTURE AUDIT — CONTINUATION

*(Append to MI_MASTER_ARCHITECTURE_AUDIT.md)*

---

## 5. PROPOSED TARGET STRUCTURE (continued)

```
│       ├── jarvis/                     ← proactive monitor ✅
│       ├── memory/                     ← executive memory ✅
│       ├── graph/                     ← ownership graph ✅
│       ├── operational-memory/        ← Phase 15 (needs fix) ⚠️
│       ├── providers/                 ← Ollama model router ✅
│       ├── visibility/                ← connector health ✅
│       ├── production-loop/           ← heartbeat + freshness ✅
│       ├── self-improving-memory/     ← learning loop ✅
│       ├── cross-agent-intelligence/  ← agent coordination ✅
│       ├── executive-daily-brief/     ← 07:00 briefing ✅
│       ├── creative-division/         ← ComfyUI/creative executor
│       ├── content-division/          ← SEO/content orchestration
│       ├── business-knowledge-graph/  ← impact/dependency graph
│       ├── financial-intelligence/    ← CFO engine
│       └── ...
│
├── _departments\                      ← NEW: standalone department workspaces
│   ├── game-department\               ← game execution + builds
│   ├── qa-department\                ← independent QA evaluation
│   └── report-department\             ← report generation
│
├── _governance\                       ← NEW: open-source governance
│   ├── licenses/
│   ├── security-reviews/
│   ├── dependency-inventory/
│   ├── architecture-decisions/
│   └── rollback-plans/
│
├── _operations\                       ← NEW: ops scripts
│   ├── startup/                       ← PM2 / autostart scripts
│   ├── health-checks/                ← port / service health checks
│   ├── backups/                       ← DB backup scripts
│   └── disaster-recovery/             ← recovery runbooks
│
├── Projects\                          ← business projects (EXISTING)
│   ├── Bakudan/
│   ├── RawSushi/
│   ├── DoorDash/
│   └── ...
│
├── _archive\                          ← QUARANTINE location (EXISTING)
├── _audit\                           ← this audit (EXISTING)
└── [stale projects at root → migrate to Projects/ or _archive/]
```

### Key principle: Do NOT force-move mi-core contents
The `mi-core/server/src/` directory has deeply interconnected imports. Moving files would break TypeScript paths and runtime requires. The target structure is achieved through **logical organization + documentation**, not file moves.

---

## 6. DUPLICATE AND STALE DIRECTORY ANALYSIS

From GIT_REPOSITORIES.csv baseline:

| Path | Issue | Recommendation |
|------|-------|----------------|
| `Bakudan\packing-list\packing-list` | Repo nested inside itself | INVESTIGATE: likely clone error. Quarantine inner copy. |
| `Other\LinkTreeHL\LinkTreeHL` | Repo nested inside itself | INVESTIGATE: same as above |
| `Other\phuyen-2026\phuyen-2026` | Repo nested inside itself | INVESTIGATE: same as above |
| `Agent\agent-coding-api-keys\` | Dirty, nonstandard name | KEEP (but add to .gitignore if secrets) |
| `Agent\shared-workspace\` | No remote, dirty | INVESTIGATE purpose before archiving |
| `mi-core/` (root-level) | Near-mirror of main repo | ARCHIVE (stale duplicate of working mi-core) |
| `server/` (root-level) | Stale — real server is mi-core/server/ | ARCHIVE (verified stale — not in ecosystem.config) |
| `ui/` (root-level) | Stale — real ui is mi-core/ui/ | ARCHIVE (verified stale) |
| `mi-core/mi-core/` | Deeply nested duplicate | ARCHIVE (2x nested) |

From TEMP_FILES_REPORT.md: **1,610 temp/cache/log directories** — large cleanup candidates.

From LARGE_FILES_REPORT.md: **52 files >25MB** including .zip files, agent tools, dataset JSON files.

---

## 7. OPEN-SOURCE INTEGRATION AUDIT

The prompt lists 8 open-source projects to evaluate. Current status:

| Project | Category | Location | Status | Action |
|---------|----------|