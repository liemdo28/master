# DATA_SECURITY_REPORT
**Generated:** 2026-06-09

## Sensitive Data Classification

| Category | Examples | Policy |
|---|---|---|
| Payroll | payroll.csv, employee_wages.xlsx | Analyze locally only |
| Employee data | staff_hours, HR reports | Analyze locally only |
| Financial exports | QuickBooks export, P&L, tax | Analyze locally, no cloud upload without L3 approval |
| Health data | Huawei health export | Requires explicit consent before any analysis |
| Customer data | Customer contact lists | Local only, never uploaded |
| Credentials | .env, google-tokens, private keys | BLOCKED from all analysis |

## Security Rules Enforced

### 1. Sensitive File Block (hard block)
```javascript
const SENSITIVE_PATTERNS = [
  /\.env$/i,          // .env files
  /private[_-]?key/i, // private keys
  /id_rsa/i,          // SSH keys
  /credentials\.json$/i, // Google credentials
  /google-tokens/i,   // OAuth tokens
  /\.pem$/i,          // Certificates
  /secret/i,          // Secret files
];
```
→ `ingestFile()` rejects before parsing

### 2. External Sharing Requires Approval (L2)
- Analysis results can be viewed locally: free
- Export to CSV/PDF: L2 approval required
- Share analysis via email: L2 approval required
- Upload analysis to Drive: L2 approval required

### 3. Sensitive Data Export Requires Double Approval (L3)
- Payroll analysis export: L3 (double approval)
- Customer data export: L3 (double approval)
- Financial export share: L3 (double approval)

### 4. Cloud AI Processing Rules
- Default: analysis run locally (no data leaves machine)
- Ollama used for any AI-assisted analysis
- No data sent to cloud LLM for sensitive analysis
- Cloud LLM (if used for non-sensitive): only column headers, not actual values

### 5. Audit Trail
All data analyst operations logged to:
`.local-agent-global/data-analyst/audit.json`

Events tracked:
- `dataset_imported` — file path, timestamp, row count
- `analysis_run` — dataset_id, timestamp, type
- `report_generated` — dataset_id, format, timestamp
- `export_approved` — dataset_id, approver, format
- `file_blocked` — attempted path, block reason

## Sensitive Data Tests

```
Test: "Analyze payroll.csv"
→ ingestFile("payroll.csv") 
→ isFileSensitive("payroll.csv") → FALSE (payroll is allowed for local analysis)
→ Analysis runs locally ✅
→ Export requires approval ✅

Test: "Analyze .env file"
→ isFileSensitive(".env") → BLOCKED
→ "Security: '.env' là file nhạy cảm"
✅ PASS

Test: "Analyze google-tokens.json"
→ isFileSensitive("google-tokens.json") → BLOCKED
✅ PASS

Test: "Export payroll analysis to email"
→ L2 approval required before send
✅ PASS — never sends without approval
```

## Privacy Guarantees

- No analysis data stored on external servers
- Dataset catalog stored locally: `.local-agent-global/data-analyst/`
- Analysis results stored locally: same directory
- Google Sheets: reads via HTTPS, data not cached (fresh each analysis)
- Gmail attachments: downloaded to local temp dir, deleted after analysis

---
DATA_SECURITY_COMPLETE
