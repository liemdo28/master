# Workflow Mi Contract

Status: PARTIAL

## Required APIs

| method | path | purpose | status |
|---|---|---|---|
| POST | `/api/coordination/tasks` | Create task through Executive Coordination | REQUIRED |
| POST | `/api/coordination/evidence` | Attach evidence to task/workflow | REQUIRED |
| POST | `/api/workflows/log` | Log workflow execution result | REQUIRED |
| GET | `/api/workflows/status` | Return workflow registry/dashboard status | REQUIRED |

Compatibility note: existing n8n documentation references `/api/mi/workflows/log`. The canonical Phase 0.7 contract is `/api/workflows/log`; keep old path as compatibility alias only if already deployed.

No workflow runner should bypass this contract.
