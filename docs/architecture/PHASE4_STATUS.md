# Phase 4 Status — Local Agentic Coding Engine

**Result: PARTIALLY DONE.** A real local LLM coding engine is ACTIVE and passes
**5 of 5** fixture categories end to end with real local commits; acceptance
exits 0. The Mi Core pilot completed once and fails intermittently. Details
below, unrounded. See "Recovery batch" for what changed and why.

## Corrections to the stated baseline

Three premises in the Phase 4 directive did not match the machine:

1. **Model roles.** The directive stated all roles used `qwen2.5-coder:7b`. That
   model was not installed. `model-registry.ts` declared it and
   `ollama-router.ts` ranked it first, but `selectModel()` fell through its
   priority list to "first available non-embedding model" — `qwen3:8b`.
   Configuration and runtime disagreed.
2. **Engines.** None of OpenHands, Aider, Qwen Code or OpenCode is installed.
   There was nothing to wrap.
3. **Repository state.** The canonical checkout sat on
   `codex/phase10-2-reality-closure`, which shares **no common ancestor** with
   `origin/master`, carrying 314 modified and 4,768 untracked files. Phase 4 was
   built in a separate clean worktree from `origin/master` (`6c61e548`); that
   checkout was never touched.

## Hardware

Intel i5-13400F (10C/16T) · 31.9 GB RAM · AMD RX 7600 **8 GB VRAM** (ROCm
working) · Ollama 0.32.0. 8 GB fits exactly one 7-8B Q4 model, which is why
inference is serialised to a single slot.

## Benchmark (first pass — superseded, see "Recovery batch")

> These numbers were taken while fixtures B and E were broken and could not
> pass. They understate every model. The corrected table is in the recovery
> section; both are kept so the correction is auditable.

Four models, five fixtures, real engine, one model at a time. Round 1 measured
a constraint rather than the models (the writable set was bound to the model's
own plan, producing `POLICY_DENIED` in 7 of 20 runs) and was re-run. Round 2:

| model | passed | plan valid | patch valid | hallucinated paths | tok/s | mean s | peak VRAM |
|---|---|---|---|---|---|---|---|
| **qwen3:8b** | **3/5** | 100% | 100% | 0% | 23.1 | 48 | 7.22 GB |
| qwen2.5-coder:7b | 1/5 | 80% | 60% | 0% | 45.3 | 24 | 5.62 GB |
| qwen2.5-coder:14b | 1/5 | 100% | 100% | 0% | 7.0 | 103 | 7.30 GB |
| deepseek-coder-v2:lite | 2/5 | 100% | 80% | 0% | 11.1 | 118 | 7.23 GB |

| model | bug-fix | multi-file | type-repair | refactor | unfamiliar-repo |
|---|---|---|---|---|---|
| qwen3:8b | PASS | fail | PASS | PASS | fail |
| qwen2.5-coder:7b | PASS | fail | fail | fail | fail |
| qwen2.5-coder:14b | PASS | fail | fail | fail | fail |
| deepseek-coder-v2:lite | PASS | fail | PASS | fail | fail |

A general model beat every dedicated coder model. Larger was not better:
`qwen2.5-coder:14b` spills out of 8 GB VRAM to ~7 tok/s and still scored 1/5,
which makes it impractical for interactive use on this host.

### Review quality (measured separately)

Writing a change and judging one are different skills, so review roles were
chosen from diffs with known verdicts rather than from task scores.

| model | correct | false PASS (unsafe) | false FAIL | mean s |
|---|---|---|---|---|
| **qwen3:8b** | **6/6** | **0** | 0 | 4 |
| deepseek-coder-v2:lite | 5/6 | **1** | 0 | 8 |
| qwen2.5-coder:7b | 4/6 | 0 | 2 | 3 |
| qwen2.5-coder:14b | 4/6 | 0 | 2 | 16 |

`deepseek-coder-v2:lite` **approved a diff containing a hardcoded API key**. A
false approval is the one error a reviewer must not make, so it is excluded from
the review role despite ranking second on tasks.

### Selected roles

| role | model | basis |
|---|---|---|
| `coding_primary` | `qwen3:8b` | highest task success, 100% plan and patch validity |
| `coding_fast` | `qwen2.5-coder:7b` | fastest (45 tok/s), only model with real VRAM headroom |
| `coding_review` | `qwen3:8b` | 6/6 with zero false approvals |

Primary and review share weights because no other installed model reviews
accurately enough. Independence therefore comes from a fresh diff-only
invocation plus the deterministic layer, and is reported as
`independentModel: false` rather than overstated.

## Acceptance — 3/5 (first pass — superseded by 5/5, see "Recovery batch")

Through the real control plane (registry, fresh map, context pack, ranked
candidates, isolated worktree, validation, review, local commit):

| fixture | category | result | local commit |
|---|---|---|---|
| task-a-bug-fix | bug-fix | **PASS** | `33256252c85e` |
| task-b-multi-file-feature | multi-file-feature | FAIL | — |
| task-c-type-repair | type-repair | **PASS** | `f53a9ce5f827` |
| task-d-refactor | refactor | **PASS** | `b401b879f150` |
| task-e-unfamiliar-repo | unfamiliar-repo | FAIL | — |

Both failures are `VALIDATION_FAILED`: the model produced a well-formed,
in-scope patch that did not actually make the tests pass. Every guard behaved
correctly — no commit was created, and the base checkout was untouched.

## Mi Core pilot — FAILED (first pass; later completed once, see "Recovery batch")

The pilot task was a narrow read-only API improvement in one existing file.
It failed every time, with a consistent and diagnosable cause.

| attempt | candidates | model's plan | outcome |
|---|---|---|---|
| 1 | 24 | "enforce coding context based on project metadata" | build failed |
| 2 | 24 | "benchmark coding models" | invalid patch |
| 3 | 19 | "benchmark coding models for review quality" | invalid patch |
| 4 (narrower request) | 20 | "add a read-only endpoint returning the engine registry" | no net change |

**The engine is not the bottleneck; context packing is.** On Mi Core the context
pack spans ~20 files across a dozen unrelated modules. An 8B model reads that
wall of source and describes *what it was shown* instead of what was asked — in
attempt 4 it echoed a task description it found verbatim inside
`acceptance.ts`. The same engine, on focused repositories with 3-5 candidates,
plans and patches correctly.

Two ranking fixes were made and kept because they are general improvements, not
pilot-specific tuning:

- filename matches now outrank directory matches (previously every file under
  `server/src/coding/` tied and broke alphabetically, burying the target)
- candidates matching nothing in the request are dropped rather than padding the
  list to the cap

Neither was sufficient. Tuning further would mean fitting the system to one
task, which the directive explicitly rules out. **Closing this gap needs a
sharper context pack for large repositories** — the honest next step, not a
prompt adjustment.

## Security — 64 boundary assertions

Path traversal, absolute and UNC paths, Windows device names, null bytes,
junction escape, `.env` and key material, unregistered commands, command
chaining (`&&`, `;`, `|` — inert because there is no shell), writes outside the
plan and outside the worktree, ambiguous and missing anchors, partial-batch
rollback, secrets and weakened tests in the diff, cross-project context
expansion, and non-loopback endpoints including the cloud metadata address.
`git push` is not a registered command and the engine contains no push, merge
or deploy capability.

## Privacy — 32 assertions

Global `fetch` is instrumented, a real model-backed task is run, and every
observed request is asserted loopback. Zero requests reached any cloud provider.
No provider credential is read; spawned processes get a minimal env with
telemetry disabled. Models were fetched once from ollama.com under explicit
approval; all inference since is local.

## Resume — 23 assertions

Interruption after plan, after apply before validation, mid-validation, on
double resume and after cancellation. On restart the workflow rebuilds the
adapter the task was *planned* with, skips an already-completed apply, and
creates **at most one commit** in every case. Engine session state lives outside
the worktree so it never enters the diff.

One real bug was found and fixed here: an already-aborted `AbortSignal` never
emits `abort`, so a cancelled task could start one more inference.

## Validation

| command | result |
|---|---|
| `npm ci` | exit 0 |
| `npm run build` | exit 0 |
| `npm run test:ci` | exit 0 |
| `npm run test:agentic-coding` | exit 0 (64 + 23 assertions) |
| `npm run test:agentic-coding-privacy` | exit 0 (30 assertions) |
| `npm run agentic-coding:fixtures` | exit 0 (5/5 baselines correct) |
| `npm run agentic-coding:acceptance` | exit 0 — 5/5 (after recovery) |
| conflict-marker scan | clean |
| secret scan | clean (only the deliberate fixture secret the boundary test refuses) |

## Engine status

| engine | status |
|---|---|
| `local-llm-engine` | **ACTIVE** |
| `internal-patch-engine` | ACTIVE — deterministic fallback |
| OpenHands, Aider | WRAP_LATER — not installed |
| Qwen Code, OpenCode | INACTIVE — not installed |

## Not started

UI redesign · autonomous push, merge or deploy · cloud coding · Phase 5.

## What remains for full Phase 4

1. Multi-file feature and unfamiliar-repo fixture categories (model capability).
2. A context pack narrow enough for a repository the size of Mi Core, then the
   real pilot.

---

# Recovery batch

The first pass reported 3/5 acceptance and a failed pilot. Diagnosis showed
most of that was **defects in this work**, not model capability.

## Root causes found

| # | Defect | Whose | Effect |
|---|---|---|---|
| 1 | Fixtures B and E used `node --test spec` / `node --test t`; Node resolves these as *module* paths | mine | Both fixtures died with MODULE_NOT_FOUND before running a single test. Every model scored zero on them for a reason unrelated to the task. |
| 2 | Candidate pruning used exact substring matching | mine | Request said "normalisation", file was `stage_normalise.js`. The one file task E needed was pruned; the model was left editing `stage_merge.js`, the only survivor. |
| 3 | Context byte budget (96 KB) and model window (16,384 tokens) were independent constants | mine | 58 KB of source ≈ 17k tokens overflowed the window. Ollama truncated the prompt from the left, so the model got source code with the instructions cut off and produced anchors matching nothing. **This was the cause of all four original pilot failures.** |
| 4 | The first patch attempt had no retry, though the repair path did | mine | A paraphrased search anchor — the most common local-model patch error — failed the whole task despite a correct plan. |
| 5 | Patch output budget too small for a whole-function refactor | mine | Truncated mid-JSON, surfaced as CONTEXT_INSUFFICIENT. Raising it to 4096 then hit the 300 s timeout, i.e. the same failure renamed; timeout is now derived from the budget. |
| 6 | Model duplicated an existing test instead of fixing source | model | Validation passed, reviewer correctly rejected the diff as adding nothing. Fixed by prompt rule. |

## Fixes

- Fixture test scripts use globs; `baseline-check` now **fails any fixture whose
  harness errors or that runs no tests**, so a fixture can no longer look
  "correctly failing" while being broken.
- Hint matching is word-level and tolerant of morphological variants; test files
  are never pruned since they are the specification; pruning applies only above
  8 candidates.
- Strict top-k initial candidate set (default 8, `MI_CODING_INITIAL_CANDIDATES`),
  with progressive expansion still available.
- Context budget derived from `num_ctx`; `num_ctx` raised to 32,768.
- Bounded retry on the first patch attempt, with the rejection fed back.
- Error-driven context expansion: a failing build names the definition the model
  never saw, which is treated as the concrete symbol/import justification for
  widening context. This widens what is *read*, never what is *permitted*.
- Prompt states that shown files are candidates for reading, not edit targets,
  and that an existing failing test means changing the source.

## Results after recovery

| gate | before | after |
|---|---|---|
| `agentic-coding:acceptance` | 3/5, exit 1 | **5/5, exit 0** (3 consecutive runs) |
| task-b repeated runs | 0/3 | **3/3** |
| task-e repeated runs | 0/3 | **3/3** |
| Mi Core pilot | 0/4 | 1 of ~7 — **intermittent** |
| `test:ci` | exit 0 | exit 0 |
| privacy | 30 assertions | 32 assertions, 5 observed requests, all loopback |
| boundary / resume | 64 / 23 | 64 / 23 |

### Benchmark, re-run with the fixtures repaired

The earlier table understated every model, because two of five fixtures could
not pass.

| model | before | after | plan valid | patch valid | repair success | tok/s |
|---|---|---|---|---|---|---|
| **qwen3:8b** | 3/5 | **4/5** | 100% | 80% | 100% | 14.6 |
| qwen2.5-coder:14b | 1/5 | 3/5 | 100% | 80% | 0% | 5.5 |
| qwen2.5-coder:7b | 1/5 | 2/5 | 100% | 80% | 33% | 32.6 |
| deepseek-coder-v2:lite | 2/5 | 2/5 | 100% | 100% | 0% | 8.1 |

Role selection is unchanged: qwen3:8b remains clearly strongest.

## What still does not work

**The Mi Core pilot is intermittent.** It completed once —
commit `94c02aea`, a correct one-line addition of `engineId: task.codingEngine`
to the plan endpoint, validated and reviewed — but fails most runs.

The remaining failure is now singular and well understood. The model plans the
right file and writes the right shape of change, then uses `task.engineId`
instead of the real field name `task.codingEngine`:

```
src/routes/coding.ts(157,22): error TS2339:
  Property 'engineId' does not exist on type 'TaskRecord'.
```

Error-driven expansion removed the accompanying wrong-import error by pulling in
the defining module, but three repair cycles do not correct the field name: the
model keeps reusing the wording from the request ("engine id") rather than the
identifier in the type it has been shown. That is a model-capability limit at
8B, not a context or boundary problem.

Fixture-scale repositories are reliable. A repository the size of Mi Core is
not yet, and no further tuning was attempted, because fitting the system to one
pilot task is what the directive forbids.

## Remaining work for full Phase 4

1. Make the Mi Core pilot reliable rather than intermittent. The most promising
   direction is symbol-level context (feeding the model the exact interface
   members of types it edits) rather than more prompt tuning.
2. Optionally re-evaluate a larger model for `coding_primary` once more VRAM is
   available; 14B currently spills to CPU at ~5.5 tok/s.

---

# Symbol-level context batch

Implemented as approved. Outcome: **the original blocker is fixed and fixture
acceptance holds at 5/5, but the Mi Core pilot is still 0/5 — now for a
different, deterministic reason.** Stop condition reached; not pushed.

## What was built

`server/src/coding/llm/symbols.ts` — TypeScript compiler API extraction of
exported interfaces, type aliases, classes, enums, functions and consts, with
member names, types and optionality. Resolved across import edges, plus one
transitive hop (a candidate importing `TaskStore` never imports `TaskRecord`,
yet `store.getTask()` returns one — so the type whose members the model most
needs is exactly the one a single import hop cannot reach).

- **Contract**: `symbolName`, `kind`, `sourcePath`, `signature`, `members`,
  `importedBy`, `relevanceReason`, `bytes`.
- **Limits**: symbol count, total bytes, members per symbol; every inclusion
  records why.
- **Compiler-error-driven expansion**: missing property, missing export, wrong
  import and incompatible type are parsed for symbol and member names, the
  definitions resolved and added to the next repair prompt. Emits
  `coding.context.symbols.expanded`.
- **Plan gate**: the plan must name `targetFile`, `targetSymbol`,
  `targetMember`, `relatedTest`. A plan whose target member does not exist on
  its target symbol is rejected with the real member list. Silent when the
  symbol is not in context (no opinion) or when the request is additive.
- **Secrets**: credential-shaped literals and names are redacted; private class
  members are never emitted.

51 assertions in `symbol-context.test.ts`, all on synthetic types
(`VesselRecord`, `BerthRegistry`, `HullClass`). No Mi Core symbol appears in the
tests, so the layer cannot be passing by accident.

## Did it work?

**Yes, for what it targeted.** The `Property 'engineId' does not exist on type
'TaskRecord'` failure that blocked the previous batch is gone from every
subsequent run. The model now uses real member names.

Two further defects were found and fixed along the way:

| Defect | Effect |
|---|---|
| Exact-only anchor matching | "search anchor not found" was the top failure for *every* model in the benchmark. Local models reproduce the right lines with reconstructed indentation. Now falls back to whitespace-insensitive line matching, still requiring exactly one match, re-indenting the replacement by a uniform delta. 8 new boundary assertions cover apply, ambiguity, absence and non-interference. |
| Context pack took the first 8 paths per module **alphabetically** | `routes/coding.ts` is the 9th route file, so a request naming it exactly produced a pack that did not contain it — the model planned the right change and was rejected for planning "outside the candidate set". Paths are now ranked by relevance before slicing. This also removed a pre-existing hardcoded `if the request says "endpoint", pull the coding routes` special case in Phase 3, which was task-specific by construction. |

## Why the pilot still fails

Not the field name, and not anchors. **Lexical candidate ranking selects the
wrong file, deterministically.**

The request contains the word "engine" as a *value* ("include the engine id").
Ranking scores a filename match at 3 and a directory match at 1:

| file | score | why |
|---|---|---|
| `server/src/coding/llm/engine.ts` | 4 | filename "engine" + directory "coding" |
| `server/src/routes/coding.ts` | 3 | filename "coding" only |

So the engine's own source outranks the route the task is about, and the model
edits `llm/engine.ts` in 3 of 3 observed runs. Lexical matching cannot tell
"the engine id" (a value) from "engine.ts" (a file); that needs semantic or
embedding-based retrieval, which is a materially different design.

Given the instruction not to tune indefinitely, tuning stopped here.

## Output budget: measured, not guessed

Raising `PATCH_OUTPUT_TOKENS` to 4096 regressed fixture acceptance to 3/5
(a truncation trade for anchor and validation failures). At 3072 acceptance is
5/5 on two consecutive runs. 3072 is the value in the branch.

Acceptance has genuine run-to-run variance; single runs are not evidence. The
5/5 figure is from repeated measurement.

## Gate status

| gate | result |
|---|---|
| fixture acceptance | **5/5, exit 0** (two consecutive runs at final settings) |
| `npm run build` | exit 0 |
| `npm run test:ci` | exit 0 |
| boundary assertions | 72 |
| symbol-context assertions | 51 |
| resume assertions | 23 |
| fixture baselines | 5/5 correct |
| **Mi Core pilot** | **0/5 — below the 4/5 gate** |

PR gate not met. Nothing pushed.

## Honest next step

Candidate retrieval, not the model and not the prompt. Concretely: rank by
symbol and route definitions the request names (an exact route string like
`/tasks/:id/plan` should dominate a filename token collision), or use local
embeddings for candidate selection. Both are larger design changes than this
batch, and neither is prompt tuning.

---

# Phase 4.5 — semantic retrieval

**The retrieval blocker is solved. The Mi Core pilot went from 0/5 to 5/5.**
Fixture acceptance is not consistently 5/5, so the PR gate is not met and
nothing was pushed.

## Architecture

Layered evidence, not one flat keyword score. Every contribution carries a
kind, a weight and an explanation, so a ranking can be audited.

| layer | signals | weight range |
|---|---|---|
| 1 exact structural | explicit path, exact route, exact symbol, response key, operational string | 25–100 |
| 2 framework structure | route definition, CLI registration, artifact-role affinity | 15–30 |
| 3 dependency graph | direct import, one-hop import, related test | 5–16 |
| 4 symbol graph | symbol definition (scaled by name coverage), type reference | 8–14 |
| 5 lexical | filename token, directory token | 1–3 |
| 6 embeddings | **not implemented — structural retrieval was sufficient** | — |

A filename token is worth 3. An exact route is worth 60. That ratio is the
whole point: no accumulation of weak name matches can outvote one structural
match.

## Why the pilot was failing

`llm/engine.ts` scored 4 and `routes/coding.ts` scored 3 under lexical ranking,
because the request's word "engine" named a *value*. Under retrieval:

| file | rank | score | evidence |
|---|---|---|---|
| `server/src/routes/coding.ts` | **1** | 925 | response keys `plan`, `engine`, `task`; route segment matches |
| `server/src/coding/llm/engine.ts` | 36 | 47 | filename token only; not reachable from a route handler |

## Three rules that earn their place

Each fixed an observed failure rather than an intuition:

1. **Route evidence only counts when the request is about routes.** Crediting it
   unconditionally made any multi-route file the top hit for *every* request —
   including a test-only change — because response keys collide with ordinary
   nouns like "status" or "task".
2. **A module nothing imports, serving no route, matched only by name, is a
   decoy.** This separates `validation/assignment-rules.ts` (imported by a
   handler, has a test) from `lib/assignment.ts` (imported by nothing). Applied
   only above 12 files: in a small repository the leaf module nothing imports is
   frequently the file being asked about, and penalising it excluded the only
   file a two-file TypeScript fixture needed.
3. **Symbol evidence scales with name coverage.** `normaliseTonnage` against
   "normalise the tonnage" covers both parts and is real; `assignmentLabel`
   against a request that merely says "assignment" shares one generic word.

## Retrieval evaluation — PASS

Ten tasks, two synthetic repositories with deliberately different conventions
(TypeScript/camelCase/`src`, and CommonJS/snake_case/no-`src`).

| metric | measured | target |
|---|---|---|
| Top-1 accuracy | 90% | — |
| **Top-3 recall** | **100%** | ≥ 90% |
| Mean reciprocal rank | 0.950 | — |
| **Unrelated candidate rate** | **3.7%** | < 10% |
| Average candidates | 4.2 | — |
| Average context | 1,147 bytes | — |
| Retrieval latency | 22 ms (2.5 s cold graph build over 819 files) | — |
| Path violations | 0 | 0 |
| Deterministic | yes | yes |

Two defects were found by the evaluation rather than by inspection: intent
patterns requiring exact base words classified "configured"/"settings" as
UNKNOWN and left retrieval selecting *nothing*; and treating "returns" as an
HTTP signal misclassified any function description as an API request.

## Mi Core pilot — 5/5

| run | status | commit | file changed |
|---|---|---|---|
| 1 | COMPLETED | `b48bccad4d8d` | `server/src/routes/coding.ts` |
| 2 | COMPLETED | `4ab3fdb224c8` | `server/src/routes/coding.ts` |
| 3 | COMPLETED | `b406e15854a0` | `server/src/routes/coding.ts` |
| 4 | COMPLETED | `702069f5df24` | `server/src/routes/coding.ts` |
| 5 | COMPLETED | `5fa34372791f` | `server/src/routes/coding.ts` |

Task wording unchanged from the failing Phase 4 runs. Validation and review
passed on every run; base checkout untouched; no push.

## What is still not met

**Fixture acceptance is not reliably 5/5.** Measured across four rounds:
5/5, 3/5, 5/5, 3/5.

The failures are `task-c-type-repair` (VALIDATION_FAILED — a well-formed patch
that does not fix the compile error) and `task-d-refactor`
(CONTEXT_INSUFFICIENT — the patch exceeds the output budget on a whole-function
rewrite). Both are **model reasoning**, not retrieval: retrieval selects the
correct files in every round, and the patch applies.

The output budget was re-measured now that retrieval halves the context: 4096
gave 3/5 and 3072 gave 5/5 and 3/5. The budget is not the lever.

## PR gate

| gate | status |
|---|---|
| retrieval evaluation meets target | PASS |
| **fixture acceptance 5/5 in two consecutive rounds** | **NOT MET (5/5, 3/5)** |
| Mi Core pilot ≥ 4/5 | PASS (5/5) |
| build / test:ci | PASS |
| test:agentic-coding (72 + 51 + 36 + 23 assertions) | PASS |
| privacy (31 assertions, 4 requests, all loopback) | PASS |
| no task-specific retrieval or patch logic | PASS |
| no cloud transfer, no production change | PASS |

Not pushed. Embeddings were not implemented, because structural retrieval met
the target on its own.

## Remaining blocker

**Model reasoning**, specifically on type-error repair and whole-function
refactor at 8B. Not retrieval, not patch application, not validation, not
review. Closing it means a stronger local coding model, which needs more VRAM
than the 8 GB available.
