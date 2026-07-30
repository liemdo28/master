# Legacy Test Cleanup Report

Date: 2026-06-05
Status: PASS

## Why `npm test` Failed

`npm test` failed because `tests/broth-command-tests.js` still asserted the retired 11-item broth-only workflow:

- Fixed Tonkotsu/Ichiran/Cilantro-style item names
- Old numbered and CSV parser expectations
- Old `Broth_Count_Log` fixed-column sheet shape
- Old partial-entry states tied to the broth item list

The current production truth is the dynamic `Daily_Entry_Template` flow:

- Source: `Daily_Entry_Template`
- Range: `B11:D35`
- Active structure: 19 dynamic items
- Runtime behavior: item order, min/max, and no-target rows come from the sheet/template cache

## Classification

- A. Still valid under dynamic template:
  - Command interception and no generic AI fallback
  - Dynamic item rendering
  - Min/max validation
  - NA/no-target handling
  - Confirm/edit/cancel style workflow coverage
- B. Obsolete old broth-only behavior:
  - Tonkotsu/Ichiran fixed positions
  - 11 fixed item count
  - Fixed broth count sheet columns
  - Old CSV parser assertions against fixed item names
- C. Fixture-based current tests:
  - `tests/template/dynamic-template-sync-tests.js`
  - `tests/template-tests.js`
- D. Removed from default `npm test`:
  - `tests/legacy/broth-command-legacy-tests.js`

## What Changed

- Moved `tests/broth-command-tests.js` to `tests/legacy/broth-command-legacy-tests.js`.
- Added a `LEGACY_TESTS=1` guard so the obsolete suite is opt-in only.
- Updated `package.json` so default `npm test` runs current production tests only.
- Added `npm run test:legacy` for explicit legacy checks.
- Added current 19-item `B11:D35` fixture coverage to `tests/template/dynamic-template-sync-tests.js`.
- Updated `tests/template-tests.js` to use current dynamic Daily Entry items instead of old Tonkotsu or 5-item fixtures.
- Updated `src/google/log-sheet-sync.js` so `Broth_Count_Log` no longer hardcodes old broth item columns.
- Fixed `npm test` cleanup so it deletes only `gateway-test-*` files and never deletes `data/gateway.db`.

## Final Results

Commands run:

```powershell
npm test
node tests\nlp\nlp-intent-tests.js
node tests\windows\runtime-service-tests.js
node tests\live\runtime-acceptance-test.js
node tests\template\dynamic-template-sync-tests.js
node tests\pilot\run-pilot-scenarios.js
powershell -File .\pack.ps1
```

Results:

- `npm test`: PASS
- NLP intent tests: PASS 10/10
- Windows runtime service tests: PASS
- Runtime acceptance: PASS 20/20
- Dynamic template sync: PASS 33/33
- Pilot scenarios: PASS 136/136
- Package: PASS, forbidden-entry scan clean

Production-path scan:

- No Tonkotsu/Ichiran fixed production columns remain in `src`.
- No old 5-item broth fixture remains in the default template tests.

## Gate

Engineering gate is clean.
