# Google Sheet Link Audit

Date: 2026-06-05

## Stored Values Found

Before fix:

- `TEMPLATE_SHEET_URL`: invalid Google placeholder value
- `LOG_SHEET_URL`: invalid Google placeholder value

Both were invalid placeholders.

After fix:

- Template: `https://docs.google.com/spreadsheets/d/12J9CRkTpDJ4boKClVaz0qiev9KV7dEyr-TK4KA1ugJs/edit`
- Daily log: `https://docs.google.com/spreadsheets/d/1x_AhaoZhYgBX2zWOx6z78B9Fi8mcbaw4jZUq_PhSlnE/edit`

## Validation Added

Backend rejects URLs containing:

- `docs.google.com/test`
- `drive.google.com/log`
- `localhost`
- `example.com`

Backend accepts only:

`https://docs.google.com/spreadsheets/d/{ID}/edit`

## Runtime Proof

`POST /api/admin/google-sheet-links/test`:

- Template access: PASS
- Template item count: 19
- Log access: PASS
- Log tab: `WhatsApp_AI_Daily_Log`

Screenshot:

`docs/screenshots/dashboard-sheet-open-success.png`
