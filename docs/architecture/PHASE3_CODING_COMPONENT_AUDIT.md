# Phase 3 Coding Component Audit

Date: 2026-08-03
Branch: `codex/phase3-coding-workflow`
Base: `7748c46f497fbaa692494dbeb0d13cacb7054b18`

## Decision Summary

Phase 3 keeps the Phase 2 project registry and task runtime as the only durable control plane for coding tasks. The new coding workflow is additive under `server/src/coding` and records task state, events, evidence, worktree paths, model roles, validation, review, and local commits in the existing task-runtime store.

## Components

| Component | Classification | Reason |
| --- | --- | --- |
| `server/src/project-registry/*` | KEEP | Canonical project identity, map freshness, context pack, and boundary checks already exist and are required before coding starts. |
| `server/src/task-runtime/*` | ADAPT | Existing durable task lifecycle, events, evidence, async process execution, and cancellation are reused; Phase 3 only adds nullable coding metadata columns. |
| `server/src/model-router/ollama-router.ts` | WRAP | Provides local-first model selection. Phase 3 wraps it into coding roles instead of hardcoding one model. |
| `server/src/models/model-registry.ts` | WRAP | Source of model inventory and role metadata. Phase 3 reads it for local coding capability. |
| `server/src/coo-v4/agents/ai-developer-agent.ts` | IGNORE | Pattern-based legacy agent, not context-pack gated and not suitable as the canonical repo-scale workflow. |
| `server/src/coo-v4/* Aider/OpenHands references` | DEPRECATE | Useful historical labels only; they are not wired to durable task runtime events, worktrees, validation, or review. |
| `server/src/engineering/*` | IGNORE | Engineering division routing/review concepts remain separate from the Phase 3 runtime contract. |
| `agent-engine/eval/*` and `scripts/coding-brain-benchmark.mjs` | IGNORE | Benchmark assets only, not an execution workflow. |
| OpenHands | WRAP LATER | Repo-scale candidate retained in the engine registry as optional; not activated until a bounded adapter can enforce context, worktree, no shell bypass, validation, and cancellation. |
| Aider | WRAP LATER | Small-edit/review candidate retained as optional; not activated in Phase 3 vertical slice. |
| `internal-patch-engine` | KEEP | Active deterministic offline adapter for the first acceptance task and tests. It is narrow by design and runs inside the enforced workflow. |

## Canonical Phase 3 Path

1. Project registry must show an `ACTIVE` project with a `FRESH` map.
2. Context pack must belong to the same project and active map.
3. Workflow creates an isolated Git worktree and deterministic task branch.
4. Candidate files come from the context pack and are capped.
5. Model routing selects local-first coding roles.
6. Engine adapter inspects, plans, applies, and writes evidence.
7. Validation and review must pass before a local commit is created.
8. No push or production deploy happens from the coding workflow.
