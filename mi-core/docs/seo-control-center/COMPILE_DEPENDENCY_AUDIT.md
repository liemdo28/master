# SEO Control Center Compile Dependency Audit

Audit date: 2026-07-13
Worktree: `D:\Project\Master-SEO-Clean`
Branch: `feature/seo-control-center-secured`

## Result

Classification: **Case B — origin/master has broken imports and missing modules**.

`origin/master` statically imports five Mi-Core subsystems from
`mi-core/server/src/index.ts`, but `git ls-tree -r origin/master --name-only`
returns no tracked files under those folder paths. The folders are not SEO scope,
but they are compile-time and startup dependencies for the existing server
entrypoint. They were restored in prerequisite commit `299c5bf7` as real source,
not placeholders.

## Evidence Commands

- `git fetch origin`: completed successfully.
- `git ls-tree -r origin/master --name-only -- mi-core/server/src/<dependency>`:
  no files returned for all five dependencies.
- `git grep -n "<dependency>" origin/master -- .`: each dependency is imported
  by `origin/master:mi-core/server/src/index.ts`.
- `git grep -n "<dependency>" -- .`: current working tree imports remain in
  `mi-core/server/src/index.ts`.

## Dependency Findings

| Dependency | origin/master presence | Local-only presence before fix | Importing file | Importing symbol | Compile requirement | Runtime requirement | Optional/mandatory | SEO scope | Production startup | Resolution |
|---|---:|---:|---|---|---|---|---|---|---|---|
| `production-loop` | Import exists; folder absent | Yes | `mi-core/server/src/index.ts` | `productionLoopRouter` | Required by static import | Required if server entrypoint loads | Mandatory baseline dependency | No | Yes | Case B: restored real source in prerequisite commit |
| `business-knowledge-graph` | Import exists; folder absent | Yes | `mi-core/server/src/index.ts` | `knowledgeGraphRouter` | Required by static import | Required if server entrypoint loads | Mandatory baseline dependency | No | Yes | Case B: restored real source in prerequisite commit |
| `cross-agent-intelligence` | Import exists; folder absent | Yes | `mi-core/server/src/index.ts` | `crossAgentRouter` | Required by static import | Required if server entrypoint loads | Mandatory baseline dependency | No | Yes | Case B: restored real source in prerequisite commit |
| `self-improving-memory` | Import exists; folder absent | Yes | `mi-core/server/src/index.ts` | `selfImprovingMemoryRouter` | Required by static import | Required if server entrypoint loads | Mandatory baseline dependency | No | Yes | Case B: restored real source in prerequisite commit |
| `executive-daily-brief` | Import exists; folder absent | Yes | `mi-core/server/src/index.ts` | `executiveDailyBriefRouter` | Required by static import | Required if server entrypoint loads | Mandatory baseline dependency | No | Yes | Case B: restored real source in prerequisite commit |

## Command Results

### `git grep -n "production-loop" origin/master`

```text
origin/master:mi-core/server/src/index.ts:137:import { productionLoopRouter } from './production-loop/production-loop-router';
origin/master:mi-core/server/src/index.ts:305:app.use('/api/production-loop', productionLoopRouter);
```

### `git grep -n "business-knowledge-graph" origin/master`

```text
origin/master:mi-core/server/src/index.ts:138:import { knowledgeGraphRouter } from './business-knowledge-graph/knowledge-graph-router';
```

### `git grep -n "cross-agent-intelligence" origin/master`

```text
origin/master:mi-core/server/src/index.ts:139:import crossAgentRouter from './cross-agent-intelligence/cross-agent-router';
```

### `git grep -n "self-improving-memory" origin/master`

```text
origin/master:mi-core/server/src/index.ts:140:import selfImprovingMemoryRouter from './self-improving-memory/self-improving-memory-router';
```

### `git grep -n "executive-daily-brief" origin/master`

```text
origin/master:mi-core/server/src/index.ts:141:import executiveDailyBriefRouter from './executive-daily-brief/executive-daily-brief-router';
```

## Why Not Case A

The folders do not exist in `origin/master`.

## Why Not Case C

The imports are static top-level imports in `index.ts`. Without real modules,
TypeScript and Node startup fail before an optional availability state could be
reported. Treating them as optional would require a broader subsystem-loader
refactor unrelated to SEO.
