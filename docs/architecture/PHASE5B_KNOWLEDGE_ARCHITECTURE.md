# Phase 5B Knowledge Architecture

Phase 5B adds long-term personal knowledge and memory packs to the existing Personal OS.

## Contract

`KnowledgeRecord` stores durable knowledge with:

- kind
- title, summary, content
- scope and project/goal/task links
- source type and provenance
- confidence and sensitivity
- status
- validity dates
- supersession link
- evidence references
- content hash for idempotency

`MemoryPack` is the runtime retrieval output. It groups active records into confirmed preferences, user facts, project conventions, architecture decisions, previous lessons, recurring issues, conflicts, stale warnings, evidence references, retrieval explanation, and uncertain records.

## Truth Policy

- User-stated records are active by default.
- Inferred records are `NEEDS_CONFIRMATION`.
- Confirming a record raises confidence to `1`.
- Superseding a record replaces the old active record with a linked replacement.
- Deleting a record removes it from retrieval without removing audit history.

## Retrieval

Retrieval is SQLite-first and structural:

- query token match
- tags
- project IDs
- goal ID
- task ID
- status
- confidence
- validity window

There is no vector database requirement in Phase 5B.

## API and CLI

Personal OS knowledge endpoints are mounted under `/api` and use the same strict API-key boundary as task-runtime and coding:

- `GET /api/knowledge`
- `POST /api/knowledge`
- `GET /api/knowledge/:id`
- `PATCH /api/knowledge/:id`
- `DELETE /api/knowledge/:id`
- `POST /api/knowledge/search`
- `POST /api/knowledge/:id/confirm`
- `POST /api/knowledge/:id/supersede`
- `GET /api/knowledge/conflicts`
- `POST /api/knowledge/extract/task/:taskId`
- `POST /api/knowledge/memory-pack`

CLI commands:

- `personal-os knowledge list`
- `personal-os knowledge add <kind> <title> <content>`
- `personal-os knowledge search <query>`
- `personal-os knowledge confirm <id>`
- `personal-os knowledge remove <id>`
- `personal-os memory-pack <query>`

## Boundaries

Phase 5B does not perform external actions, push, merge, deploy, send messages, modify calendars, activate cloud coding, or alter the frozen coding engine.

