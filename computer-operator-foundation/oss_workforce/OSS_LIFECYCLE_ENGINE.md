# OSS_LIFECYCLE_ENGINE.md — Strategic Asset Lifecycle

**Generated:** 2026-06-27  
**Governed by:** `computer-operator-foundation/oss_governance/lifecycle_engine.py`

---

## Lifecycle Stages

```
DISCOVERED
    ↓
AUDITED
    ↓
ROI_EVALUATED
    ↓
ARCHITECTURE_APPROVED
    ↓
PILOT
    ↓
APPROVED
    ↓
PRODUCTION
    ↓
DEPRECATED
    ↓
RETIRED
```

| Stage | Gate Requirement | Next Action |
|-------|-----------------|-------------|
| DISCOVERED | None | Conduct codebase audit |
| AUDITED | Code quality, dependencies, licensing verified | ROI evaluation |
| ROI_EVALUATED | Cost/benefit analysis completed | Architecture review |
| ARCHITECTURE_APPROVED | Integration design approved | Begin pilot deployment |
| PILOT | Limited-scope deployment completed | Promote to production |
| APPROVED | Full review and approval | Begin production deployment |
| PRODUCTION | Full deployment in active use | Establish maintenance cadence |
| DEPRECATED | Maintenance replaced by successor | Plan retirement |
| RETIRED | Decommissioned, no longer in use | Archive |

---

## Current Pipeline Status

| Stage | Count | Projects |
|-------|-------|---------|
| PRODUCTION | 7 | Playwright, Browser Use, DuckDB, dbt, PostHog, OpenObserve, Uptime Kuma, n8n |
| PILOT | 1 | Browser Use |
| AUDIT | 2 | OpenClaw, Qwen Coder |
| DISCOVERY | 17 | All others |

---

## Stage Transition Evidence

Every stage change requires:
- Approver identity
- Gate evidence (audit results, ROI report, etc.)
- Notes describing rationale
- Timestamp

Evidence stored in: `oss_governance/evidence/LIFECYCLE-{hash}.json`

---

## Production OSS Status

| OSS | Stage | Since | Owner | Next Review |
|-----|-------|-------|-------|-------------|
| n8n | PRODUCTION | 2024-01-01 | Operations | 2026-07-01 |
| Playwright | PRODUCTION | 2024-06-27 | IT | 2026-07-01 |
| DuckDB | PRODUCTION | 2024-09-01 | Finance | 2026-07-01 |
| dbt | PRODUCTION | 2024-09-01 | Finance | 2026-07-01 |
| PostHog | PRODUCTION | 2024-09-01 | Marketing | 2026-07-01 |
| OpenObserve | PRODUCTION | 2024-09-01 | IT | 2026-07-01 |
| Uptime Kuma | PRODUCTION | 2024-09-01 | IT | 2026-07-01 |

---

## Upgrade Policy Template

| OSS | Current Version | Upgrade Cadence | Auto-Patch | Last Update |
|-----|----------------|----------------|-----------|-------------|
| Playwright | 1.55.x | Monthly | Yes | 2026-06-27 |
| Browser Use | Latest | On-demand | No | TBD |
| DuckDB | Stable | Quarterly | No | TBD |
| dbt | 1.8.x | Monthly | Yes | TBD |
| PostHog | Latest | Monthly | Yes | TBD |
| n8n | 1.x | Bi-weekly | Yes | TBD |

---

## Retirement Policy Template

| OSS | Sunset Criteria | Replacement | Timeline |
|-----|-----------------|-------------|----------|
| Playwright | Replaced by native browser automation | Browser Use (if matured) | 12 months |
| DuckDB | Replaced by cloud warehouse | TBD | 24 months |
| n8n | Replaced by native AI workflow | Temporal (if matured) | 18 months |
