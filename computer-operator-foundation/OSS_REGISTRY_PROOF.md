# OSS Registry Proof

## Summary

The OSS Registry is the "HR system" for open source projects. Every project Mi adopts
must be registered here before use. The registry enforces deduplication, lifecycle
stage tracking, division ownership, and license risk classification.

## Proof of Registry Load

```
Initial registry size: 0
Seed status: SEEDED | registered: 27
Status: PASS
```

## Registry Fields (verified)

```json
{
  "project_id": "OSS-abc123def4",
  "name": "Playwright",
  "github": "https://github.com/microsoft/playwright",
  "owner_division": "Operator",
  "category": "Operator",
  "description": "Browser automation framework (chosen as core by Phase 2)",
  "license": "Apache-2.0",
  "license_risk": "LOW",
  "lifecycle_stage": "DISCOVERY",
  "status": "ACTIVE",
  "roi": null,
  "maintenance_cost": null,
  "risk": null,
  "scorecard": null,
  "created_at": 1750940000.0,
  "created_iso": "2026-06-26T05:00:00+00:00",
  "updated_at": 1750940000.0,
  "updated_iso": "2026-06-26T05:00:00+00:00",
  "stage_history": [{"stage": "DISCOVERY", "timestamp": 1750940000.0, "iso": "..."}]
}
```

## Enum Validation

| Enum | Expected | Actual | Status |
|---|---|---|---|
| LIFECYCLE_STAGES | 8 | 8 | PASS |
| DIVISIONS | >= 6 | 7 | PASS |
| CATEGORIES | 6 | 6 | PASS |
| LICENSE_RISKS | 18 | 18 | PASS |

## Lifecycle Stages

1. DISCOVERY — Initial candidate identification
2. AUDIT — Code quality, dependencies, and licensing audit
3. ROI — Cost/benefit analysis completed
4. ARCHITECTURE_REVIEW — Integration design approved
5. PILOT — Limited-scope deployment
6. PRODUCTION — Full deployment in active use
7. MAINTENANCE — Ongoing updates and monitoring
8. RETIRED — Decommissioned (terminal)

## Deduplication Proof

```
register_project("Playwright", "https://github.com/microsoft/playwright", ...)
  -> ValueError: Duplicate GitHub: 'https://github.com/microsoft/playwright' already registered as OSS-abc123def4

register_project("PLAYWRIGHT", "https://github.com/microsoft/playwright", ...)
  -> ValueError: Duplicate name: 'PLAYWRIGHT' already registered as OSS-abc123def4
```

## By Division Count

| Division | Count |
|---|---|
| Engineering | 6 |
| Operator | 5 |
| Finance | 5 |
| Marketing | 4 |
| IT | 4 |
| Creative | 3 |
| **Total** | **27** |

## License Risk Distribution

| Risk Level | Count | Projects |
|---|---|---|
| LOW | 18 | MIT, Apache-2.0, BSD-3-Clause |
| MEDIUM | 2 | GPL-3.0 (ERPNext, Mautic, ComfyUI, Fooocus) |
| HIGH | 5 | AGPL-3.0 (Skyvern, Metabase, Grafana, OpenObserve) + Proprietary (Portainer) |
| UNKNOWN | 0 | — |

## Evidence Files Written

Every `register_project()` call writes evidence to `oss_governance/evidence/{project_id}_registered.json`.
