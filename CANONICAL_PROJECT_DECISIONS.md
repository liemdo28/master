# CANONICAL PROJECT DECISIONS

Generated: 2026-06-01 19:13:14 +0700

## CEO Decisions

| Decision | Canonical Owner / Path | Handling |
|---|---|---|
| Bakudan packing list | `Bakudan\packing-list` | Treat nested `Bakudan\packing-list\packing-list` as duplicate candidate. Do not delete until snapshot + approval. |
| LinkTreeHL | Bakudan website product family | Current files remain at `Other\LinkTreeHL`; target ownership is Bakudan website. Migrate only after snapshot + approval. |
| Agent Brain | `Agent\agent-coding` | Treat as primary Agent Brain candidate to wrap behind `agent-os`. |

## Execution Policy

- No delete during this pass.
- Duplicate cleanup requires approval and journal entry.
- LinkTreeHL migration into Bakudan should be a separate approved task with rollback snapshot.

## Migration Update

`Other\LinkTreeHL` has been copied into `Bakudan\bakudanramen.com-current\integrations\linktreehl-next` as a migrated source package. The original folder remains untouched as rollback source.
