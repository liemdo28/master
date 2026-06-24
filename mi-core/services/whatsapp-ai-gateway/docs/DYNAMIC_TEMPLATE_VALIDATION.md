# Dynamic Template Validation

Date: 2026-06-04

## Header Detection

The parser scans rows for:

`Category | Item | Target Min | Target Max`

The current scan range is configurable by `TEMPLATE_SCAN_RANGE` and defaults to `A1:E200`.

## Range Rules

- Both min and max: `30F - 45F`
- Min only: `>= 165F`
- Max only: `<= 0F`
- Empty or `N/A`: `No target range`

## Validation Rules

The template fails validation when:

- header is not found
- no active items are found
- item name is blank
- item names are duplicated
- target min is greater than target max

Blank categories are warnings, not failures.

## Test Coverage

Added:

`tests/template/dynamic-template-sync-tests.js`

Covered:

- header detection
- category preservation
- target parsing
- N/A handling
- item lookup by index/name
- invalid min/max detection
