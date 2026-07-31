# Project Registry Migration Notes

Phase 2 keeps legacy project scanners available for audit and connector compatibility, but they are no longer the canonical source for `/api/projects`.

Canonical operations:

- Register explicit roots with `POST /api/projects` or the operator CLI.
- Generate maps with `POST /api/projects/:id/map`.
- Create context packs with `POST /api/projects/:id/context-pack`.
- Start coding tasks through task runtime with matching `projectId`, `mapVersion`, and `contextPackId`.

The live Mi Core repository root is expected to be:

`D:\Project\Mi-core-system\Master\mi-core`

The broader workspace root can be recorded as an important path, but coding task boundaries are enforced at the canonical project root.
