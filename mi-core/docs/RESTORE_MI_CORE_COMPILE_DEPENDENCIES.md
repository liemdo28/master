# Restore Mi-Core Compile Dependencies

This branch restores five real source folders that `origin/master` already imports from
`mi-core/server/src/index.ts` but does not track in Git:

- `production-loop`
- `business-knowledge-graph`
- `cross-agent-intelligence`
- `self-improving-memory`
- `executive-daily-brief`

The source was recovered from the local Mi-Core working tree that had previously been
used to make the baseline server compile. These are not SEO modules and are committed
separately so the SEO Control Center change does not hide a baseline repository defect.

The restored folders provide the router modules statically imported by `index.ts`, so
they are compile-time required and production-startup required for the current server
entrypoint. They are not implemented as placeholders or empty stubs.
