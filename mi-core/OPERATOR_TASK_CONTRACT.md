# OPERATOR TASK CONTRACT

## Input Contract

```json
{
  "task_id": "OPS-0001",
  "objective_id": "OBJ-0001",
  "mode": "READ_ONLY",
  "adapter": "playwright",
  "target": {
    "type": "web",
    "url": "https://example.com"
  },
  "actions": [
    { "type": "navigate", "url": "https://example.com" },
    { "type": "read_title" },
    { "type": "screenshot" }
  ],
  "evidence_required": true
}
```

## Supported Modes

- `READ_ONLY`
- `SAFE_WRITE_TEST_ONLY`

Blocked for MVP:

- `PRODUCTION_WRITE`
- `FINANCIAL_ACTION`
- `SECURITY_ACTION`
- `CREDENTIAL_ACTION`

## Supported Actions

- `navigate`
- `read_title`
- `read_text`
- `click`
- `fill`
- `screenshot`
- `download`
- `upload_test_file`
- `wait`
- `extract_links`

## Output Contract

```json
{
  "ok": true,
  "task_id": "OPS-0001",
  "status": "DONE",
  "result": {
    "title": "Example Domain"
  },
  "evidence": [
    "screenshots/OPS-0001-home.png",
    "logs/OPS-0001.json"
  ]
}
```

## Runtime Notes

- Coordination status is attached in the `coordination` field.
- Evidence paths are stored in the local operator runtime evidence store.
- If Playwright is unavailable, tasks fail safely and still emit evidence.