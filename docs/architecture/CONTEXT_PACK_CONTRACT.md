# Context Pack Contract

A context pack is a bounded task-start artifact derived from the active project map and a user request.

It includes:

- `projectId`
- `mapVersion`
- source SHA
- map freshness status
- context policy
- summary
- module summaries
- included relative paths
- excluded path classes
- relevance hints
- optional resume context ID

Policies:

- `MAP_ONLY`
- `MAP_PLUS_TARGETED_READ`
- `TARGETED_READ_REQUIRED`
- `REMAP_REQUIRED`

Context packs must not contain secrets, environment files, or large source dumps.
