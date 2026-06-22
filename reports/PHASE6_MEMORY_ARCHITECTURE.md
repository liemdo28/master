# Phase 6 Memory Architecture

## Implemented
- Added `server/src/memory/memory-router.ts`.
- Exposed `addMemory()`, `searchMemory()`, `summarizeMemory()`, and `syncMemory()`.

## Canonical Design
Qdrant stores vectors. Supermemory is the future memory intelligence adapter. RAGFlow is the future document QA portal.

## Rule
No direct memory writes outside memory-router. Local memory stores should be read-only caches until migrated.
