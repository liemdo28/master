# Store Mapping Audit

Audit date: 2026-06-04

## Result

Status: BLOCKED FOR PILOT

The store mapping module works, including locked mapped-group detection, but the production mappings for all three stores are not present in the local SQLite state.

## Requirements Checked

- Stone Oak mapping exists: PARTIAL
- Bandera mapping exists: FAIL
- Rim mapping exists: FAIL
- Mapping is locked: PARTIAL
- Mapping persists restart: PASS for SQLite-backed mappings
- Staff cannot override store in mapped group: PASS by design

## Evidence

SQLite `store_groups` contained:

- `audit-stone-oak@g.us` -> `stone_oak`, locked `1`
- `stone@g.us` -> `stone_oak`, locked `0`
- `test_group_1780542846663@g.us` -> `stone_oak`, locked `0`

No active `bandera` or `rim` mapping was found.

Mapped-group smoke test:

- Created locked mapping `audit-stone-oak@g.us` -> Stone Oak.
- Called `/ldagent`.
- Result: handled, not blocked, menu shown, session store `Stone Oak`, state `MENU`.

## Code Fix Applied

`src/stores/store-registry.js` now exports:

- `markLastMessage`
- `markLastLogWrite`

These are required by `/ldagent` and Daily Entry finalization.

## Pilot Blocker

Create and lock real WhatsApp group mappings:

- Stone Oak Group -> Stone Oak
- Bandera Group -> Bandera
- Rim Group -> Rim

Then rerun `/ldagent` from each real group.
