# COMPUTER_OPERATOR_CAPABILITY_MATRIX

Scoring:
- 0 = not supported
- 1 = weak
- 2 = partial
- 3 = good
- 4 = strong
- 5 = excellent

## Matrix

| Tool | Browser control | Desktop control | Windows app support | File upload/download | Login persistence | MFA handling | DOM reliability | Visual reliability | Screenshot evidence | Replayability | Cost | Security | Maintainability | Production suitability |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| OpenClaw | 1 | 0 | 0 | 1 | 1 | 0 | 1 | 0 | 1 | 1 | 4 | 2 | 2 | 1 |
| Browser Use | 4 | 1 | 1 | 3 | 4 | 2 | 4 | 3 | 4 | 2 | 3 | 3 | 3 | 3 |
| Stagehand | 4 | 0 | 0 | 3 | 3 | 2 | 4 | 3 | 4 | 3 | 3 | 3 | 3 | 3 |
| Open Interpreter | 2 | 2 | 2 | 3 | 1 | 1 | 1 | 2 | 2 | 1 | 3 | 1 | 1 | 1 |
| Playwright | 5 | 0 | 0 | 5 | 4 | 2 | 5 | 3 | 5 | 5 | 5 | 4 | 5 | 5 |
| OpenHands | 2 | 1 | 1 | 3 | 2 | 1 | 2 | 2 | 2 | 2 | 3 | 2 | 2 | 2 |
| Custom Runtime | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 5 | 4 | 2 | 4 | 3 | 4 |

## Interpretation

### Best browser execution engine
**Playwright** is the clear leader for:
- deterministic browser automation
- uploads/downloads
- evidence capture
- replayability
- production-grade maintainability

### Best adaptive browser agent layer
**Browser Use** scores well where Mi may need:
- adaptive navigation
- less brittle handling of changing layouts
- agent reasoning over websites

But it loses to Playwright in replayability and deterministic governance.

### Desktop / Windows gap
No audited off-the-shelf browser-first tool fully solves:
- QuickBooks Desktop
- Windows dialog handling
- native desktop controls
- launcher / focus / window state recovery

That gap is why Mi needs a **custom Windows helper runtime** instead of trying to force a browser-only stack.

### Why OpenClaw scores low
OpenClaw appears better suited to:
- gateway orchestration
- channel integrations
- provider/runtime plugins

It does not currently present itself as a strong browser/desktop operator system.

### Why Custom Runtime scores high
A custom runtime can combine:
- Playwright for browser control
- Browser Use for adaptive steps
- pywinauto/win32 for desktop app control
- Mi approval/evidence/security controls

This is the most realistic route to a production-grade Computer Operator Division.

## Short Recommendation
If Mi had to choose today:
1. **Playwright** for deterministic web execution
2. **Browser Use** for selective adaptive web tasks
3. **Custom Windows helper** for QuickBooks Desktop and native dialogs
4. Avoid relying on OpenClaw or Open Interpreter as the primary operator runtime
