# Command Router Priority Report

Date: 2026-06-05

## Runtime Order

1. Active workflow/session handler
2. Slash commands
3. Localized command aliases
4. Operational commands
5. Customer AI fallback

## Fix

`command-router` now includes active temperature sessions in the early active-session check. Active `/ldagent`, `/broth`, and temperature workflows handle numeric replies before generic AI fallback.

## Covered Commands

- `/ldagent`
- `/broth`
- `/help`
- `/status`
- `/template`
- `/log`
- `/history`
- `/version`
- `/language`

## Acceptance

During an active session:

- store choice `1` is handled by `/ldagent`
- numeric value `44` is handled by Daily Entry
- generic “Thank you for your message” does not appear
