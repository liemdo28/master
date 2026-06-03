# Validation Engine

Validation Engine for Agent OS - validates components without UI.

## Structure

```
validation-engine/
├── validator.js           # Core validation engine
├── validation-registry.json # Validator registry
├── runners/
│   ├── api-proxy.js      # API Proxy validator
│   ├── antigravity.js     # Antigravity IDE validator
│   ├── cline.js          # Cline validator
│   └── worker.js         # Worker service validator
├── reports/              # Generated reports
│   └── logs/             # Validation logs
└── README.md
```

## Commands

### Validate API Proxy
```bash
node validator.js api-proxy
```

### Validate Antigravity
```bash
node validator.js antigravity
```

### Validate Cline
```bash
node validator.js cline
```

### Validate Worker
```bash
node validator.js worker
```

## Output Format

```json
{
  "taskId": "API_PROXY_1234567890",
  "validator": "api-proxy",
  "status": "PASS | FAIL | UNKNOWN",
  "exitCode": 0,
  "artifacts": [
    "process:node.exe:detected",
    "port:3001:in-use",
    "health:http://localhost:3001/health:200",
    "logs:E:\\Project\\Master\\validation-engine\\reports\\logs\\api-proxy-validation.log"
  ],
  "startedAt": "2026-06-02T03:59:00.000Z",
  "endedAt": "2026-06-02T03:59:01.000Z"
}
```

## Status Rules

- **PASS**: All checks passed, artifacts captured
- **FAIL**: No artifacts captured OR validation errors
- **UNKNOWN**: Missing critical data (process, port, health)

## Validation Checks

### API Proxy
- Process detection (node.exe)
- Port detection (3001)
- Health endpoint check
- Logs captured
- Start script exists

### Antigravity
- Process detection
- Window detection
- Logs captured

### Cline
- VS Code process detection
- Cline extension check
- Logs captured

### Worker
- Process detection (node.exe)
- Port detection (3002)
- Health endpoint check
- Logs captured

## Reports

Reports are generated in `E:\Project\Master\validation-engine\reports\`:
- `{TASK_ID}.json` - JSON report
- `API_PROXY_START_TEST.md` - Markdown report for API Proxy
- `ANTIGRAVITY_START_TEST.md` - Markdown report for Antigravity
- `CLINE_START_TEST.md` - Markdown report for Cline
- `WORKER_START_TEST.md` - Markdown report for Worker
