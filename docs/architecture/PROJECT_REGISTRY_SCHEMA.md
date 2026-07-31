# Project Registry Schema

The registry uses SQLite under `MI_PROJECT_REGISTRY_DIR`, or `.local-agent-global/project-registry` when the environment variable is unset.

Runtime database files are intentionally not committed.

## Tables

`projects`

- Durable identity and canonical root.
- Git root, repository URL, default branch, package managers, frameworks, commands, PM2 runtime hints, important paths, verification status, and current map pointer.

`project_maps`

- Append-only map history.
- Failed map generations are recorded but do not replace the last valid project map.

`resume_contexts`

- Operational summaries keyed by project and optional task.
- Stores summaries and open items only. It must not store chain-of-thought or secrets.

`context_packs`

- Bounded context payload metadata for task starts.
- References the map version it was derived from.

`schema_migrations`

- Records applied registry schema versions.
