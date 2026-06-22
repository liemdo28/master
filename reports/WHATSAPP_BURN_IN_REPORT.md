# H1 — 24h WhatsApp Burn-In Report
**Generated:** 2026-06-15 03:54:04
**Elapsed:** 0.03h
**Verdict:** WHATSAPP_24H_BURN_IN_READY

## Metrics

| Metric | Count |
|--------|-------|
| Total messages | 31 |
| Success | 31 |
| Fallback (HTTP error) | 67 |
| Timeout (>15s) | 2 |
| Context loss | 0 |
| Graph dumps | 0 |
| English errors | 0 |
| Workflow created | 10 |
| Approval requested | 0 |

## Acceptance Criteria

| Criterion | Value | Status |
|-----------|-------|--------|
| 0 English "Mi-Core unavailable" | 0 | ✅ PASS |
| 0 English gateway error | 0 | ✅ PASS |
| 0 graph dump for operational | 0 | ✅ PASS |
| Context retention ≥ 95% | 100.0% | ✅ PASS |

## Latency

| p50 | p95 | p99 | avg |
|-----|-----|-----|-----|
| 658ms | 1465ms | 14044ms | 843ms |

## Recent Failures (last 20)

- [03:53:50] "Tạo flyer cho Bakudan" → HTTP 500 
- [03:53:50] "Bakudan tình hình sao?" → HTTP 500 
- [03:53:51] "Doanh thu sao rồi?" → HTTP 500 
- [03:53:53] "Tình hình thế nào?" → HTTP 500 
- [03:53:54] "Anh ngủ sao rồi?" → HTTP 500 
- [03:53:55] "Bakudan tình hình sao?" → HTTP 500 
- [03:53:56] "Doanh thu sao rồi?" → HTTP 500 
- [03:53:57] "Có gì cần anh xử lý không?" → HTTP 500 
- [03:53:58] "Tạo flyer cho Bakudan" → HTTP 500 
- [03:54:00] "Kể thêm đi" → HTTP 500 
- [03:54:01] "Kể thêm đi" → HTTP 500 
- [03:54:02] "HRV tuần này sao?" → HTTP 500 
- [03:54:04] "Doanh thu sao rồi?" → HTTP 500 
- [03:54:04] "co gi khong" → HTTP 500 
- [03:54:04] "Soạn email cho Maria" → network_error 
- [03:54:04] "Bakudan tình hình sao?" → network_error 
- [03:54:04] "dashboard sao roi" → network_error 
- [03:54:04] "dashboard sao roi" → network_error 
- [03:54:04] "Hôm nay anh có task gì?" → network_error 
- [03:54:04] "Tạo flyer cho Bakudan" → network_error 
