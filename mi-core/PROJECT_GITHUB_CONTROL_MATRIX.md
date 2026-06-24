# PROJECT GITHUB CONTROL MATRIX
Generated: 2026-06-24 | Auditor: mi-core OS | Scan depth: E:/Project/Master/ (max depth 2)

## Summary

| Metric | Value |
|--------|-------|
| Total repos found | 20 |
| GITHUB_CONTROLLED | 15 |
| GITHUB_PARTIAL (no remote) | 3 |
| NO_REMOTE (Dreamhost SSH only) | 1 |
| Root-level workspace (mi-core) | 1 |

---

## Full Matrix

| # | local_path | github_repo | branch_status | build_command | test_command | can_create_branch | risk_level | owner_department | final_status |
|---|-----------|-------------|---------------|--------------|--------------|------------------|------------|-----------------|-------------|
| 1 | E:/Project/Master/mi-core | https://github.com/liemdo28/master.git | main | npx tsc | node tests/ceo-os-master-validation.mjs | true | HIGH | Engineering / CEO-OS | GITHUB_CONTROLLED |
| 2 | E:/Project/Master/Agent/agent-coding-api-keys | https://github.com/liemdo28/master.git | feature/mi-core-big-data-foundation | — | — | true | MEDIUM | Engineering / Agent | GITHUB_CONTROLLED |
| 3 | E:/Project/Master/Agent/ai-search-tool | https://github.com/liemdo28/ai-search-tool.git | main | — | — | true | MEDIUM | Engineering / Agent | GITHUB_CONTROLLED |
| 4 | E:/Project/Master/Agent/doordash-compaigns | (none) | master | — | — | false | LOW | Marketing / Ops | NO_REMOTE |
| 5 | E:/Project/Master/Agent/shared-workspace | (none) | master | — | — | false | LOW | Engineering / Shared | NO_REMOTE |
| 6 | E:/Project/Master/Bakudan/Agent-Coding | https://github.com/liemdo28/agent-coding.git | main | — | — | true | MEDIUM | Engineering / Bakudan | GITHUB_CONTROLLED |
| 7 | E:/Project/Master/Bakudan/bakudanramen.com-current | https://github.com/heoventure/BakudanWebsite.git | main | — | — | true | HIGH | Ops / Bakudan Production | GITHUB_CONTROLLED |
| 8 | E:/Project/Master/Bakudan/dashboard.bakudanramen.com | ssh://liemdo0208@pdx1-shared-a3-05.dreamhost.com/... | main | — | — | false | HIGH | Ops / Bakudan Dashboard | NO_REMOTE (DreamHost SSH) |
| 9 | E:/Project/Master/Bakudan/growth-dashboard | https://github.com/liemdo28/growth-dashboard.git | main | — | — | true | MEDIUM | Ops / Bakudan Analytics | GITHUB_CONTROLLED |
| 10 | E:/Project/Master/Bakudan/integration-system | https://github.com/liemdo28/intergration-full.git | main | — | — | true | HIGH | Engineering / Bakudan Integrations | GITHUB_CONTROLLED |
| 11 | E:/Project/Master/Bakudan/mobile_taskflow | https://github.com/liemdo28/mobile-taskflow.git | master | — | — | true | MEDIUM | Product / Bakudan | GITHUB_CONTROLLED |
| 12 | E:/Project/Master/Bakudan/packing-list | https://github.com/liemdo28/packing-list.git | master | cd v2-react/client && npm run build | — | true | HIGH | Ops / Bakudan Production | GITHUB_CONTROLLED |
| 13 | E:/Project/Master/Bakudan/review-automation-system | https://github.com/liemdo28/review-automation-system.git | master | — | — | true | HIGH | Ops / Bakudan Automation | GITHUB_CONTROLLED |
| 14 | E:/Project/Master/Other/It-Takes-Two-Inspired-Game | https://github.com/liemdo28/gameittakes2.git | main | — | — | true | LOW | Personal / Game | GITHUB_CONTROLLED |
| 15 | E:/Project/Master/Other/LinkTreeHL | https://github.com/liemdo28/LinkTreeHL.git | master | next build | — | true | LOW | Marketing / Personal | GITHUB_CONTROLLED |
| 16 | E:/Project/Master/Other/Tuya | https://github.com/liemdo28/Tuya.git | main | — | — | true | LOW | Ops / Smart Home | GITHUB_CONTROLLED |
| 17 | E:/Project/Master/Other/dau-tu | https://github.com/liemdo28/investment-analys.git | main | — | — | true | LOW | Personal / Finance Research | GITHUB_CONTROLLED |
| 18 | E:/Project/Master/Other/phuyen-2026 | git@github.com:liemdo28/phuyen-2026.git | main | — | — | true | LOW | Personal / Travel | GITHUB_CONTROLLED |
| 19 | E:/Project/Master/Other/tu-vi | https://github.com/liemdo28/tu-vi-ai-workspace.git | master | — | — | true | LOW | Personal / Astrology Tool | GITHUB_CONTROLLED |
| 20 | E:/Project/Master/RawSushi/RawWebsite | https://github.com/liemdo28/rawwebsite.git | master | — | — | true | HIGH | Ops / RawSushi Production | GITHUB_CONTROLLED |

---

## Risk Classification Notes

- **HIGH**: Production websites, customer-facing services, live dashboards, or core OS infrastructure
- **MEDIUM**: Internal tools, agent infrastructure, analytics — used but not customer-facing
- **LOW**: Personal projects, games, research tools, non-production workspaces

## No-Git Directories (excluded from matrix)

The following directories under E:/Project/Master/ contain code but are **not git repos** (no .git folder):

- `seo-analytics-agent/`, `seo-citation-agent/`, `seo-content-agent/`, `seo-schema-agent/`, `seo-technical-agent/` — SEO agent suite (have package.json but no git)
- `cv-builder/` — CV builder tool
- `web-app/` — web app project
- `artifact-registry/` — execution logs/artifacts only
- `Agent/agent-coding/`, `Agent/antigravity-gateway/`, `Agent/review-management-mcp/` — agent modules (no git)

**Recommendation:** Initialize git repos and push to GitHub for all SEO agent modules and cv-builder.

---

## Department Breakdown

| Department | Repos | Risk |
|-----------|-------|------|
| Engineering / CEO-OS | 1 | HIGH |
| Engineering / Agent | 3 | MEDIUM |
| Ops / Bakudan | 6 | HIGH/MEDIUM |
| Ops / RawSushi | 1 | HIGH |
| Personal / Other | 5 | LOW |
| No-Git (not controlled) | 8+ | UNKNOWN |
