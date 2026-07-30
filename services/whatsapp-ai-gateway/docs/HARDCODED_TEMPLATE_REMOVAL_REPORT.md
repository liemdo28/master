# Hardcoded Template Removal Report

Date: 2026-06-05

## Search Terms

- Walk-in Cooler
- Walk-in Freezer
- Prep Area
- Fryer
- Pork Broth
- defaultItems
- fallbackItems
- demo template
- sample template

## Production Fixes

Removed operational fallback/demo template usage from:

- `src/templates/template-cache.js`
- `src/commands/broth-parser.js`
- `src/google/broth-items-loader.js`
- `src/workflows/guided/temperature-workflow.js`
- `src/food-safety/image-analyzer.js`
- `src/vision/vision-prompts.js`
- `src/vision/temperature-reading-extractor.js`

## Allowed Remaining Mentions

Remaining item-name mentions are in tests, docs, comments, history examples, YoLink seed examples, or fixed sensor display labels. They are not the Daily Entry production item source.

## Production Rule

Daily Entry item source is only:

1. Google Sheet `Daily_Entry_Template!B11:D35`
2. SQLite `template_cache` from a real successful sync
