# OSS Wave A Overlap Audit

Generated: 2026-06-14

Status: `OSS_WAVE_A_CERTIFIED`

## Scope

Wave A evaluated and integrated only:

- `codegraph`
- `openhuman`

Explicitly not integrated:

- `academic-research-skill`
- `last30days-skill`
- `drop-in-playwright`

## A1 Codegraph

Status: `CODEGRAPH_READY`

Integration point: Enterprise Brain Graph, via `server/src/graph/graph-db.ts`.

Added adapter:

- `server/src/graph/codegraph-intelligence.ts`

Graph nodes mapped:

- repositories
- files
- classes
- functions
- APIs
- dependencies

Graph edges reused:

- `contains`
- `declares`
- `imports`
- `affects`

Mi can now answer:

- `file nào ảnh hưởng Dashboard?`
- `sửa file này ảnh hưởng gì?`
- `cần test gì sau khi fix?`

No duplicate graph engine was added. Codegraph writes into the existing SQLite graph store. The older Jarvis in-memory knowledge graph remains an existing read model/candidate surface and was not expanded for Wave A.

## A2 OpenHuman

Status: `OPENHUMAN_READY`

Integration point: Health Intelligence, via the existing verified health cache.

Added adapter:

- `server/src/health-intelligence/openhuman-intelligence.ts`

Health signals mapped:

- sleep
- HRV
- activity
- recovery
- health trends

Mi can now answer:

- `tuần này workload có quá tải không?`
- `ngủ ít có ảnh hưởng task không?`
- `nên giảm workload không?`

No duplicate health engine was added. OpenHuman normalizes into the current Health Intelligence path and writes health source/metric/trend nodes into the Enterprise Brain Graph.

## A3 Duplicate Architecture Audit

| Area | Result | Evidence |
| --- | --- | --- |
| Graph engine | Pass | Codegraph uses existing `graph-db.ts` and `/api/graph` routes |
| Memory engine | Pass | No new memory store, vector DB, or persistence engine added |
| Health engine | Pass | OpenHuman reuses existing health cache and Health Intelligence answers |
| Blind imports | Pass | No package install or external OSS runtime import was added |
| Feature creep | Pass | Only Wave A adapters, routes, and reports were added |

## Enterprise Brain Wiring

Updated:

- `server/src/enterprise-v6/enterprise-brain-v4.ts`
- `server/src/graph/graph-router.ts`

New API surfaces under the existing graph namespace:

- `GET /api/graph/codegraph/sync`
- `GET /api/graph/codegraph/dashboard-impact`
- `GET /api/graph/codegraph/file-impact?path=...`

Certification answer path:

- Codegraph questions return `source_layers: ["Codegraph Adapter", "Enterprise Brain Graph"]`
- OpenHuman workload questions return `source_layers: ["OpenHuman Adapter", "Health Intelligence", "Enterprise Brain Graph"]`

Final target: `OSS_WAVE_A_CERTIFIED`
