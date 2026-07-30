# MASTER CLEANUP PLAN
**Generated:** 2026-07-06  
**Basis:** Baseline `_audit/MI_MASTER_BASELINE_20260706_0948/`

---

## RULE: Do NOT delete before approval
Every item below must have explicit approval before action.

---

## SECTION 1: SAFE TO ARCHIVE (Low Risk — Archive to _archive/\[date\]/)

| Path | Size | Reason | Risk | Action | Backup |
|------|------|--------|------|--------|--------|
| `server/` (root) | ? | Stale — real server is `mi-core/server/` | Low | MOVE to `_archive/2026-07-06/stale-root-server/` | .git history preserved |
| `ui/` (root) | ? | Stale — real ui is `mi-core/ui/` | Low | MOVE to `_archive/2026-07-06/stale-root-ui/` | .git history preserved |
| `mi-core/mi-core/` | ? | Deeply nested duplicate | Low | MOVE to `_archive/2026-07-06/nested-mi-core/` | .git history preserved |
| `company-os-phases/` | ? | Old phase documentation | Low | MOVE to `_archive/2026-07-06/company-os-phases/` | .git history preserved |
| `creative-preview/` | ? | Stale/preview content | Low | INVESTIGATE then MOVE | Copy before move |
| `data/` (root) | ? | Check contents | Medium | INVESTIGATE — may contain credentials | Investigate first |
| `docs/` (root) | ? | Check contents | Low | INVESTIGATE — may contain valid docs | Copy before move |

---

## SECTION 2: STALE PROJECTS AT ROOT (Medium Risk)

| Path | Reason | Risk | Action | Approval |
|------|--------|------|--------|----------|
| `README.md` | Stale root readme | Low | KEEP if valid, otherwise ARCHIVE | Investigate |
| `MI_COMPANY_OS_REALITY_CHECK_FINAL.zip` | Archived analysis | Low | Keep in `_archive/` | N/A |
| `Agent/agent-coding-api-keys.zip` | Zipped keys | Medium | Investigate — may be duplicate of `Agent/agent-coding-api-keys/` | Investigate |
| `Agent/ai-search-tool/` | Unknown purpose | Medium | INVESTIGATE before any action | Required |
| `Other/It-Takes-Two-Inspired-Game/` | Game prototype | Low | INVESTIGATE — may be valid project | Investigate |
| `Other/Tuya/` | Unknown project | Medium | INVESTIGATE | Required |
| `Other/VC/` | Unknown project | Medium | INVESTIGATE | Required |
| `Other/dau-tu/` | Unknown project | Medium | INVESTIGATE | Required |
| `Other/tu-vi/` | Unknown project | Medium | INVESTIGATE | Required |

---

## SECTION 3: NESTED GIT REPOS (Medium Risk — Quarantine)

These are git repos cloned inside other git repos. This creates git conflicts and should be resolved.

| Path | Parent Repo | Risk | Action | Approval |
|------|-----------|------|--------|----------|
| `Bakudan/packing-list/packing-list/` | `Bakudan/packing-list/` | Medium | QUARANTINE to `_quarantine/2026-07-06/nested-repos/` then delete from parent | Required |
| `Other/LinkTreeHL/LinkTreeHL/` | `Other/LinkTreeHL/` | Medium | QUARANTINE then delete inner | Required |
| `Other/phuyen-2026/phuyen-2026/` | `Other/phuyen-2026/` | Medium | QUARANTINE then delete inner | Required |

**Note:** Use `git rm --cached <path>` inside the parent repo before deleting to avoid removing git index entries.

---

## SECTION 4: CACHE AND TEMP FILES (Medium Risk)

**From TEMP_FILES_REPORT.md:** 1,610 directories matching `logs/`, `cache/`, `__pycache__/`, `Traces/`, `playwright-` patterns.

| Pattern | Location | Risk | Action |
|---------|----------|------|--------|
| `SEO/*/logs/` | SEO agents | Medium | Keep most recent. Archive old logs > 30 days. |
| `SEO/*/agent.log` | SEO agents | Low | Rotate: keep last 7 days only |
| `SEO/shared/reports/connectors/*.json` | Citation/GA4/GSC crawls | Medium | Archive reports > 14 days old. Keep evidence of recent runs. |
| `SEO/shared/database/seo-shared.db` | Low | Keep | Active database |
| `mi-core/services/*/data/` | Various | Medium | INVESTIGATE each — may contain session/auth data |
| `reports/pc-evaluation-2026-06-25/` | Already deleted (marked D) | N/A | Already gone |
| `Raw/payroll/src/__pycache__/` | Python cache | Low | DELETE — safe to regenerate |
| `computer-operator-foundation/*/__pycache__/` | Python cache | Low | DELETE |
| `mi-core/ai-service/__pycache__/` | Python cache | Low | DELETE |
| `Agent/doordash-compaigns/` | Likely stale logs | Medium | INVESTIGATE before action |
| `SEO/_mi-start.log`, `_start-agents.log`, `_tsc.log` | Startup logs | Low | Archive > 30 days |
| `SEO/_validation-output.log` | Validation output | Low | Archive > 30 days |
| `SEO/shared/events/bus.log` | Event bus log | Low | Archive > 30 days |
| `.tmp_dhops/` | Temp directory | Low | INVESTIGATE — may contain active work |
| `.mi-harness/` | Test harness | Low | INVESTIGATE — may be active test artifacts |

---

## SECTION 5: LARGE FILES TO INVESTIGATE (High Disk Impact)

From LARGE_FILES_REPORT.md: 52 files >25MB.

| Category | Action |
|----------|--------|
| `.zip` files | INVESTIGATE contents — likely stale archives → move to `_archive/` |
| `*.db` / `*.sqlite` files | INVESTIGATE — may be production databases → DO NOT DELETE |
| JSON dataset files | Investigate — may be evidence → archive not delete |
| Installers / executables | Archive to `_archive/` — do not keep in project root |

---

## SECTION 6: DO NOT TOUCH (Production / Sensitive)

These must NOT be modified, moved, or deleted:

- All `.local-agent-global/` data directories (graph.db, memory.db, knowledge.db)
- All `node_modules/` directories in active projects
- `.git/` directories (except nested repo cleanup above)
- `.env` files that are untracked (production secrets — protected)
- `mi-core/services/whatsapp-ai-gateway/data/` (WhatsApp session state — tracked)
- `Raw/payroll/token.json` (Google OAuth token — protected)
- `Raw/payroll/data/` (payroll data — production)
- `SEO/.env` and all `SEO/*/.env` (API keys — investigate if tracked)
- Any file matching `auth-state.json`, `session.json`, `cookies`, `machine_token`
- `mi-core/services/qb-ops-agent/.machine_token` (QB token — investigate)
- `mi-core/services/qb-ops-agent/data/` (QB session data)

---

## SUMMARY

| Category | Count | Risk | Action Required |
|----------|-------|------|-----------------|
| Stale directories to archive | 7 | Low | MOVE after investigation |
| Nested git repos | 3 | Medium | QUARANTINE then delete inner |
| Unknown projects | 5 | Medium | INVESTIGATE before action |
| Temp/cache directories | ~1,600 | Low-Medium | Selective deletion by age |
| Large files | 52 | Medium | INVESTIGATE individually |
| PRODUCTION PROTECTED | Many | Critical | DO NOT TOUCH |

**Total potential disk recovery:** Significant (1,600 cache dirs + stale dirs). Exact amount requires size audit.

**Status:** PLAN ONLY — NO DELETION until explicit approval.

