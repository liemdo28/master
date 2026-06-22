# COLUMN_MAPPING_VALIDATION
**Generated:** 2026-06-09

## Live Mapping Test — sample_sales_raw.csv

```
Input headers: Date, Time, Order ID, Item Name, Category, Quantity,
               Gross Sales, Discount, Tax, Tips, Payment Type

Mapping result:
  date        → "Date"
  time        → "Time"
  order_id    → "Order ID"
  item_name   → "Item Name"
  category    → "Category"
  quantity    → "Quantity"
  gross_sales → "Gross Sales"
  discount    → "Discount"
  tax         → "Tax"
  tips        → "Tips"
  payment_type → "Payment Type"

Confidence: 100%
Unmapped: (none)
✅ PASS
```

## Multi-Language Alias Tests

| Input Header | Detected Field | Result |
|---|---|---|
| "Ngày" | date | ✅ |
| "Doanh thu" | gross_sales | ✅ |
| "Số lượng" | quantity | ✅ |
| "Món ăn" | item_name | ✅ |
| "Business Date" | date | ✅ |
| "Gross Sales" | gross_sales | ✅ |
| "Item Name" | item_name | ✅ |
| "Revenue" | gross_sales | ✅ |
| "Amount" | gross_sales | ✅ |
| "Qty" | quantity | ✅ |
| "Payment Method" | payment_type | ✅ |
| "Order Number" | order_id | ✅ |

## Date Format Normalization

| Input | Normalized | Result |
|---|---|---|
| "2026-06-09" | "2026-06-09" | ✅ |
| "06/09/2026" | "2026-06-09" | ✅ |
| "9/6/2026" | "2026-06-09" | ✅ |
| "2026/06/09" | "2026-06-09" | ✅ |

## Number Normalization

| Input | Parsed Value | Result |
|---|---|---|
| "$28.00" | 28.00 | ✅ |
| "1,234.56" | 1234.56 | ✅ |
| "28" | 28 | ✅ |
| "" | 0 | ✅ |
| "N/A" | 0 | ✅ |

## Low Confidence Behavior

When confidence < 80%:
```
Mi: "Chỉ tìm thấy một số cột. Anh có thể xác nhận mapping không?
  Detected: date → 'Ngày', gross_sales → ???
  Unmapped: 'SalesTotal', 'Qty'
  [Confirm Mapping] [Skip Analysis]"
```

---
COLUMN_MAPPING_VALIDATION_COMPLETE
