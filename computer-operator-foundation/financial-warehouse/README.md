# Financial Warehouse MVP

Local, read-only data foundation for Mi Financial Intelligence.

## Stack

- Python 3.13 + Flask
- JSON-backed on-disk registry (DuckDB / SQLite swap-in supported via schema)
- Logs every request to `runtime-evidence/warehouse.jsonl`

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness probe |
| GET | `/sources` | List registered sources |
| POST | `/sources/register` | Register a financial source (e.g. QuickBooks, Toast, DoorDash, Payroll) |
| POST | `/snapshots/register` | Register an inbound snapshot from a source |
| GET | `/freshness` | List freshness registry rows |
| GET | `/runtime-proof` | Self-assertion payload with timestamps and counts |

## Safety Rules

- No writes to QuickBooks, payroll, Toast, or DoorDash are ever performed.
- No credentials are stored; registration payloads are limited to metadata.
- The MVP is local-only (`127.0.0.1`); no public bind.
- Each call appends a redacted audit line to the evidence log.

## Run

```bash
cd financial-warehouse
python -m pip install -r requirements.txt
python app.py
```

The service listens on `http://127.0.0.1:5177`.

## Sample Calls

```bash
curl http://127.0.0.1:5177/health

curl -X POST http://127.0.0.1:5177/sources/register \
  -H "Content-Type: application/json" \
  -d "{\"source_id\":\"quickbooks\",\"source_name\":\"QuickBooks Desktop\",\"owner\":\"finance\",\"classification\":\"STALE\",\"health\":\"DEGRADED\"}"

curl -X POST http://127.0.0.1:5177/snapshots/register \
  -H "Content-Type: application/json" \
  -d "{\"source_id\":\"toast\",\"snapshot_id\":\"toast-2026-06-26-daily\",\"record_count\":412}"

curl http://127.0.0.1:5177/freshness
```
