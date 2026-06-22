# Coding Brain Decision

Generated: 2026-06-19
Decision: `KEEP_REGISTRY_UNCHANGED_PENDING_QWEN3_8B_PROMOTION_APPROVAL`

## Candidate Decision

DeepSeek-Coder is not promoted.

| DeepSeek comparison | Result |
|---|---|
| vs `qwen3:8b` | Loses: 66.7% vs 92.0% correctness |
| vs current primary | Near tie: 66.7% vs 66.0%, but lower compile reliability and higher token use |
| Compile success | 58.3% |
| Test pass rate | 66.7% |

This does not satisfy the directive's evidence threshold for replacing the
existing Engineering brain with DeepSeek.

## Current Registry

```text
Primary:
qwen2.5-coder:7b

Fallback:
qwen3:14b

Fast/emergency model:
qwen3:8b
```

No Company OS registry source was changed.

## New Evidence

Three-run aggregate evidence identifies `qwen3:8b` as the suite winner:

```text
Correctness:     92.0%
Compile success: 100%
Test pass rate:  80.0%
Average latency: 4,780 ms
```

The current primary `qwen2.5-coder:7b` produced:

```text
Correctness:     66.0%
Compile success: 75.0%
Test pass rate:  40.0%
Average latency: 5,669 ms
```

## Recommendation

Do not assign `deepseek-coder:6.7b`.

Evidence supports a separate controlled promotion decision for:

```text
Primary: qwen3:8b
Fallback: qwen2.5-coder:7b
Emergency/deep review: qwen3:14b
```

That change is not applied here because Phase 16A only authorized DeepSeek
promotion when DeepSeek performed better. The measured winner was a different
model.

## Installed Candidate

`deepseek-coder:6.7b` remains installed for future specialized bug-fix or code
review experiments.

