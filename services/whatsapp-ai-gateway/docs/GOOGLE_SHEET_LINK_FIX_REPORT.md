# Google Sheet Link Fix Report

Date: 2026-06-05

## Fixed

Invalid stored values were replaced:

- `TEMPLATE_SHEET_URL`: `https://docs.google.com/spreadsheets/d/12J9CRkTpDJ4boKClVaz0qiev9KV7dEyr-TK4KA1ugJs/edit`
- `LOG_SHEET_URL`: `https://docs.google.com/spreadsheets/d/1x_AhaoZhYgBX2zWOx6z78B9Fi8mcbaw4jZUq_PhSlnE/edit`

Backend validation rejects:

- `docs.google.com/test`
- `drive.google.com/log`
- `localhost`
- `example.com`
- empty strings on save
- any URL without `/spreadsheets/d/`

## Runtime Proof

`POST /api/admin/google-sheet-links/test`:

- Template access: PASS
- Template item count: 19
- Log access: PASS

Screenshots:

- `docs/screenshots/dashboard-sheet-open-success.png`
- `docs/screenshots/dashboard-template-open-success.png`
- `docs/screenshots/dashboard-log-open-success.png`
