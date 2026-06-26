# Open-Source Audit — Mi Company OS Extension

**Version:** 1.0.0 | **Date:** 2026-06-26 | **Auditor:** Mi Lab

---

## Audit Scope

Evaluate 6 open-source AI tools for integration into Mi Company OS. Each project is assessed for:
- Technical fit with Mi architecture
- Security and license risk
- Production readiness
- Mi use case alignment

**Rule:** No project is embedded directly into Mi-Core. All integration uses adapter architecture.

---

## Audit Criteria

### Technical Criteria
| Criterion | Description |
|-----------|-------------|
| Repo URL | Verified GitHub/source URL |
| License | SPDX license identifier |
| Language | Primary programming language |
| Runtime | Required runtime (Node, Python, Browser, etc.) |
| Install Method | npm/pip/Docker/git clone/etc. |
| Port Usage | Default ports used |
| Docker Support | Official Docker image available |
| API Support | REST/GraphQL API available |
| CLI Support | Command-line interface available |
| UI Support | Web/Desktop UI available |
| Auth Support | Authentication mechanism |
| Maintenance | Last commit, active contributors |
| Open Issues | Issue count and age |

### Security Criteria
| Criterion | Risk Level |
|-----------|-----------|
| Hardcoded secrets | Critical |
| Unknown network calls | High |
| Auto-download models | High |
| File system write access | Medium |
| Shell execution | High |
| Browser automation permissions | High |
| Remote code execution | Critical |
| AGPL/GPL license | High |
| Commercial-use limitation | Medium |
| Credential handling | High |

### Mi Fit Criteria
| Score | Meaning |
|-------|---------|
| High | Core Mi capability match, direct adapter fit |
| Medium-High | Partial fit, needs adaptation |
| Medium | Useful but not critical |
| Low | Future consideration only |

---

## Audit Method

1. Clone/fetch repo metadata
2. Review LICENSE file
3. Review package.json / requirements.txt / Cargo.toml
4. Review main entry points (index.js, main.py, etc.)
5. Check for .env.example, .env.template
6. Check network calls (fetch, axios, http calls)
7. Check file system operations (fs, path)
8. Check shell execution (child_process, subprocess, exec)
9. Check browser automation (puppeteer, playwright, CDP)
10. Assess AGPL/GPL clauses
11. Score Mi fit based on use case match
12. Document findings

---

## Project Triage

### P1 — Open Agent Builder
- **Use Case:** Visual workflow builder for Mi agents
- **Audit Required:** License, Node.js dependencies, workflow execution sandbox
- **Decision Gate:** Can it run isolated workflows without modifying Mi-Core?

### P2 — OpenMontage
- **Use Case:** Training video generation for Mi
- **Audit Required:** Video generation models, FFmpeg dependency, output format
- **Decision Gate:** Can it generate video without external API keys?

### P3 — TTS Audio Suite
- **Use Case:** Vietnamese/English voiceover for Mi reports
- **Audit Required:** TTS engine models, voice cloning capability, model license
- **Decision Gate:** Is local TTS generation possible without risky model downloads?

### P4 — WebLLM
- **Use Case:** Browser-side local LLM for Mi dashboard
- **Audit Required:** WebGPU requirement, model download size, privacy implications
- **Decision Gate:** Can it run in standard Mi dashboard browser without WebGPU issues?

### P5 — Obscura Browser
- **Use Case:** Browser automation lab (research only)
- **Audit Required:** CDP compatibility, credential storage, anti-detection
- **Decision Gate:** Decision report only — NOT for production use

### P6 — Map3D
- **Use Case:** Future digital twin / store map
- **Audit Required:** 3D rendering framework, data format
- **Decision Gate:** Low-priority research demo only

---

## Risk Matrix

| Risk | Severity | Mitigation |
|------|----------|------------|
| AGPL/GPL embedding | Critical | Adapter boundary only — no direct code import |
| Secret leakage | Critical | No API keys in repo — use .env |
| Remote code exec | High | Sandboxed execution, no shell calls in adapter |
| Model auto-download | High | Block auto-download — manual model install only |
| Credential storage | High | No credential storage in repo |
| Browser automation | High | Isolated VM — no production browser access |
| Voice cloning | Medium | Require approval policy before enabling |

---

## Audit Result Summary

| Project | License | Risk | Mi Fit | Decision |
|---------|---------|------|--------|----------|
| Open Agent Builder | TBD | TBD | High | → PHASE_1_AUDIT_REPORT.md |
| OpenMontage | TBD | TBD | High | → PHASE_1_AUDIT_REPORT.md |
| TTS Audio Suite | TBD | TBD | High | → PHASE_1_AUDIT_REPORT.md |
| WebLLM | TBD | TBD | Medium-High | → PHASE_1_AUDIT_REPORT.md |
| Obscura Browser | TBD | High | Medium | → PHASE_1_AUDIT_REPORT.md |
| Map3D | TBD | Low | Low | → PHASE_1_AUDIT_REPORT.md |

---

## Next Step

See `reports/PHASE_1_AUDIT_REPORT.md` for detailed per-project audit results.