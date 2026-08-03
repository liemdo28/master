# Phase 4 — Local Agentic Coding Engine Runbook

## What changed

Phase 3 shipped the coding control plane (project registry, task runtime,
context packs, worktree isolation, validation, review, local commit) with a
single deterministic adapter, `internal-patch-engine`. That adapter matched a
regex against the request and wrote one hardcoded route; it threw on anything
else.

Phase 4 adds `local-llm-engine`: a general-purpose adapter that drives a local
Ollama model through inspect → expand → plan → patch → repair. It contains no
task-specific logic. Both engines remain selectable.

## Engine selection

```bash
npm run coding -- engines
```

Resolution order: per-task `engineId` → `MI_CODING_ENGINE` → `local-llm-engine`.

| Engine | Status | Use |
|---|---|---|
| `local-llm-engine` | ACTIVE | Default. General-purpose, model-backed. |
| `internal-patch-engine` | ACTIVE (deterministic fallback) | Tasks that must not involve a model. |
| `openhands`, `aider` | WRAP_LATER | Not installed on this host. |

## Running a task

```bash
npm run coding -- run <projectId> <contextPackId> "<request>"
```

Add `--engine=internal-patch-engine` to force the deterministic path. Progress,
cancellation and evidence:

```bash
npm run coding -- follow <taskId>
```

```bash
npm run coding -- cancel <taskId> "reason"
```

```bash
npm run coding -- evidence <taskId>
```

There is no push command in this phase, and the engine has no push, merge or
deploy capability. Commits are local only.

## Boundaries

The engine's entire capability surface is `server/src/coding/llm/tools.ts`.
It never receives a shell.

- **Paths** are re-validated on every call. Absolute paths, UNC paths, `..`
  traversal, Windows device names, null bytes, `.env`, `.git`, key material and
  binaries are refused. Symlinks are resolved before the containment check, so a
  junction cannot smuggle access outside the worktree.
- **Commands** are argv arrays with `shell: false`, a timeout, an output cap and
  a minimal environment. `&&`, `;` and `|` in a model-supplied string are inert
  because there is no shell to interpret them. Only registered validation
  commands can run.
- **Writes** are limited to the approved candidate set from the context pack.
  Edits beyond the model's own plan are permitted but recorded as `beyondPlan`
  and surfaced to review; edits outside the candidate set are refused.
- **Context** starts at the ranked candidates. Anything further requires an
  explicit request with a justification, is re-checked against the same rules,
  and is recorded as `coding.context.expanded`.

## Network and privacy

`resolveOllamaEndpoint()` throws unless the endpoint is loopback, before any
socket opens. Cloud fallback is disabled and no provider credential is read.

`npm run test:agentic-coding-privacy` instruments global `fetch`, runs a real
model-backed task, and asserts every observed request went to `127.0.0.1`.

Models were fetched once from ollama.com under explicit approval; all inference
since is local.

## Resource limits

This host has 8 GB of VRAM. A 14B Q4 model already spills to CPU, so two
resident models would thrash.

- Model inference is serialised process-wide (one slot).
- One active model-backed coding task at a time.
- Admission is refused when free RAM, free disk or worktree count is out of
  bounds, rather than queuing work that will stall the desktop.
- The deterministic engine is exempt — it loads no weights.

Override via `MI_CODING_MAX_ACTIVE_TASKS`, `MI_CODING_MIN_FREE_RAM_GB`,
`MI_CODING_MIN_FREE_DISK_GB`, `MI_CODING_MAX_WORKTREES`,
`MI_CODING_INFERENCE_TIMEOUT_MS`. Inspect with:

```bash
npm run coding -- resources
```

## Failure categories

`MODEL_UNAVAILABLE`, `MODEL_TIMEOUT`, `INVALID_PLAN`, `INVALID_PATCH`,
`CONTEXT_INSUFFICIENT`, `VALIDATION_FAILED`, `POLICY_DENIED`,
`RESOURCE_EXHAUSTED`, `ENGINE_CRASHED`.

Recorded as `coding.failure.classified` events and exposed at
`GET /coding/tasks/:id/progress`.

Repair is bounded at 3 cycles and stops early when the same normalised failure
signature repeats — a third identical run is evidence the model cannot see the
cause, not that it needs another attempt.

## Review

Two layers, both blocking:

1. **Deterministic** — conflict markers, secret and private-key literals,
   suspicious runtime capabilities (`child_process`, `eval`, non-loopback
   `fetch`), edits outside the approved set, and test files that shrank or
   gained `.skip`/no-op assertions.
2. **Independent model** — a second invocation with fresh context that receives
   only the diff and the original task, never the generation transcript.

When only one model is installed the two roles collapse onto the same weights.
That is reported as `independentModel: false` rather than presented as
independent review.

## Resume

Interruption is tested after plan, after apply before validation, mid-validation,
on double resume, and after cancellation. On restart the workflow rebuilds the
adapter the task was *planned* with, skips an apply that already happened, and
creates at most one commit. Engine session state lives in a sidecar outside the
worktree so it never enters the task's diff.

## Validation

```bash
npm run agentic-coding:fixtures
```

```bash
npm run test:agentic-coding
```

```bash
npm run agentic-coding:acceptance
```

```bash
npm run agentic-coding:benchmark -- qwen3:8b qwen2.5-coder:7b
```

`test:ci` runs the unit, task-runtime, project-registry, coding and
agentic-coding suites.

## Known limits

- Fixture success is model-dependent. See the benchmark artifacts for measured
  per-model, per-category results; do not assume a model handles a category it
  was not measured on.
- Multi-file features are the weakest category across every model tested.
- `qwen2.5-coder:14b` and `deepseek-coder-v2:lite` exceed 8 GB VRAM and spill to
  CPU, which makes them impractical for interactive use on this host.
