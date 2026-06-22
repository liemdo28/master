# LD Agent Dynamic Flow Report

Date: 2026-06-05

## Flow

`/ldagent` uses the active session language and dynamic template cache.

Daily Entry starts only when a current template is available.

Current runtime:

- item count: 19
- first item: Walk-in Cooler
- first target: `30°F - 45°F`

## Prompt Format

```text
Daily Entry Log - Rim

Item 1/19
Walk-in Cooler

Target:
30°F - 45°F

Reply with temperature:
```

## Controls

- `STATUS`: shows progress out of 19
- `CONFIRM`: writes/queues all template items
- `CANCEL`: discards workflow
- `EDIT`: edits by number or item name

## Guardrail

No old five-item batch/demo list is used by `/ldagent` Daily Entry.
