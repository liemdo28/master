# Coding Brain Benchmark

Generated: 2026-06-19
Verdict: `QWEN3_8B_BENCHMARK_WINNER`

## Models

- `qwen2.5-coder:7b` - active Engineering primary
- `qwen3:8b`
- `qwen3:14b`
- `deepseek-coder:6.7b`

## Method

Each model ran the same five tasks three times, for 60 total attempts:

1. Bug fix
2. TypeScript refactor
3. API implementation
4. Unit test generation
5. Code review

Controls:

- seeds: `16`, `17`, `18`
- temperature: `0.1`
- output cap: `900` tokens
- streaming and thinking output disabled
- one warm-up per model, excluded from latency
- strict TypeScript compilation
- hidden runtime tests
- five expected security findings for code review

Raw evidence:

- `.local-agent-global/coding-brain-benchmark/results.json`
- `.local-agent-global/coding-brain-benchmark/<model>/run-<n>/<task>/`
- `scripts/coding-brain-benchmark.mjs`

## Aggregate Results

| Model | Correctness | Avg latency | Range | Tokens | Compile | Test pass |
|---|---:|---:|---:|---:|---:|---:|
| `qwen3:8b` | **92.0%** | **4,780 ms** | 2,110-10,265 | **4,935** | **100%** | **80.0%** |
| `deepseek-coder:6.7b` | 66.7% | 6,347 ms | 2,748-13,736 | 8,519 | 58.3% | 66.7% |
| `qwen2.5-coder:7b` | 66.0% | 5,669 ms | 1,957-13,148 | 5,980 | 75.0% | 40.0% |
| `qwen3:14b` | 56.7% | 21,665 ms | 9,819-45,194 | 4,643 | 66.7% | 40.0% |

Compile rate covers the 12 code-generation attempts per model. Test pass rate
includes all 15 attempts, including code review.

## Stability By Task

| Model | Bug fix | Refactor | API | Unit tests | Review |
|---|---:|---:|---:|---:|---:|
| `qwen3:8b` | 1/3 | **3/3** | **3/3** | **3/3** | 2/3 |
| `deepseek-coder:6.7b` | **3/3** | **3/3** | 0/3 | 1/3 | **3/3** |
| `qwen2.5-coder:7b` | **3/3** | **3/3** | 0/3 | 0/3 | 0/3 |
| `qwen3:14b` | 0/3 | **3/3** | 0/3 | 0/3 | **3/3** |

## Findings

### qwen3:8b

- Only model with 100% strict compile success.
- Passed API and unit-test tasks in all three runs.
- Lowest average latency and lowest aggregate token usage.
- Weakness: inconsistent bug-fix interpretation and one incomplete review.

### qwen2.5-coder:7b

- Perfect bug-fix and refactor stability.
- API code compiled but failed integer-validation hidden tests in all runs.
- Unit tests failed compilation in all runs.
- Reviews consistently found only four of five required categories.

### deepseek-coder:6.7b

- Perfect bug-fix, refactor, and review stability.
- API implementation failed compilation in all runs.
- Unit-test generation passed only one of three runs.
- Highest token usage.

### qwen3:14b

- Strong refactor and review performance.
- Failed every API hidden test and unit-test task.
- More than four times slower than `qwen3:8b`.

## Scoring

Code generation:

- compile success: 50%
- hidden test success: 50%

Code review:

- one point for each required issue category

Correctness is averaged across all 15 attempts per model.

## Conclusion

`deepseek-coder:6.7b` does not justify promotion.

The expanded benchmark also shows that `qwen3:8b` outperformed the active
Engineering primary `qwen2.5-coder:7b` on this suite. That is a recommendation
signal, not an automatic registry authorization.

