# Template Sync Audit

Date: 2026-06-04

## Source Of Truth

`Daily_Entry_Template` is the source of truth for:

- category
- item name
- target min
- target max
- row order
- active state when an `Active` column exists

## Service

Implemented: `src/templates/daily-entry-template-service.js`

Public functions:

- `syncFromGoogleSheet()`
- `getCurrentTemplate()`
- `getTemplateItems()`
- `getTemplateVersion()`
- `validateTemplate()`
- `getItemByIndex(index)`
- `getItemByName(name)`
- `formatRange(item)`

## Cache

SQLite table: `template_cache`

Stores full JSON payload, template version, source, item count, and last sync time.

`template_items` remains as a compatibility table for existing validator/dashboard code, populated only after a successful dynamic template save.

## API

- `POST /api/admin/google-sheets/sync-template`
- `GET /api/template/current`
- `POST /api/template/sync`
- `GET /api/template/validate`

Legacy dashboard endpoint `POST /api/admin/google-sheet-links/sync-template` continues to call the same sync service.
