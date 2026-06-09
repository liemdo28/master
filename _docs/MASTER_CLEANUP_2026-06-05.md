# Master Workspace Cleanup - 2026-06-05

## Decision

`E:\Project\Master` is treated as a workspace that contains multiple standalone project repositories. The root Git repository should not track the contents of nested project repos as source files or submodules unless an explicit `.gitmodules` contract exists.

## Active Project Map

| Alias | Canonical path | Remote / role |
| --- | --- | --- |
| whatsapp-ai-gateway | `whatsapp-ai-gateway` | local WhatsApp AI operations gateway |
| agent-coding | `Agent/agent-coding` | `liemdo28/agent-coding` |
| agent-coding-api-keys | `Agent/agent-coding-api-keys` | local provider/API-key gateway |
| agentai-agency | `Agent/agent-coding/apps/agency` | AgentAI control-plane app inside agent-coding |
| agent-os | `agent-os` | local Agent OS control plane |
| ai-search-tool | `Agent/ai-search-tool` | `liemdo28/ai-search-tool` |
| cv-format-web | `Agent/ai-search-tool/cv-format-web` | `liemdo28/cv-format-web` |
| shared-workspace | `Agent/shared-workspace` | local shared agent workspace |
| BakudanWebsite_Sub | `Bakudan/bakudanramen.com-current` | `liemdo28/bakudanwebsite_sub` |
| dashboard.bakudanramen.com | `Bakudan/dashboard.bakudanramen.com` | `liemdo28/dashboard.bakudanramen.com` |
| growth-dashboard | `Bakudan/growth-dashboard` | `liemdo28/growth-dashboard` |
| integration-full | `Bakudan/integration-system` | `liemdo28/intergration-full` |
| mobile_taskflow | `Bakudan/mobile_taskflow` | `liemdo28/mobile-taskflow` |
| packing-list | `Bakudan/packing-list` | `liemdo28/packing-list` |
| review-system | `Bakudan/review-automation-system` | `liemdo28/review-automation-system` |
| review-automation-system | `Bakudan/review-automation-system` | canonical folder ID for review-system |
| RawWebsite | `RawSushi/RawWebsite` | `liemdo28/rawwebsite` |
| review-management-mcp | `Agent/ai-search-tool/review-management-mcp` | `liemdo28/review-management-mcp` |
| dau-tu | `Other/dau-tu` | `liemdo28/investment-analys` |
| it-takes-two-inspired-game | `Other/It-Takes-Two-Inspired-Game` | `liemdo28/gameittakes2` |
| linktreehl | `Other/LinkTreeHL` | `liemdo28/LinkTreeHL` |
| openclaw | `Other/openclaw` | local web project |
| phuyen-2026 | `Other/phuyen-2026` | `liemdo28/phuyen-2026` |
| tu-vi | `Other/tu-vi` | `liemdo28/tu-vi-ai-workspace` |
| tuya | `Other/Tuya` | `liemdo28/Tuya` |
| master-exporter | `_platform/master-exporter` | local platform export tooling |
| master-indexer | `_platform/master-indexer` | local source/index tooling |
| qb-ops-agent | `_platform/qb-ops-agent` | local QuickBooks operations agent |
| pc-qa-stability-certification | `_platform/QA/PC-QA-Stability-Certification` | local QA tooling |
| qa-runner | `_platform/QA/qa_runner` | local QA runner |
| qa-system | `_platform/QA/qa-system` | `liemdo28/qa-system` |
| tester-qa | `_platform/QA/Tester-QA` | local QA control center |

## Cleanup Applied

- Removed broken nested worktree gitlinks from `Other/phuyen-2026` index:
  - `.claude/worktrees/bold-bose-021f3f`
  - `.claude/worktrees/upbeat-goodall-87b383`
- Removed stale root gitlinks from the `Master` index without deleting working directories:
  - `Other/dau-tu`
  - `Other/phuyen-2026`
  - `Other/tu-vi`
  - `QA/PC-QA-Stability-Certification`
  - `QA/qa-system`
  - `RawSushi/RawWebsite`
- Added root ignore rules for nested repos, archive folders, local-agent runtime folders, and generated post exports.
- Updated AgentAI/agent-coding project manifests and registries so build/dev/QA commands resolve to existing canonical paths.
- Exposed all active standalone `.git` projects through `agent-coding` control surfaces:
  - `apps.api.main.PROJECT_REGISTRY`
  - `apps.api.project_manifests.MANIFESTS`
  - `core.agents.dev_agent.PROJECT_FOLDERS`
  - command resolver aliases and intent project patterns
  - unified dashboard project model and scanner map
- Added Node/local-agent live registry coverage in `Agent/agent-coding/local-agent/orchestrator/ProjectRegistry.js`:
  - canonical Master projects are available even without `~/.local-agent-global/projects.json`
  - legacy registry entries are merged only when they still point to a real source root inside `Master`
  - canonical project IDs win over old `proj-*` registry IDs to prevent build/dev commands from targeting stale aliases
- Added source audit command:
  - `cd Agent/agent-coding && npm run projects:live-audit`
  - output: `Agent/agent-coding/docs/agent-os/MASTER_SOURCE_LIVE_AUDIT.md`
  - latest run: 31 live project roots; 8 connected clean, 17 dirty, 6 need source review
- Archived generated nested RawWebsite export clone:
  - From: `Agent/agent-coding/apps/agency/data/post_exports/rawwebsite_clone`
  - To: `_archive/runtime-post-exports-20260605/rawwebsite_clone`
- Consolidated release/archive ZIP artifacts into `_archive/release-artifacts-20260605`:
  - `integration-system.zip` (426 KB)
  - `ToastPOSManager-release.zip` (280 MB)
  - `whatsapp-ai-gateway-nlp-windows-runtime.zip` (3.7 MB)
  - `ai-search-tool.zip` (254 MB)
  - `master-artifacts (2).zip` (4.9 MB)
  - `review-automation-system.zip` (75.9 MB)

## Sensitive / Runtime Inventory

These folders were inventoried but not moved because they may be required at runtime:

| Path | Approx size | Action |
| --- | ---: | --- |
| `Agent/agent-coding-api-keys` | 46 MB | Keep for now; migrate secrets before deleting |
| `whatsapp-ai-gateway/secrets` | 2 KB | Keep for runtime; migrate to env/secret manager first |
| `whatsapp-ai-gateway/data` | 290 MB | Keep for runtime/session history |
| `Agent/agent-coding/apps/agency/data` | 14 MB | Keep; generated export clone was moved out |

## Do Not Delete Without Separate Confirmation

- `_archive/*` project snapshots and duplicate repos.
- `Agent/agent-coding-api-keys` until secrets are migrated.
- `whatsapp-ai-gateway/data`, `secrets`, and runtime session folders.
- Dirty source trees inside standalone repos.
- Large release ZIPs until current release artifacts are confirmed copied elsewhere.

## Remaining Recommended Work

- Commit the root workspace cleanup separately from each nested repo cleanup.
- Commit the `agent-coding` registry/path fixes separately.
- Commit the `Other/phuyen-2026` gitlink cleanup separately.
- Decide whether `BakudanWebsite_Sub2` should remain an archive alias or be restored as an active repo.
- Decide whether `review-management-mcp` canonical source should be the copy under `Agent/ai-search-tool` or a future standalone location.
