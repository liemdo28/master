# Project Map Contract

A project map is a compact, deterministic summary of an explicitly registered project root.

It includes:

- `projectId`
- `mapVersion`
- source Git SHA when available
- map status
- module summaries
- route signals
- npm command signals
- risk notes

Project maps do not embed source file contents. Targeted source reads are still required before code edits.

Status values:

- `FRESH`
- `STALE`
- `PARTIAL`
- `FAILED`
- `NOT_GENERATED`

Failed maps are preserved as evidence but never overwrite the active valid map pointer.
