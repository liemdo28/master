# Connector And Tool Audit

Generated: 2026-06-16 05:40 Asia/Saigon

## Runtime Tools

- Mi-Core health endpoint: healthy.
- Python AI service: healthy.
- Ollama: healthy and listening on `127.0.0.1:11434`.
- WhatsApp gateway: online in PM2.
- Accounting engine: online in PM2.

## Connector Freshness

Evidence: `E:\Project\Master\.local-agent-global\visibility\data-freshness.json`.

- Gmail: STALE. Last sync `2026-06-14T14:03:57.278Z`.
- Calendar: fresh.
- Drive: fresh.
- Sheets: fresh.
- Asana: fresh.
- Health: fresh.
- Website `bakudanramen.com`: fresh.
- Website `rawsushibar.com`: fresh.
- QuickBooks: degraded, not certified, but cache fresh.
- Work Orders: fresh.
- Graph: fresh.
- Memory: fresh.

## QuickBooks Truth

Evidence: `E:\Project\Master\.local-agent-global\visibility\quickbooks\summary.json`.

- QB open: true.
- Company detected: true.
- Company identity matched: true.
- Last successful sync: `2026-06-14T15:04:32.890153+00:00`.
- Status: degraded.
- Certified: false.
- Action required: true.

## Verdict

No fake green: connector layer is not fully certified because Gmail is stale and QuickBooks is degraded.

