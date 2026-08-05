# Phase 5B Memory Audit

Phase 5B extends validation and Personal OS memory only. It does not change retrieval, the AST engine, impact graph, model routing, coding workflow architecture, voice, email, calendar, desktop control, or autonomous actions.

## Existing Components

| Component | Decision | Rationale |
| --- | --- | --- |
| `server/src/personal-os` | KEEP/MERGE | Canonical Phase 5 store and API boundary. |
| `server/src/memory` | IGNORE for Phase 5B | Existing executive memory remains separate until a future migration plan. |
| `server/src/memory2` | IGNORE for Phase 5B | Not canonical for the Personal OS knowledge contract. |
| `server/src/operational-memory` | ADAPT later | Useful operational signals, but no automatic ingestion in Phase 5B. |
| `server/src/executive-intelligence` | ADAPT later | Can provide read-side signals after explicit scope approval. |
| `server/src/task-intelligence` | ADAPT as source signal | Task summaries may feed bounded, confirmation-gated extraction. |
| `server/src/project-registry` | KEEP as context source | Project IDs and maps scope project memory. |
| Project maps and resume context | KEEP | Used as context, not as personal memory storage. |
| Vector/semantic memory | DEFER | Phase 5B uses SQLite-first structural retrieval. |
| Conversation/session memory | IGNORE for automatic ingestion | No broad automatic harvesting of chat/session logs. |

## Canonical Decision

- Canonical store: `PersonalOsStore` in `server/src/personal-os/store.ts`
- Canonical retrieval entry: `PersonalOsStore.searchKnowledge` and `PersonalOsStore.buildMemoryPack`
- Canonical ingestion:
  - explicit user-created knowledge records
  - bounded task-summary extraction after task completion/failure
  - inferred records marked `NEEDS_CONFIRMATION`

## Data Safety Rules

- Secret-like content is rejected before storage.
- Prompt-injection text from task summaries is sanitized as untrusted content.
- Deleted, superseded, and expired records are excluded from active retrieval.
- Cross-project retrieval is scoped through Project Registry project IDs.
- Memory packs are bounded by record count and byte size.
- Phase 5B records evidence references, not raw logs.

