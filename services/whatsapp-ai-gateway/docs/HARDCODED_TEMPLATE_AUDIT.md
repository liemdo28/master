# Hardcoded Template Audit

Date: 2026-06-04

## Production Findings

- `src/templates/template-cache.js` previously bootstrapped a hardcoded ramen list when SQLite was empty. This has been removed. Empty runtime state is now `source: unavailable`.
- `src/templates/template-sync-service.js` previously read fixed `B11:D91`. It now delegates to `daily-entry-template-service.js`, which scans `A1:E200` and detects the `Category | Item | Target Min | Target Max` header.
- `src/commands/broth-command.js` previously fell back to `broth-items-loader`. That fallback is removed for production command flow.
- `src/commands/broth-parser.js` previously exported hardcoded ramen defaults. The default list is now empty; callers must pass the active dynamic item list.

## Remaining Non-Production Fixtures

Some test files still contain sample item names. These are isolated fixtures and are not used by the WhatsApp runtime path.

## Runtime Rule

The bot may use:

1. Current in-memory template from the latest sync.
2. Last real SQLite `template_cache` payload.

If neither exists, the bot replies:

`Template is not available. Please contact manager or try again later.`
