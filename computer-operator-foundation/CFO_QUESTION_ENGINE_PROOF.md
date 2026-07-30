# CFO_QUESTION_ENGINE_PROOF

Status: **OPERATIONAL**
Date: 2026-06-26
Scope: Phase 3B — CFO Question Engine proof.

## Summary

The CFO Question Engine routes CFO questions to the appropriate underlying
engine and returns evidence-based answers with confidence, sources, and
freshness. It follows the CTO Rule: **never invent answers — if data is
missing, return BLOCKED**.

## Required Output Format

```json
{
  "answer": "...",
  "confidence": 78,
  "sources": ["..."],
  "freshness": "STALE"
}
```

## Questions Supported

| ID | Vietnamese | Status |
|---|---|---|
| `revenue_today` | Revenue hôm nay bao nhiêu? | BLOCKED (no POS data) |
| `revenue_this_week` | Revenue tuần này tăng hay giảm? | BLOCKED (no daily revenue) |
| `best_store` | Store nào lời nhất? | ANSWERABLE (data-readiness) |
| `stale_sources` | Nguồn tài chính nào đang stale? | ANSWERABLE |
| `financial_risks` | Rủi ro tài chính hiện tại? | ANSWERABLE |
| `weekly_summary` | Tuần này cần chú ý tài chính gì? | ANSWERABLE (synthesizes 3 above) |

## Live Run Output

```text
[5/5] Running CFO Question Engine...
    [OK] Questions: 6 total, 4 answerable, 2 blocked
       overall_confidence: 27
```

## Sample Answers (Live)

### `revenue_today`

```json
{
  "question": "Revenue hôm nay bao nhiêu?",
  "answer": "BLOCKED — Không có dữ liệu revenue. Toast, DoorDash, QuickBooks chưa kết nối với dữ liệu POS thực tế.",
  "confidence": 0,
  "sources": ["warehouse_freshness_registry", "warehouse_sources"],
  "freshness": "PARTIAL",
  "blocked": true,
  "blocked_reason": "No POS data ingested. All revenue sources returning MISSING or simulated data."
}
```

### `best_store`

```json
{
  "question": "Store nào lời nhất?",
  "answer": "Top store (by data readiness): Bakudan The Rim (score: 23/100). NOTE: This reflects data infrastructure readiness, NOT actual financial performance.",
  "confidence": 23,
  "sources": ["warehouse_freshness", "warehouse_sources"],
  "freshness": "LIVE"
}
```

### `financial_risks`

```json
{
  "question": "Rủi ro tài chính hiện tại?",
  "answer": "5 rủi ro: [P1] TOAST_MISSING: ...; [P1] DOORDASH_MISSING: ...; [P1] PAYROLL_MISSING: ...",
  "confidence": 75,
  "sources": ["warehouse_freshness", "warehouse_sources", "warehouse_health"],
  "freshness": "LIVE"
}
```

## Question Router

```python
QUESTION_MAP = {
    "revenue_today": answer_revenue_today,
    "revenue_this_week": answer_revenue_this_week,
    "best_store": answer_best_store,
    "stale_sources": answer_stale_sources,
    "financial_risks": answer_financial_risks,
    "weekly_summary": answer_weekly_summary,
}
```

## Confidence Model

- Non-blocked question: confidence equals aggregate warehouse health score
- BLOCKED question: confidence = 0
- Weekly summary: confidence = min(risk, stale) confidence

## Files

| File | Purpose |
|---|---|
| `financial_intelligence/cfo_question_engine.py` | Engine implementation |
| `financial_intelligence/dashboard_api.py` | `GET /api/finance/questions[/<id>]` |

## CTO Rule Compliance

- BLOCKED returned for missing data (never invented).
- Confidence sourced from real warehouse state.
- Sources field always populated with real warehouse endpoints.

## Status: PASS
