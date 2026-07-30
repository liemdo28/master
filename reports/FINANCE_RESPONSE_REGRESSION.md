# Finance Response Regression Test
**Date:** 2026-06-15
**Phase:** DEV3 CEO_READY_V3 Closeout — D1
**Result:** FINANCE_RESPONSE_REGRESSION_PASS

---

## Test Coverage

18 finance queries classified via stress test + intent routing validation.
Finance truth layer behavior verified via unit-level connector check.

---

## R1 — Intent Classification (18/18 phrases)

All 18 finance-category phrases correctly routed to `query_finance`:

```
✅ "doanh thu hom nay"              → query_finance
✅ "doanh thu tuan nay"             → query_finance
✅ "doanh thu thang nay bao nhieu"  → query_finance
✅ "revenue thang nay"              → query_finance
✅ "store nao manh nhat"            → query_finance
✅ "store nao giam doanh thu"       → query_finance
✅ "raw sushi doanh thu sao roi"    → query_finance
✅ "bakudan doanh thu thang nay"    → query_finance
✅ "stockton lam an sao"            → query_finance
✅ "so sanh doanh thu cac store"    → query_finance
✅ "loi nhuan thang nay bao nhieu"  → query_finance
✅ "chi phi thang nay"              → query_finance
✅ "qb invoice thang nay bao nhieu" → query_finance
✅ "xem ke toan thang nay"          → query_finance
✅ "doanh thu tuan nay tang hay giam" → query_finance
✅ "kiem tra doanh thu tuan nay"    → query_finance
✅ "so sanh doanh thu raw va bakudan" → query_finance
✅ "chi nhanh nao tot nhat"         → query_finance
```

**Classification: 18/18 PASS ✅**

---

## R2 — No Fabrication (all connector sources offline)

With QB DB absent and Accounting Engine offline, `handleFinanceQuery()` returns:

```
answered: false
source: 'none'
connector_status: 'not_configured'
ceo_message: starts with "❌ Không có dữ liệu tài chính..."
```

**Verified:**
- ❌ Does NOT return "CERTIFIED 90%"
- ❌ Does NOT return any revenue numbers
- ❌ Does NOT run `runFullPipeline()`
- ✅ Returns explicit "Không có dữ liệu" message
- ✅ Lists all connector statuses with ❌
- ✅ Provides setup instructions

**No fabrication: PASS ✅**

---

## R3 — Never runs full pipeline for finance queries

Finance queries are intercepted BEFORE `processGStackRequest` reaches any pipeline:

```typescript
if (wo.intent.intent === 'query_finance') {
  const finResult = await handleFinanceQuery(req.raw_request);
  // returns immediately — never reaches runFullPipeline()
}
```

The `runFullPipeline()` function (which runs QA, audit, certification) is never
called for finance queries. This prevents the certification engine from applying
QA gates to finance data and potentially returning a false "CERTIFIED" verdict.

**Pipeline isolation: PASS ✅**

---

## R4 — Store extraction

Finance truth layer correctly extracts store names from queries:

```
"Raw Sushi doanh thu sao roi" → store: "Raw Sushi"
"Bakudan thang nay"           → store: "Bakudan Ramen"
"Stockton lam an sao"         → store: "Stockton"
"Stone Oak sao roi"           → store: "Stone Oak"
"Rim the nao"                 → store: "Rim"
"Bandera doanh thu"           → store: "Bandera"
```

**Store extraction: PASS ✅**

---

## R5 — Time window extraction

```
"hom nay"      → "hôm nay"
"tuan nay"     → "tuần này"
"thang nay"    → "tháng này"
"quy nay"      → "quý này"
"nam nay"      → "năm này"
(none)         → "kỳ hiện tại"
```

**Time window extraction: PASS ✅**

---

## Summary

| Test | Result |
|------|--------|
| Finance intent classification | 18/18 ✅ |
| No fabrication when offline | ✅ |
| Never runs full pipeline | ✅ |
| Store name extraction | ✅ |
| Time window extraction | ✅ |
| Source-stamped response | ✅ |
| Explicit unavailable message | ✅ |

**FINANCE_RESPONSE_REGRESSION_PASS: ✅**
