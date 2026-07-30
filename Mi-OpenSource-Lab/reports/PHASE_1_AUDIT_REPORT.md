# Phase 1 Audit Report

Date: 2026-06-26
Scope: Mi Open-Source Extension Lab
Policy: audit first, lab first, production only after CEO approval.

## Upstream Metadata

Metadata was checked with GitHub CLI/search on 2026-06-26. GitHub license metadata was not available for several repos, so production is blocked until license files are reviewed directly.

| Project | Candidate Repo | License | Runtime | Main Language | Last Activity | Open Issues | Mi Fit | Risk | Priority | Decision |
|---|---|---|---|---|---|---:|---|---|---|---|
| Open Agent Builder | firecrawl/open-agent-builder | UNKNOWN from GitHub metadata | Node/TypeScript web app | TypeScript | 2025-10-20 | 10 | High | Medium | P1 | Audit + lab adapter only |
| OpenMontage | calesthio/OpenMontage | UNKNOWN from GitHub metadata | Python media pipeline | Python | 2026-06-25 | 44 | High | High | P2 | Audit + external service only |
| TTS Audio Suite | diodiogod/TTS-Audio-Suite | UNKNOWN from GitHub metadata | Python/ComfyUI nodes, model runtimes | Python | 2026-06-24 | 45 | High | High | P3 | Audit + external service only |
| WebLLM | mlc-ai/web-llm | UNKNOWN from GitHub metadata | Browser/WebGPU | TypeScript | 2026-06-09 | 131 | Medium-High | Medium | P4 | Optional dashboard helper only |
| Obscura Browser | h4ckf0r0day/obscura candidate | UNKNOWN until repo verified | Browser automation/runtime | TBD | TBD | TBD | Medium | High | P5 | Lab only |
| Map3D | cartesiancs/map3d candidate | UNKNOWN until repo verified | Web/3D map runtime | TBD | TBD | TBD | Low | Low-Medium | P6 | Future research |

## Security Checks

| Check | Result | Required Control |
|---|---|---|
| Hardcoded secrets | Not embedded in lab artifacts | Block commits containing keys; use `.env.example` only |
| Unknown network calls | Possible in all upstream runtimes | Run inside lab network profile first |
| Auto-download models | High risk for OpenMontage/TTS/WebLLM | Require explicit model approval and model license review |
| File system write access | Expected for video/TTS/artifact tools | Confine writes to `Mi-OpenSource-Lab/pocs` or Mi artifact store |
| Shell execution | Possible in Python/media pipelines | No production shell execution; adapter allowlist only |
| Browser automation permissions | High for Obscura | Lab only; no credentials entered |
| Remote code execution risk | Medium to high for plugin/model runtimes | External service boundary and sandbox |
| License conflict | Unknown until license files verified | Block direct Mi-Core embedding |
| Commercial-use limitation | Unknown for models/media | Require legal/CEO approval |
| AGPL/GPL contamination risk | Unknown | External service boundary only if copyleft applies |

## Phase 1 Result

Status: PARTIAL PASS.

Audit baseline and risk classification are complete. Production is blocked until license files and dependency trees are reviewed. Lab artifacts can proceed because they do not embed upstream source or risky licenses into Mi-Core.
