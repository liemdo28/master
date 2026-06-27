# QuickBooks Heartbeat Certification

Generated: 2026-06-27T03:30:00Z

Certification result: `PARTIAL`

## Observed Evidence

- `qb-ops-agent` is online in PM2.
- Port `3457` is listening.
- `GET /api/visibility/quickbooks` responded.
- QuickBooks Desktop is reported open.
- Company identity is detected as `Raw Japanese Bistro and Sushi Bar`.
- Company file path is detected as `C:\QB Data\Raw Stockton\rawstockton.qbw`.

## Blocking Evidence

- API response says `certified=false`.
- Status is `needs_dev1_action`.
- No QB heartbeat has been received.
- Last successful sync is stale.
- No real QB activity log rows found.

## Certification Decision

QuickBooks is partially live because company identity and runtime are detected, but heartbeat certification fails until a fresh heartbeat and fresh activity rows are captured.
