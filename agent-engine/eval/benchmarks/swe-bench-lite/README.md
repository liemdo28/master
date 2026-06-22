# SWE-bench-Lite — Software Engineering Benchmark

**Status:** ✓ Scaffolded — adapter in `eval/runner.js`
**Owner:** ML Lead
**Due:** end of Q1 (M1)
**Dataset:** 300 real-world GitHub issues from popular OSS projects

## Quick Start

```bash
# SWE-bench requires the full repo + test environment
# See eval/benchmarks/swe-bench-lite/setup.md for environment setup
node eval/runner.js --benchmark swe-bench-lite --limit 10
npm run eval:scoreboard -- --html
```

## M1 Target

| Metric | Target | Baseline |
|--------|--------|----------|
| SWE-bench-Lite resolve | ≥35% | unmeasured |