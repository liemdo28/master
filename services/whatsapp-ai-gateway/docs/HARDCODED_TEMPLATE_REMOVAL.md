# Hardcoded Template Removal

Date: 2026-06-05

## Removed From Runtime Fallbacks

- `src/templates/template-cache.js`: no operational defaults.
- `src/commands/broth-parser.js`: default item list is empty.
- `src/google/broth-items-loader.js`: legacy default item list is empty.
- `src/workflows/guided/temperature-workflow.js`: no hardcoded default temperature items.
- `src/food-safety/image-analyzer.js`: known items now come from template cache.
- `src/vision/vision-prompts.js`: target items now come from template cache.
- `src/vision/temperature-reading-extractor.js`: exported known item list now comes from template cache.

## Remaining Mentions

Some item names remain in tests, documentation, comments, history examples, and YoLink seed examples. These are not the Daily Entry production item source.

## Production Rule

Allowed production sources:

1. Google Sheet `Daily_Entry_Template`
2. SQLite `template_cache` from the last successful sync

No production Daily Entry flow uses a hardcoded item list.
