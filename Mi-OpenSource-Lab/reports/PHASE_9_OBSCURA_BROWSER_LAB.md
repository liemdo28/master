# Phase 9 POC: Obscura Browser Lab

Provider reference: Obscura candidate
Status: LAB ONLY. No install or credential-bearing test was executed.

## Test Matrix

| Test | Local Page | Google Login View Only | DoorDash Login View Only | Toast View Only | Dashboard Preview |
|---|---|---|---|---|---|
| Open page | Pending | Pending | Pending | Pending | Pending |
| Login page rendering | N/A | Pending | Pending | Pending | N/A |
| Screenshot capture | Pending | Pending | Pending | Pending | Pending |
| DOM query | Pending | Pending | Pending | Pending | Pending |
| Click button | Pending | View only | View only | View only | Pending |
| Fill input | Pending test input only | Blocked | Blocked | Blocked | Pending test input only |
| Wait for navigation | Pending | Pending | Pending | Pending | Pending |
| CDP compatibility | Pending | Pending | Pending | Pending | Pending |
| Playwright compatibility | Pending | Pending | Pending | Pending | Pending |
| Puppeteer compatibility | Pending | Pending | Pending | Pending | Pending |
| Anti-bot behavior | N/A | View only | View only | View only | N/A |
| Crash recovery | Pending | Pending | Pending | Pending | Pending |

## Decision

Default decision: B. Use only for research.

Obscura must not replace Playwright or Chrome until it passes view-only lab tests and credential/profile safety review.
