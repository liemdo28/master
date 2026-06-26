# Source Structure Alignment

Generated: 2026-06-26

| expected_path | current_path | status | action |
|---|---|---|---|
| `mi-core/server/src/executive-coordination/` | `mi-core/server/src/executive-coordination/` | ALIGNED | Keep as Phase 0 source |
| `mi-core/server/src/open-source-governance/` | `mi-core/server/src/open-source-governance/` | ALIGNED | Keep as Phase 0.5 source |
| `mi-core/server/src/technology-portfolio/` | `mi-core/server/src/technology-portfolio-office/` | MISMATCH | Keep current source, document alias, avoid duplicate implementation |
| `mi-core/server/src/workflow-fabric/` | `mi-core/server/src/workflow-fabric/` | ADDED | Phase 0.7 source added with dedup/governance/evidence modules |
| `mi-core/server/src/engineering-division/` | `mi-core/server/src/engineering-division/` | ALIGNED | GitHub verification still required |
| `mi-core/server/src/operator-runtime/` | `mi-core/server/src/operator-runtime/` | ALIGNED | Operator runtime readiness remains Phase 2B gate |
| `mi-core/server/src/financial-warehouse/` | Not found | MISSING | Block Phase 3A completion until source exists or canonical path is mapped |
| `mi-core/server/src/financial-intelligence/` | `mi-core/server/src/financial-intelligence/` | ALIGNED | Needs PR/test/runtime proof |
| `mi-core/server/src/marketing-foundation/` | `mi-core/server/src/marketing-foundation/` | ALIGNED | Needs PR/test/runtime proof |
| `mi-core/server/src/marketing-intelligence/` | `mi-core/server/src/marketing-intelligence/` | ALIGNED | Needs PR/test/runtime proof |
| `mi-core/reports/` | `mi-core/reports/` | ALIGNED | Reports are the proof index, not completion by themselves |
| `mi-core/tests/` | `mi-core/tests/` | ALIGNED | Phase tests must be run and tied to branch/commit/PR |

Decision: do not duplicate `technology-portfolio-office` into a second `technology-portfolio` implementation. Treat `technology-portfolio-office` as the canonical Phase 0.6 source unless CTO requests a rename migration.
