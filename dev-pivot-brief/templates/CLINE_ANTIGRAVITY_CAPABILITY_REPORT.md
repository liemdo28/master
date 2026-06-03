# CLINE_ANTIGRAVITY_CAPABILITY_REPORT.md

**Author:** <your name>
**Date:** <YYYY-MM-DD>
**Purpose:** Answer 7 specific capability questions about Cline and Antigravity so we know what we're building against.

> Fill in every section. If you don't know, write `KNOWN_UNKNOWN` with what you'd need to find out. **Don't guess.**

---

## A. Antigravity — what we found

### A.1 Install location

- Path on Worker PC: `<C:\...\>`
- Discovery method: `<how you found it: where command, registry key, file search>`
- Version installed: `<version>`
- Source: standalone .exe / VS Code extension / Cursor extension / other (`<which>`)

### A.2 Programmatic interface

Does Antigravity expose any of:

- [ ] CLI / `.exe` with arguments?  → command line:
- [ ] `--help` output (paste below)?
- [ ] HTTP/WebSocket server?  → port:
- [ ] Named pipe / Unix socket?  → path:
- [ ] File-watcher API (drop a job file, it picks it up)?
- [ ] None of the above

If "none of the above," what would you do to start it programmatically? (ShellExecute? Task Scheduler? Other?)

### A.3 Multi-agent capability

From the docs: Antigravity supports running multiple agents in parallel. Confirm:

- [ ] Confirmed by reading source/docs (link below)
- [ ] Tested by us (paste output)
- [ ] Believed but not verified

How many parallel agents on our PC's hardware?

### A.4 Model selection

Which models does this Antigravity install actually have access to?

- [ ] Gemini 3 Pro (free preview tier)
- [ ] Gemini 3 Flash
- [ ] Claude Sonnet 4.6
- [ ] Claude Opus 4.6
- [ ] GPT-OSS-120B
- [ ] Other:

Auth required for which? (Google account, Anthropic key, OpenAI key, etc.)

### A.5 Reading Antigravity's output

When an Antigravity agent finishes a task, where does the output land?

- Artifacts directory: `<path>`
- Log file: `<path>`
- Database (sqlite/level/other)? `<path>`
- Stdout? (only if launched from CLI)

### A.6 Linking

Paste links to the most useful sources you found:

- Official docs:
- GitHub / source:
- Reddit/blog posts that helped:

---

## B. Cline — what we found

Cline is what we know from <https://cline.bot> / <https://github.com/cline/cline>. Fill these in based on the actual source.

### B.1 Install form

- [ ] VS Code extension (extension id: `<id>`)
- [ ] Cursor extension
- [ ] Standalone CLI
- [ ] Cloud product
- [ ] Other:

### B.2 Programmatic interface (Check 2)

For each of these, mark Y/N and add evidence:

- [ ] Y / [ ] N — has a CLI binary
- [ ] Y / [ ] N — exposes an HTTP server when running
- [ ] Y / [ ] N — exposes a websocket
- [ ] Y / [ ] N — has MCP server mode
- [ ] Y / [ ] N — VS Code commands that can be triggered via `code --command`
- [ ] Y / [ ] N — can be invoked headlessly (no UI required)

Evidence for each Y (link to source file, command output, etc.):

### B.3 Prompt injection (Check 3)

Given an open Cline session, can we send a new prompt programmatically?

- Mechanism: `<websocket message / VS Code command / IPC / clipboard hack / nothing>`
- Sample of the wire format (paste a real example):
```
<the actual message format Cline uses>
```
- Reliability: stable / fragile / unknown

### B.4 Output capture (Check 4)

Given Cline is running a task, can we read what it produces?

- Mechanism: `<event stream / file tail / DB query / nothing>`
- Format:
- Latency: `<rough ms from Cline event to our process seeing it>`

### B.5 Log streaming (Check 5)

How granular can we stream?

- [ ] Token-by-token
- [ ] Line-by-line
- [ ] Message-by-message
- [ ] Task-end only

Practical p50 latency from Cline emit to laptop display:

### B.6 What Cline cannot do (be honest)

If something we expected doesn't exist:
- e.g., "Cline does not currently expose a way to inject a prompt without a human focusing the input box. We'd need UI automation."

---

## C. Recommended path forward

After investigating both, our recommendation is:

- [ ] Plan A: Use Antigravity as primary executor, drop Cline for now
- [ ] Plan B: Use Cline as primary executor, drop Antigravity for now
- [ ] Plan C: Use both — Antigravity for X, Cline for Y
- [ ] Plan D: Use neither; build our own minimal executor (scope: write code, run shell, no UI orchestration)

Reasoning (3-5 sentences):

---

## D. Estimated effort

For each deliverable in the CEO brief, estimate engineering days based on what we've learned:

| Deliverable | Days | Confidence | Blockers |
|---|---:|---|---|
| D1 — these 3 reports | <done> | <high> | — |
| D2 — ping/pong | | | |
| D3 — open Antigravity | | | |
| D4 — start API proxy | | | |
| D5 — audit Master | | | |
| D6 — inject prompt to Cline | | | |

If your estimate for any deliverable is > 2× the brief deadline: flag and propose alternatives.

---

## E. Risks and red flags

1.
2.
3.

---

## F. Sign-off

I've read every section of the CEO brief, and I've answered the 7 checks above honestly. Items marked KNOWN_UNKNOWN are followed up in section G.

**Signed:** <dev name>, <date>

### G. KNOWN_UNKNOWNS — research plan

For each KNOWN_UNKNOWN, what's the plan and ETA:

| Question | Plan | ETA |
|---|---|---|
| | | |
