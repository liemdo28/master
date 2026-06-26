# OPERATOR RUNTIME DEMO PROOF

## Demo 1 — Public Read

Target:

- `https://example.com`

Actions configured:

- `navigate`
- `read_title`
- `screenshot`
- `extract_links`

Observed result in this environment:

- task executed through test harness
- policy allowed target
- runtime returned `FAILED` because Playwright browser initialization did not succeed
- evidence still stored:
  - `d:\\Project\\.local-agent-global\\operator-runtime\\evidence\\OPS-0001\\log.json`
  - `d:\\Project\\.local-agent-global\\operator-runtime\\html\\OPS-0001.html`

## Demo 2 — Test Form

Prepared local harmless form:

- `server/tests/operator-runtime/demo-form.html`

Intended actions:

- `navigate`
- `fill`
- `screenshot`
- local submit only

Status:

- HTML test form prepared
- not executed end-to-end in this pass because browser runtime did not initialize successfully

## Demo 3 — Download

Intended action:

- safe public/local download
- verify file exists
- screenshot

Status:

- download action implemented in adapter
- not fully demonstrated end-to-end in this pass because browser runtime did not initialize successfully

## Summary

The safe demo assets and task flows exist, but full live browser demos remain partial until Playwright browser launch succeeds in this environment.