# H4 — Chat Reliability Stress Report
**Generated:** 2026-06-15 04:14:24
**Verdict:** CHAT_STABILITY_STRESS_FAIL

## Results

| Batch | Count | Pass | Crashes | Unavail | Dumps | Timeouts | Avg Lat | p95 | ✅ |
|-------|-------|------|---------|---------|-------|----------|---------|-----|---|
| Batch 100 | 100 | 43 (100%) | 57 | 0 | 0 | 29 | 1497ms | 10315ms | ❌ |
| Batch 250 | 250 | 112 (100%) | 138 | 0 | 0 | 29 | 1109ms | 11094ms | ❌ |
| Batch 500 | 500 | 0 (100%) | 500 | 0 | 0 | 1 | 0ms | 0ms | ❌ |

## Acceptance Criteria

| Criterion | Result |
|-----------|--------|
| 0 crashes (no HTTP errors) | ❌ FAIL |
| 0 English unavailable | ✅ PASS |
| 0 graph dumps | ✅ PASS |
| ≥95% pass rate all batches | ❌ FAIL |
| p95 latency recorded | ✅ 0ms (500-batch) |

## Failed Cases (sample)

- [Batch 100] "Chào mi" → This operation was aborted (15002ms)
- [Batch 100] "Em ơi" → This operation was aborted (15014ms)
- [Batch 100] "Alo mi" → This operation was aborted (15003ms)
- [Batch 100] "Dashboard hôm nay có gì?" → This operation was aborted (15001ms)
- [Batch 100] "Cần duyệt gì không?" → HTTP 500 (1663ms)
- [Batch 250] "Mi ơi" → HTTP 500 (190ms)
- [Batch 250] "Chào mi" → HTTP 500 (265ms)
- [Batch 250] "Em ơi" → HTTP 500 (205ms)
- [Batch 250] "Alo mi" → HTTP 500 (288ms)
- [Batch 250] "Cần duyệt gì không?" → HTTP 500 (272ms)
- [Batch 500] "Mi ơi" → This operation was aborted (15009ms)
- [Batch 500] "Chào mi" → fetch failed (642ms)
- [Batch 500] "Em ơi" → fetch failed (3ms)
- [Batch 500] "Alo mi" → fetch failed (1ms)
- [Batch 500] "Dashboard hôm nay có gì?" → fetch failed (2ms)
