# Phase 3 — Mi Action Layer

**Status:** COMPLETE  
**Date:** 2026-06-11

## Deliverables

| File | Purpose |
|------|---------|
| `server/src/actions/action-router.ts` | Risk-level gating (L1=auto, L2=approval, L3=double approval) |
| `server/src/actions/gmail-action-adapter.ts` | search, read, draft, send (L3) |
| `server/src/actions/drive-action-adapter.ts` | search, read, upload (L2) |
| `server/src/actions/local-file-agent.ts` | Search + read local files (allowlisted roots only, 500KB cap) |
| `server/src/actions/excel-worker.ts` | Create multi-sheet Excel with auto column widths |
| `server/src/actions/word-worker.ts` | Create Word docs via python-docx subprocess |
| `server/src/actions/pdf-worker.ts` | Extract PDF text; convert to PDF via LibreOffice |
| `server/src/actions/file-packager.ts` | Package files to ZIP with manifest |
| `server/src/routes/actions.ts` | All endpoints under /api/actions/ |

## Risk Levels
- L1 (read): auto-execute — gmail_search, drive_search, file_search, file_read, pdf_extract
- L2 (write): single approval — drive_upload, excel_create, word_create, file_package
- L3 (dangerous): double approval — gmail_send, deploy_*, db_*, delete_*

## Security
- Google tokens read from local file only; never sent externally
- Sensitive files blocked: .env, private_key, id_rsa, credentials.json, google-tokens.json, .pem
- Allowlisted folder roots only for local file access
