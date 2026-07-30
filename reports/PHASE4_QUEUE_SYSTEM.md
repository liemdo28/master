# Phase 4 Queue System

## Implemented
- Added `queue_jobs` and `queue_dead_letters` schema.
- Added `server/src/queue/job-queue.ts`.
- Added enqueue, claim, complete, fail, retry, and dead-letter primitives.
- Added queued endpoints for JSON ingestion and memory indexing.

## Heavy Operations That Must Queue
Embeddings, browser automation, file parsing, indexing, video generation, ingestion, and connector syncs.

## Remaining Work
Add long-running worker processes that claim and execute jobs outside the request path.
