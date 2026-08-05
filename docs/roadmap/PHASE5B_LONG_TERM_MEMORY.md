# Phase 5B Long-Term Memory Roadmap

Phase 5B will add durable, inspectable, user-controlled personal knowledge.

## Objective

Mi should remember confirmed and useful knowledge that survives restarts and future conversations:

- stable user facts
- confirmed preferences
- project conventions
- architecture decisions
- recurring workflows
- lessons learned from tasks
- unresolved recurring problems
- relationships between goals, projects, and tasks

Mi must not store hidden reasoning, unrestricted transcripts, secrets, or raw logs.

## Audit First

Before implementation, audit:

- `server/src/memory`
- `server/src/memory2`
- `server/src/operational-memory`
- `server/src/executive-intelligence`
- owner profile services
- `server/src/task-intelligence`
- `server/src/personal-os`
- project maps and resume context
- any vector or semantic store
- conversation/session memory

Each component must be classified as `KEEP`, `ADAPT`, `MERGE`, `DEPRECATE`, or `IGNORE`.

## Expected Contract

The canonical record should include:

- `id`
- `kind`
- `title`
- `summary`
- `content`
- `scope`
- `projectIds`
- `goalIds`
- `taskIds`
- `tags`
- `sourceType`
- `provenance`
- `confidence`
- `sensitivity`
- `status`
- `validFrom`
- `validUntil`
- `lastConfirmedAt`
- `createdAt`
- `updatedAt`
- `supersedesId`
- `evidenceReferences`

Inferred records should start at `NEEDS_CONFIRMATION`. Deleted, expired, or superseded records must be excluded from active retrieval.

## Truth Policy

Priority order:

1. live system, project, and task state
2. explicit recent user statement
3. confirmed knowledge
4. confirmed preference
5. inferred knowledge
6. model suggestion

Conflicts must be surfaced rather than silently resolved.

## Retrieval And MemoryPack

Retrieval should be structural first and bounded by project, goal, task, kind, tags, recency, status, confidence, and evidence. Local embeddings may be added only if justified after structural retrieval, with deleted/superseded records excluded.

MemoryPack policies:

- `PERSONAL_ONLY`
- `PROJECT_ONLY`
- `PERSONAL_AND_PROJECT`
- `NO_MEMORY`
- `CONFIRMATION_REQUIRED`

Coding tasks should default to `PROJECT_ONLY` plus confirmed workflow preferences. Daily briefs may use `PERSONAL_AND_PROJECT`.

## Out Of Scope

- voice
- wake word
- desktop control
- email/calendar ingestion or writes
- web browsing memory ingestion
- autonomous external actions
- automatic push, merge, or deploy
- multi-agent swarm
- self-modifying memory policies
- Phase 5C
