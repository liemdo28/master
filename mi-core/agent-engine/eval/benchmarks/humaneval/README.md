# HumanEval — OpenAI HumanEval Benchmark

**Status:** ✓ Scaffolded — adapter in `eval/runner.js`, vendor script in `eval/vendor/humaneval-vendor.js`
**Owner:** ML Lead
**Due:** end of Q1 (M1)
**Dataset:** 164 Python programming problems from OpenAI

## Quick Start

```bash
# Vendor the dataset (requires network once)
npm run eval:vendor

# Run HumanEval
npm run eval:humaneval          # all 164 problems
npm run eval:quick              # 5 problems, all benchmarks
node eval/runner.js --benchmark humaneval --limit 10

# View results
npm run eval:scoreboard         # scorecard in terminal
npm run eval:scoreboard -- --html  # HTML report
```

## Data Format

The vendored `data/humaneval.json` contains an array of problems:

```json
{
  "task_id": "HumanEval/0",
  "prompt": "def truncate...",
  "entry_point": "truncate",
  "canonical_solution": "def truncate...",
  "test": "def test_truncate(): ...",
  "metadata": {}
}
```

## M1 Target

| Metric | Target | Baseline |
|--------|--------|----------|
| HumanEval pass@1 | ≥85% | unmeasured |

## References

- [OpenAI HumanEval Paper](https://arxiv.org/abs/2107.03374)
- [GitHub: openai/human-eval](https://github.com/openai/human-eval)