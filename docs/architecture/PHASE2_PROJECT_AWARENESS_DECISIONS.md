# Phase 2 Project Awareness Decisions

## Scope

Phase 2 introduces one canonical project registry for explicit project metadata, project maps, resume contexts, and bounded context packs.

It does not start Phase 3 UI work, does not replace the task runtime, and does not add a second orchestrator.

## Existing Modules

| Module | Decision | Notes |
| --- | --- | --- |
| `server/src/projects/project-scanner.ts` | ADAPT | Useful detection hints, but not canonical because it performs broad scans and carries old default roots. |
| `server/src/routes/projects.ts` | MERGE | Existing API namespace is retained; canonical registry owns the default project list and new map/context endpoints. |
| `server/src/visibility/connectors/local-projects.ts` | IGNORE | Visibility connector remains legacy evidence and is not a source of truth. |
| `server/src/graph/codegraph-intelligence.ts` | ADAPT | Graph ideas are compatible, but Phase 2 maps remain compact summaries rather than a second graph store. |
| `server/src/company-os/project-registry.ts` | ADAPT | Static inventory informs seed data only; durable registry is SQLite-backed. |

## Boundary

Projects must be registered explicitly. The registry does not scan arbitrary parent folders.

Coding tasks may start only when they provide:

- `projectId`
- `workingDirectory`
- `mapVersion`
- `contextPackId`

The guard validates that the context pack belongs to the active fresh project map and that the working directory stays inside the canonical project root.
