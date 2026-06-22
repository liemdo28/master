# DATA_ANALYST_LAYER_REPORT
**Generated:** 2026-06-09
**Directive:** CEO — BUILD MI DATA ANALYST LAYER

## Status: ✅ MI_DATA_ANALYST_READY

## Architecture: `local-agent/data-analyst/`

| Module | Purpose | Status |
|---|---|---|
| `DataAnalystEngine.mjs` | Main entry point, Q&A, report generation | ✅ |
| `FileDataIngestionService.mjs` | Orchestrates file ingestion pipeline | ✅ |
| `CSVReader.mjs` | Pure-JS CSV parser (no dependencies) | ✅ |
| `ExcelReader.mjs` | XLSX/XLS via xlsx npm package | ✅ |
| `PDFTextExtractor.mjs` | PDF text via pdf-parse (optional) | ✅ |
| `WordTextExtractor.mjs` | DOCX via mammoth npm package | ✅ |
| `GoogleSheetReader.mjs` | Google Sheets via CSV export URL | ✅ |
| `GmailAttachmentReader.mjs` | Gmail attachment discovery | ✅ |
| `GoogleDriveFileReader.mjs` | Drive data file search | ✅ |
| `ColumnMapper.mjs` | Auto-detect + map column names | ✅ |
| `DataQualityChecker.mjs` | Validate data before analysis | ✅ |
| `SalesAnalyticsEngine.mjs` | All core analytics calculations | ✅ |
| `OpportunityEngine.mjs` | Revenue opportunities + recommendations | ✅ |
| `DatasetCatalog.mjs` | Dataset registry + persistence | ✅ |
| `index.mjs` | Exports all modules | ✅ |

### TypeScript Integration
| File | Purpose |
|---|---|
| `server/src/actions/data-analyst-handler.ts` | Chat pipeline integration |
| `server/src/routes/data-analyst.ts` | REST API endpoints |

### API Endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/data-analyst/datasets` | GET | List all imported datasets |
| `/api/data-analyst/last` | GET | Get last analysis results |
| `/api/data-analyst/analyze` | POST | Analyze a file |
| `/api/data-analyst/question` | POST | Ask question about data |
| `/api/data-analyst/report` | POST | Generate formatted report |

## Data Storage: `.local-agent-global/data-analyst/`

```
.local-agent-global/data-analyst/
  dataset_catalog.json      ← all imported datasets
  last_analysis.json        ← most recent analysis result
  datasets/
    {dataset_id}_analysis.json  ← full analytics per dataset
```

## Supported File Types

| Type | Library | Status |
|---|---|---|
| CSV | Pure JS (built-in) | ✅ No deps needed |
| TSV/pipe-delimited | Auto-detect delimiter | ✅ |
| XLSX | xlsx npm package | ✅ Installed |
| XLS | xlsx npm package | ✅ Installed |
| JSON (array) | Built-in | ✅ |
| TXT (CSV-like) | Pure JS | ✅ |
| DOCX | mammoth npm | ✅ Installed |
| PDF | pdf-parse (optional) | ⏳ Run `npm install pdf-parse` |
| Google Sheet | HTTP CSV export | ✅ (public sheets) |
| Gmail attachment | Via Gmail cache | ✅ (requires OAuth) |
| Drive file | Via Drive cache | ✅ (requires OAuth) |

## Column Detection: 17 Standard Fields

```
date, time, hour, weekday, store, order_id, item_name,
category, quantity, gross_sales, net_sales, discount, tax,
tips, payment_type, customer_count, ticket_total
```

**Multi-language aliases:**
- Vietnamese: "ngày", "giờ", "món ăn", "doanh thu", "số lượng"
- English: all standard POS system headers
- Toast POS: "Business Date", "Item Name", "Gross Sales"
- QuickBooks: "Date", "Product/Service", "Amount"

**Confidence scoring:**
- 100%: date + item_name + gross_sales all detected
- 60-99%: partial mapping (analyzed with warning)
- <60%: analysis blocked, ask CEO to confirm mapping

---
DATA_ANALYST_LAYER_COMPLETE
