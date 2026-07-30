# OSS Governance — Phase 0.5

## What Is This?

Mi treats open source projects like employees — with a full HR pipeline:

```
Discovery → Audit → ROI → Architecture Review → Pilot → Production → Maintenance → Retired
```

This package provides the governance layer for tracking, scoring, and
managing the lifecycle of every open source project Mi adopts.

## Files

```
oss_governance/
├── __init__.py              # Package init
├── README.md                # This file
├── registry.py              # OSS Registry (project register/dedupe/CRUD)
├── scorecard.py             # OSS Scorecard (ROI/risk/maintenance evaluation)
├── lifecycle_engine.py      # 8-stage lifecycle state machine
├── coordination_adapter.py  # Executive Coordination bridge (signals, tasks, risks)
├── dashboard_api.py         # Dashboard API (14 endpoints on port 5180)
├── seed_candidates.py       # Load 25 candidates from Master Spec
├── run_runtime_proof.py     # Runtime proof runner (certification harness)
├── oss_registry.json        # Persistent registry (created after seed)
├── evidence/                # Per-operation evidence (JSON)
└── runtime-evidence/
    └── proof.json           # Machine-readable proof (created by run_runtime_proof)
```

## API Endpoints (port 5180)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/oss/health | Health check |
| GET | /api/oss/registry | All registered projects |
| GET | /api/oss/registry/division/{division} | Filter by division |
| GET | /api/oss/registry/stage/{stage} | Filter by lifecycle stage |
| GET | /api/oss/projects/{project_id} | Single project detail + scorecard |
| GET | /api/oss/pipeline | Lifecycle pipeline summary |
| GET | /api/oss/scorecards | All scorecards |
| GET | /api/oss/risks | Detected risks |
| GET | /api/oss/coordination | Coordination tasks |
| POST | /api/oss/coordination/emit | Trigger coordination scan |
| GET | /api/oss/lifecycle/events | Lifecycle transition history |
| GET | /api/oss/lifecycle/gates | Stage gate definitions |
| GET | /api/oss/summary | Executive summary |
| GET | /api/oss/runtime-proof | Run self-test and return result |

## Quick Start

```python
from oss_governance import registry, scorecard, lifecycle_engine, seed_candidates

# 1. Seed the registry with 25 Master Spec candidates
seed_candidates.seed_all()

# 2. View registry
summary = registry.get_registry_summary()
print(f"Total projects: {summary['total']}")
print(f"By division: {summary['by_division']}")

# 3. Build a scorecard (when data is available)
projects = registry.list_by_division("Engineering")
sc = scorecard.build_scorecard(
    project_id=projects[0]["project_id"],
    license_name="Apache-2.0",
    stars=50000,
    forks=8000,
    contributors=300,
    last_commit_days=3,
    has_api=True,
    has_cli=False,
    has_python_sdk=True,
    has_rest_api=True,
    language_match=True,
    release_frequency_months=1.0,
    breaking_changes_per_year=1,
    documentation_quality="excellent",
)

# 4. Advance lifecycle
lifecycle_engine.advance_stage(project_id, "AUDIT", approver="engineering_lead")

# 5. Run coordination scan
from oss_governance.coordination_adapter import scan_and_emit
emitted = scan_and_emit()
```

## Risk Detection

The coordination adapter detects:

| Risk | Severity | Trigger |
|------|----------|---------|
| HIGH_LICENSE_RISK | P1 | Any ACTIVE project with HIGH-risk license |
| STUCK_PIPELINE | P2 | More projects in early stages than active |
| LOW_ACTIVITY_PROJECT | P2 | PRODUCTION project with slow release cadence |
| EMPTY_REGISTRY | P0 | No projects registered |
| HIGH_RISK_PROJECT | P1 | Scorecard shows HIGH composite risk |

## CTO Rules

- **No fabrication** — scores come from provided data, never assumed
- **BLOCKED on missing data** — scorecard returns BLOCKED when community stats are absent
- **Read-only** — all endpoints are read-only, no writes to upstream
- **Evidence-based** — every state change writes evidence to disk
- **Stage-gated** — no skipping lifecycle stages (one step at a time)

## Runtime Proof

```bash
cd d:\Project\computer-operator-foundation
python -m oss_governance.run_runtime_proof
```

Returns proof.json with all test results and dashboard smoke test.
