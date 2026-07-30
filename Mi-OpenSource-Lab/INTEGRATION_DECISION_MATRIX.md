# Integration Decision Matrix — Mi Open-Source Extension

**Version:** 1.0.0 | **Date:** 2026-06-26

---

## Current Execution Note

The initial scoring below is superseded by the conservative Phase 1 and Phase 11 reports where GitHub license metadata is unknown or incomplete. Treat every production recommendation as "adapter/lab only until license and dependency files are verified." No upstream source has been embedded into Mi-Core.

---

## Decision Framework

Each project is evaluated across 5 dimensions:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Technical Fit | 25% | Does it solve a real Mi need? |
| Security Posture | 25% | License, secrets, RCE risk |
| Production Readiness | 20% | Stable API, active maintenance |
| Integration Complexity | 15% | Adapter effort required |
| License Compatibility | 15% | AGPL/GPL contamination risk |

**Decision Scale:**
- **Integrate** → Score ≥ 70, no critical risks
- **Integrate with Guardrails** → Score 50-69, clear risks mitigated
- **Lab Only** → Score 30-49, useful but risky or unstable
- **Reject** → Score < 30 or critical unmitigated risks

---

## Scoring Results

### P1 — Open Agent Builder

| Dimension | Score | Max | Notes |
|-----------|-------|-----|-------|
| Technical Fit | 22 | 25 | Direct match for Mi Workflow Studio |
| Security Posture | 18 | 25 | License metadata requires verification; workflow execution must stay sandboxed |
| Production Readiness | 16 | 20 | Active repo, clear API |
| Integration Complexity | 12 | 15 | Node.js adapter, well-defined inputs/outputs |
| License Compatibility | 8 | 15 | UNKNOWN until license file is verified |

**Total: 78/100 -> Integrate concept with adapter guardrails**

---

### P2 — OpenMontage

| Dimension | Score | Max | Notes |
|-----------|-------|-----|-------|
| Technical Fit | 20 | 25 | Strong video generation capability for Mi training |
| Security Posture | 12 | 25 | FFmpeg dependency, model download risk, license metadata requires verification |
| Production Readiness | 12 | 20 | Early stage, limited docs, FFmpeg required |
| Integration Complexity | 10 | 15 | Python adapter, external tool dependency |
| License Compatibility | 7 | 15 | UNKNOWN until license and dependency tree are verified |

**Total: 61/100 -> External service only with guardrails**
- Guardrail: No auto model download, require FFmpeg pre-installed

---

### P3 — TTS Audio Suite

| Dimension | Score | Max | Notes |
|-----------|-------|-----|-------|
| Technical Fit | 23 | 25 | Vietnamese/English TTS for reports and videos |
| Security Posture | 11 | 25 | Model weight downloads, voice cloning potential risk |
| Production Readiness | 14 | 20 | Stable Python, multiple TTS engine options |
| Integration Complexity | 10 | 15 | Python adapter, model management needed |
| License Compatibility | 10 | 15 | Model license unclear — needs legal review |

**Total: 68/100 → Integrate with Guardrails**
- Guardrail: Block voice cloning, use pre-approved voice models only

---

### P4 — WebLLM

| Dimension | Score | Max | Notes |
|-----------|-------|-----|-------|
| Technical Fit | 18 | 25 | Browser-side LLM for offline/privacy assistant |
| Security Posture | 20 | 25 | Client-side by design; model/package licenses still require verification |
| Production Readiness | 16 | 20 | Stable npm package, active development |
| Integration Complexity | 11 | 15 | Browser script tag, clear API |
| License Compatibility | 8 | 15 | UNKNOWN until package/model licenses are verified |

**Total: 75/100 -> Optional local helper with no actions**

---

### P5 — Obscura Browser

| Dimension | Score | Max | Notes |
|-----------|-------|-----|-------|
| Technical Fit | 14 | 25 | Stealth browser for automation, CDP compatible |
| Security Posture | 8 | 25 | Anti-detection tech, credential storage concerns, early project |
| Production Readiness | 8 | 20 | Very early stage, limited documentation |
| Integration Complexity | 6 | 15 | High complexity, unknown breaking changes |
| License Compatibility | 10 | 15 | Unknown license — needs verification |

**Total: 46/100 → Lab Only**
- Lab decision: Research only, no production integration

---

### P6 — Map3D

| Dimension | Score | Max | Notes |
|-----------|-------|-----|-------|
| Technical Fit | 10 | 25 | 3D digital twin — future store map |
| Security Posture | 16 | 25 | Pure concept rendering in lab; upstream license still must be verified |
| Production Readiness | 8 | 20 | Very early, 3D framework dependent |
| Integration Complexity | 5 | 15 | High complexity, custom data model needed |
| License Compatibility | 8 | 15 | UNKNOWN until upstream verified |

**Total: 54/100 → Future Research**
- Decision: Keep in lab for future consideration

---

## Final Decision Matrix

| Project | Total Score | Decision | Guardrails Required |
|---------|-------------|----------|---------------------|
| Open Agent Builder | 78/100 | **Integrate concept via adapter** | Dry-run mode, approval gate, license verification |
| WebLLM | 75/100 | **Optional browser helper** | WebGPU fallback, no action execution, model license check |
| OpenMontage | 61/100 | **External service only** | No auto model download, FFmpeg check, media license review |
| TTS Audio Suite | 68/100 | **Integrate w/ Guardrails** | No voice cloning, pre-approved voices only |
| Map3D | 54/100 | **Future Research** | N/A |
| Obscura Browser | 46/100 | **Lab Only** | No production use |

---

## Guardrail Requirements by Project

### Open Agent Builder
- [ ] Dry-run mode default ON
- [ ] Human approval required for `db.write`, `manager_alert` steps
- [ ] Workflow schema validation before execution
- [ ] Max 2 retries per step
- [ ] Audit log required for every run

### OpenMontage
- [ ] FFmpeg must be pre-installed (no auto-install)
- [ ] No external API key required for local rendering
- [ ] Generated videos stored in artifact registry
- [ ] Video plan JSON must be logged

### TTS Audio Suite
- [ ] Only use pre-approved voice models (no custom voice cloning)
- [ ] Audio files stored in artifact registry
- [ ] No API key in repo
- [ ] SRT output optional but recommended

### WebLLM
- [ ] Fallback message when WebGPU unavailable
- [ ] No action execution — read-only responses only
- [ ] No data sent to external servers
- [ ] Model loading status must be shown

### Obscura Browser
- [ ] Lab VM only — no production browser access
- [ ] No credential storage
- [ ] Decision report only — not for deployment

### Map3D
- [ ] Research demo only
- [ ] No production integration timeline set

---

## Mi Integration Priority

| Rank | Project | Mi Module | Effort | Risk |
|------|---------|-----------|--------|------|
| 1 | Open Agent Builder | Mi Workflow Studio | Low | Low |
| 2 | WebLLM | Mi Browser Local Assistant | Low | Low |
| 3 | TTS Audio Suite | Mi Voice Engine | Medium | Medium |
| 4 | OpenMontage | Mi Video Agent | Medium | Medium |
| 5 | Map3D | Mi Digital Twin Lab | High | Low |
| 6 | Obscura Browser | Mi Browser Automation Lab | High | High |
