# Workflow Evidence Model

Status: PARTIAL
Source: `mi-core/server/src/workflow-fabric/workflow-evidence-model.ts`

## Required Record

| field | required | notes |
|---|---:|---|
| `workflow_id` | yes | Stable workflow registry ID |
| `start_time` | yes | ISO timestamp |
| `end_time` | yes | ISO timestamp |
| `duration` | yes | Milliseconds |
| `status` | yes | SUCCESS, FAILED, SKIP_DUPLICATE, BLOCKED |
| `input` | yes | Sanitized input payload |
| `output` | yes | Sanitized output summary |
| `errors` | yes | Empty list if none |
| `evidence` | yes | Paths/URLs/checksums/screenshots/log IDs |

Evidence storage is local test-harness ready. Production persistence still needs to be wired into Mi API routes.
