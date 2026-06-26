# Phase 0.7 Live API Proof

Generated: 2026-06-26
Runtime: PM2 `mi-core`, port `4001`
Final allowed status: READY

## Live Health

Command:

```powershell
curl.exe --silent --show-error --max-time 10 http://127.0.0.1:4001/api/health
```

Result:

```json
{"server":"ok","python_ai_service":"ok","ollama":"ok"}
```

## Live Workflow Status

Command:

```powershell
curl.exe --silent --show-error --max-time 10 http://127.0.0.1:4001/api/workflows/status
```

Result:

- `ok: true`
- `final_status: READY`
- `machine_registered_workflows: 22`
- `documented_workflows: 15`
- `imported_documented_workflows: 15`
- `missing_documented_workflows: []`
- `blockers: []`

## Live Workflow Log + Duplicate Proof

Payload:

```json
{
  "workflow_id": "phase07-live-proof",
  "project": "SEO",
  "entity": "Bakudan",
  "action": "Daily Audit",
  "time_window": "2026-06-26-live-node",
  "risk": "READ_ONLY",
  "status": "SUCCESS"
}
```

First POST `/api/workflows/log`:

- HTTP `200`
- `ok: true`
- `duplicate: false`
- `dedup.status: REGISTERED`
- ledger status: `completed`

Second POST `/api/workflows/log` with same payload:

- HTTP `200`
- `ok: true`
- `duplicate: true`
- `dedup.status: SKIP_DUPLICATE`

Evidence paths:

- `D:\Project\Master\mi-core\.mi-harness\workflow-fabric\evidence\phase07-live-proof-1782481737101.json`
- `D:\Project\Master\mi-core\.mi-harness\workflow-fabric\evidence\phase07-live-proof-1782481737138.json`
