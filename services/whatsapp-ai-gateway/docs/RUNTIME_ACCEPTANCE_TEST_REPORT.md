# Runtime Acceptance Test Report

Date: 2026-06-05

## Script

`tests/live/runtime-acceptance-test.js`

## Coverage

- `/api/runtime-truth`
- valid dashboard sheet URLs
- template sync count 19
- `/version` template count
- `/ldagent` command routing
- Vietnamese language persistence
- Daily Entry Item 1/19
- target range display
- in-range value accepted
- out-of-range value detected
- `STATUS` progress
- no generic fallback during active workflow

## Latest Result

`node tests/live/runtime-acceptance-test.js`

Result: PASS 20/20

The test exposed and verified the fix for a real `/ldagent` bug where `guidedEngine.handleReply()` was not awaited.

## Note

The script uses the running server for HTTP checks and the real command router for session checks. It does not automate WhatsApp Web directly.
