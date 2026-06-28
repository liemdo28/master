# DATA_INGESTION_REPORT
**Generated:** 2026-06-09

## Ingestion Pipeline

```
filePath
    ↓
FileDataIngestionService.ingestFile()
    ↓
Extension check → Route to parser
    ├── .csv/.txt → CSVReader.readCSVFile()
    ├── .xlsx/.xls → ExcelReader.readExcelFile()
    ├── .json → readJSONFile()
    ├── .pdf → PDFTextExtractor + parseTextAsCSV
    └── .docx → WordTextExtractor + parseTextAsCSV
    ↓
ColumnMapper.mapColumns(headers) → mapping + confidence
    ↓
DataQualityChecker.checkDataQuality(rows, mapping) → quality score
    ↓
Auto-detect: store (from filename), period (from filename/data)
    ↓
DatasetCatalog.addDataset() → persist to catalog
    ↓
Return: { success, dataset_id, rows, headers, mapping, confidence, quality }
```

## Security Check (before ANY ingestion)
```
isFileSensitive(filePath) checks:
  .env, private_key, id_rsa, credentials.json, google-tokens, .pem, secret
→ BLOCKED: "Security: file nhạy cảm, không thể phân tích"
```

## CSV Parser Details

- Auto-detects delimiter: comma, tab, semicolon, pipe
- Handles quoted fields with embedded commas
- Handles escaped quotes ("")
- UTF-8 encoding
- Tracks per-row column count mismatches
- Returns: headers, rows (array of objects), row_count, errors

## Excel Reader Details

- Uses `xlsx` npm package
- Reads all sheets, defaults to first sheet
- Converts Excel date serial numbers to ISO string
- Auto-trims all values
- Skips completely empty rows

## Sample Test File

**Location:** `server/data/sample_sales_raw.csv`
**Content:** Raw Sushi Bar sales data 2026-06-02 to 2026-06-08
**Rows:** 71 transactions
**Columns:** Date, Time, Order ID, Item Name, Category, Quantity, Gross Sales, Discount, Tax, Tips, Payment Type

## Live Ingestion Test (sample_sales_raw.csv)

```
Input:  server/data/sample_sales_raw.csv
Result:
  success: true
  row_count: 71
  headers: 11
  mapping confidence: 100%
  detected fields: date, time, order_id, item_name, category,
                   quantity, gross_sales, discount, tax, tips, payment_type
  quality_score: 100/100
  is_analyzable: true
✅ PASS
```

## Error Handling

| Scenario | Behavior |
|---|---|
| File not found | `{ success: false, error: "File not found: ..." }` |
| Sensitive file | `{ success: false, error: "Security: file nhạy cảm" }` |
| Unsupported format | `{ success: false, status: "PARSER_NOT_AVAILABLE" }` |
| Empty file | `{ success: false, error: "no data rows" }` |
| Low quality | `{ success: false, error: "quality too low (score: X/100)" }` |
| JSON not array | `{ success: false, error: "not an array of records" }` |

---
DATA_INGESTION_COMPLETE
