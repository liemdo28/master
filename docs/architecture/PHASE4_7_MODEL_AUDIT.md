# Phase 4.7 — Local Model Capability Audit

Measurement only. No workflow, prompt or task-specific change was made.

## Hardware

| | |
|---|---|
| CPU | Intel i5-13400F, 10C/16T |
| RAM | 31.9 GB (`os.totalmem()` reports 34.4 GB decimal) |
| GPU | AMD Radeon RX 7600, **8 GB VRAM**, ROCm working |
| Disk | D: 66.2 GB free · C: 331.9 GB free · models 34.8 GB |
| Backend | Ollama 0.32.0, `127.0.0.1:11434` only |

## Candidates

All four were already installed; no download was required.

`qwen3:8b` · `qwen2.5-coder:7b` · `qwen2.5-coder:14b` · `deepseek-coder-v2:lite`

**qwen3-coder was not tested.** Its smallest published variant is 30B-class
(~18 GB quantised). With 8.9–16.4 GB of free RAM and 8 GB of VRAM it would be
neither VRAM- nor RAM-resident and would page continuously. Answering that
question needs either a hardware change or explicit approval for the download.

## Method

Identical tasks, identical context packs, identical prompts, one model at a
time, unloaded between models. The only variable is the model name. Five task
categories: debugging/bug-fix, multi-file feature, type repair, refactor, and
unfamiliar-repository navigation. Code review measured separately against diffs
with known verdicts.

## Results — coding tasks

| model | bug-fix | multi-file | type-repair | refactor | unfamiliar | total | first-pass |
|---|---|---|---|---|---|---|---|
| **qwen3:8b** | PASS | PASS | PASS | fail | PASS | **4/5** | **3/5** |
| **qwen2.5-coder:14b** | PASS | PASS | PASS | fail | PASS | **4/5** | 2/5 |
| qwen2.5-coder:7b | PASS | fail | fail | fail | PASS | 2/5 | 0/5 |
| deepseek-coder-v2:lite | PASS | fail | fail | fail | PASS | 2/5 | 1/5 |

| model | plan valid | patch valid | halluc. files | validation pass | repair success | ctx fail | truncation | tok/s | mean s | VRAM | RAM in use |
|---|---|---|---|---|---|---|---|---|---|---|---|
| qwen3:8b | 100% | 100% | 0% | 80% | 50% | 0% | 0 | **13.9** | **66** | 7.15 GB | 27.3 GB (79%) |
| qwen2.5-coder:7b | 100% | 100% | 0% | 40% | 40% | 0% | 0 | **29.0** | **38** | **6.42 GB** | 25.2 GB (73%) |
| qwen2.5-coder:14b | 100% | 100% | 0% | 80% | 67% | 0% | 0 | 5.1 | 124 | 7.19 GB | **33.6 GB (98%)** |
| deepseek-coder-v2:lite | 100% | 100% | 0% | 40% | 25% | 0% | 0 | 7.2 | 177 | 7.14 GB | **33.8 GB (98%)** |

Every model now produces valid plans and valid patches, with zero hallucinated
files and zero context failures. Those were engine problems and they are gone.
What separates the models is whether the change is *correct*.

## Results — code review

| model | correct | false PASS (unsafe) | false FAIL | mean s |
|---|---|---|---|---|
| **qwen3:8b** | **6/6** | **0** | 0 | **4** |
| deepseek-coder-v2:lite | 5/6 | **1** | 0 | 8 |
| qwen2.5-coder:7b | 4/6 | 0 | 2 | 3 |
| qwen2.5-coder:14b | 4/6 | 0 | 2 | 16 |

`deepseek-coder-v2:lite` approved a diff containing a hardcoded API key. A false
approval is the one error a reviewer must not make, so it is disqualified from
the review role regardless of its task score. The two coder models reject
correct diffs a third of the time, which would block valid work.

## Recommendations

| role | model | basis |
|---|---|---|
| `coding_fast` | **qwen2.5-coder:7b** | 29.0 tok/s, 38 s mean, 6.42 GB VRAM — the only model with real headroom. Right for cheap bounded decisions such as the context-expansion pass, not for authoring. |
| `coding_primary` | **qwen3:8b** | Ties the 14B on capability (4/5) with a better first-pass rate (3/5 vs 2/5), at **2.7× the speed** and 6 GB less RAM pressure. |
| `coding_review` | **qwen3:8b** | 6/6 with zero false approvals, 4 s. No alternative is both accurate and safe. |

This confirms the roles already configured, now against a fuller and fairer
measurement than the original selection.

## What qwen3:8b should keep

Debugging/bug-fix, multi-file features, type repair, unfamiliar-repository
navigation, and code review — all measured passing, most on the first pass.

## What requires a larger model

**On this evidence, nothing — because the one failing task fails at every size
tested.**

Behaviour-preserving refactor of a long multi-branch function fails on all four
models, including the 14B and the 16B MoE. The failure mode is now specific and
reproducible:

| model | refactor failure | output tokens |
|---|---|---|
| qwen3:8b | INVALID_PATCH — anchor not found | 932 |
| qwen2.5-coder:7b | INVALID_PATCH — anchor not found | 1,148 |
| qwen2.5-coder:14b | INVALID_PATCH — anchor not found | 933 |
| deepseek-coder-v2:lite | VALIDATION_FAILED | 1,174 |

All are well under the 3,072-token budget, so **this is no longer an
output-budget problem**. The earlier CONTEXT_INSUFFICIENT reading was the
intermittent symptom; the dominant reproducible cause is that these models
cannot reproduce an exact multi-line anchor inside a long function they are
restructuring.

That matters because it means scaling the model is *not* the demonstrated fix.
Going 8B → 14B bought nothing on this task.

## Is CPU offload acceptable?

Functional, but expensive and risky:

- `qwen3:8b` fits in VRAM (7.15 GB) → 13.9 tok/s, 79% RAM in use.
- `qwen2.5-coder:14b` spills → 5.1 tok/s (**2.7× slower**), **98% RAM in use**.
- `deepseek-coder-v2:lite` spills → 7.2 tok/s, **98% RAM in use**.

Both spilled models leave under 1 GB of RAM headroom on a 32 GB machine.
Acceptable for a supervised batch run; **not acceptable as a default**, because
a coding task competing with the rest of the desktop at 98% RAM is how the
machine becomes unusable.

RAM figures are system-wide usage sampled at the end of each run, not a
sustained peak — they show the pressure the model creates, not its own resident
size.

## Is a hardware upgrade justified?

**Not on the strength of the failing task.** The 14B already tests the
"next size up" hypothesis and does not fix the refactor gap.

An upgrade to 16 GB+ VRAM would deliver:

- the 14B fully resident, removing the 2.7× latency penalty and the 98% RAM pressure
- headroom for two resident models, removing the serialisation constraint
- the ability to test 30B-class models, currently untestable here

None of that is *proven* to fix refactor. The honest position: an upgrade is
justified for **throughput and stability**, and would let the refactor question
be answered at 30B — but buying hardware expecting it to fix refactor would be
speculation this audit does not support.

## Cheaper alternatives to try before hardware

The measured failure is anchor reproduction inside a long function, not
reasoning about the refactor itself. That points at engine work rather than
model capacity:

1. **AST-level edit operations** for refactors — extract-function and
   move-statement performed deterministically from a model-selected operation
   plus parameters, so the model never has to reproduce a long anchor. This was
   specified in Phase 4.6 §5 and never implemented; the Phase 4.6 attempt
   changed prompts instead and was reverted.
2. **Line-range anchors** for large blocks, validated against a content hash
   rather than exact text.

Both are engine changes with a measurable hypothesis, and both are far cheaper
than new hardware.

## Evidence

- `.phase4/evidence/audit-4.7/benchmark-results.json`
- `.phase4/evidence/audit-4.7/review-benchmark.json`
