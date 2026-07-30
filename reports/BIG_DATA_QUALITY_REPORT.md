# Mi Big Data Quality Report
**Generated:** 2026-06-11T00:49:17.329Z

## Summary
| Status | Count |
|---|---|
| ✅ Pass   | 5 |
| ⚠️ Warn   | 3 |
| ❌ Fail   | 0 |
| 💥 Error  | 0 |

## Results

### ✅ duplicate_checksum (warn)
**Status:** pass
```json
{
  "duplicate_count": 0,
  "checksums": []
}
```

### ✅ missing_store_id (warn)
**Status:** pass
```json
{
  "events_missing_store_id": 0
}
```

### ✅ invalid_event_time (warn)
**Status:** pass
```json
{
  "invalid_time_count": 0
}
```

### ⚠️ stale_source (warn)
**Status:** warn
```json
{
  "stale_sources": [
    {
      "name": "asana",
      "last_job": "never"
    },
    {
      "name": "doordash",
      "last_job": "never"
    },
    {
      "name": "gmail",
      "last_job": "never"
    },
    {
      "name": "google-drive",
      "last_job": "never"
    },
    {
      "name": "manual-upload",
      "last_job": "never"
    },
    {
      "name": "quickbooks-raw",
      "last_job": "never"
    }
  ]
}
```

### ⚠️ failed_ingestion_24h (warn)
**Status:** warn
```json
{
  "failed_jobs_24h": 5
}
```

### ✅ empty_file (warn)
**Status:** pass
```json
{
  "empty_object_count": 0
}
```

### ✅ suspicious_amount (warn)
**Status:** pass
```json
{
  "suspicious_transactions": 0,
  "examples": []
}
```

### ⚠️ missing_qb_daily_log (warn)
**Status:** warn
```json
{
  "missing_days": [
    "2026-06-11"
  ],
  "present_days": 7
}
```
