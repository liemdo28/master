# Cross Division Coordination

Runtime source: `server/src/company-os-operational/coordination-engine/`.

The coordination engine validates:
- Duplicate detection
- Dependency graph
- Owner coverage
- Approval tracking
- Orphan task prevention
- Workflow duplicate surfacing

It reuses the existing executive coordination registry as the source of truth.
