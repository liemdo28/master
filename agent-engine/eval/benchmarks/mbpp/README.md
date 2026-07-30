# MBPP — Mostly Basic Python Problems

**Status:** ✓ Scaffolded — adapter in `eval/runner.js`, vendor script in `eval/vendor/mbpp-vendor.js`
**Owner:** ML Lead
**Due:** end of Q1 (M1)
**Dataset:** 974 Python programming problems (sanitized)

## Quick Start

```bash
npm run eval:vendor
npm run eval:mbpp
npm run eval:quick
node eval/runner.js --benchmark mbpp --limit 10
npm run eval:scoreboard -- --html
```

## M1 Target

| Metric | Target | Baseline |
|--------|--------|----------|
| MBPP pass@1 | ≥80% | unmeasured |