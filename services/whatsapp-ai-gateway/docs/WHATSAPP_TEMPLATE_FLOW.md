# WhatsApp Template Flow

Date: 2026-06-04

## Daily Entry Flow

`/ldagent` -> `Daily Entry Log` now loads active items from `daily-entry-template-service`.

If the template is unavailable, the flow stops with:

`Template is not available. Please contact manager or try again later.`

## Prompt Format

Each item prompt includes:

- store
- item number and total count
- category
- item name
- target range

Example:

```text
Daily Entry Log - Rim
Item 1 of 19
Category: Cold Holding

Walk-in Cooler

Target: 30F - 45F

Reply with temperature:
```

## Out Of Range

Out-of-range input now asks:

```text
Outside Target Range

Walk-in Cooler
Entered: 50°F
Target: 30F - 45F

1 — Confirm actual reading
2 — Re-enter
3 — Skip
```

## Summary And Write

The summary lists every active template item. Missing/skipped values show as `N/A`.

Google Sheet payload JSON is built from validator results and includes every active template item.
