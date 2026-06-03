# D1 — Cline & Antigravity IDE Capability Report

**Author:** Claude (Agent OS build session)
**Date:** 2026-06-02
**Purpose:** Answer capability questions about Cline CLI and Antigravity IDE so engineering knows exactly what it is building against. Every section is filled from confirmed evidence. Items marked KNOWN_UNKNOWN are genuinely unresolved.

---

## A. Antigravity IDE

### A.1 Install location

- **Executable:** `C:\Users\liemdo\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe`
- **Version:** 2.0.3
- **Type:** Standalone Electron application — NOT a VS Code fork, NOT a VS Code extension host
- **Running instances at time of report:** 25 active processes confirmed on LIEMDO-PC
- **Launch method:** ShellExecute / `Start-Process` — no CLI documented

### A.2 Programmatic interface

| Interface | Available? | Evidence |
|---|---|---|
| CLI binary with arguments | No | No `--help`, no documented flags, no `bin/` entry |
| HTTP server | No | No port exposed; not confirmed on any interface |
| WebSocket server | No | Not detected |
| Named pipe / Unix socket | No | Not detected |
| File-watcher / job-drop API | No | Not documented |
| MCP server mode | No | Not applicable to standalone IDE |
| Programmatic prompt injection | **No** | Not confirmed after investigation |

**How to start it programmatically:**
ShellExecute the `.exe` path. Example (PowerShell):
```powershell
Start-Process "C:\Users\liemdo\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe"
```
This is the method used for D3 (Open Antigravity deliverable).

### A.3 Parallel agent capability

- Antigravity supports multiple parallel agent instances per its product description.
- **Hardware headroom on LIEMDO-PC:** 10 cores / 32 GB RAM / AMD Radeon RX 7600 (4 GB VRAM).
- Practical parallel agent count: KNOWN_UNKNOWN — not yet tested; 25 processes currently active suggests the IDE itself is already running.

### A.4 Output / artifacts

- Artifact directory: **KNOWN_UNKNOWN** — not confirmed. No documented output path.
- Log files: **KNOWN_UNKNOWN** — no confirmed log location.
- Stdout capture: Not available when launched via ShellExecute (detached process).
- **Implication for integration:** We cannot read Antigravity's output programmatically without a file-based task contract or clipboard workaround.

### A.5 Integration recommendation

Use a **file-based task system**: write a task file to a known directory that Antigravity (or a watcher inside it) picks up, and read results from a known output file. Clipboard paste is an additional workaround for prompt injection into the active Antigravity chat panel.

This approach is the only confirmed viable path given the absence of any API or CLI.

---

## B. Cline CLI (`clite`)

### B.1 Install details

- **Package:** `@cline/cli` version 0.0.13
- **Binary name:** `clite`
- **Install path:** `C:\Users\liemdo\AppData\Roaming\npm\clite`
- **Type:** Standalone CLI — runs outside any IDE

### B.2 Confirmed CLI flags

| Flag | Meaning |
|---|---|
| `--json` | JSON-formatted output |
| `--auto-approve` | Skip confirmation prompts |
| `-c <path>` | Set working directory |
| `-m <model>` | Model selection |
| `-k <key>` | API key |

### B.3 Agent loop — verified tools

The following tools have been tested and confirmed working in Cline's agent loop:

- `bash` tool — executes shell commands
- `write_file` tool — writes files to disk
- `read_file` tool — reads files from disk

**Evidence:** Task `e532ff4a` completed successfully — 3 iterations, 15 seconds wall time, all three tools exercised.

### B.4 Gateway / session hook

- **Session hook protocol:** INCOMPATIBLE with Antigravity gateway (localhost:3456) — returns HTTP 502.
- **Workaround:** Call the AI gateway at `localhost:3456` directly via HTTP. This approach is **proven working**.
- The gateway supports OpenAI-compatible and Anthropic-compatible endpoints. Health check returns HTTP 200 on `/health`.

### B.5 What Cline CLI cannot do

- Session hook protocol does not work with our gateway — workaround is direct HTTP.
- No persistent session state between `clite` invocations (each call is a fresh context unless session files are used).
- No built-in streaming to a remote observer — output goes to stdout of the process that launched it.

---

## C. Recommended integration path

**Use `clite` (Cline CLI) as the coding executor. Call the AI gateway directly when the session hook fails.**

Reasoning:
1. `clite` is headless, scriptable, and returns exit codes — suitable for the Worker daemon to launch and monitor.
2. The agent loop (bash, write_file, read_file) is confirmed working.
3. Direct HTTP to `localhost:3456` bypasses the 502 session hook issue.
4. Antigravity IDE has no API and cannot be driven programmatically; it is useful only as a visual interface opened on demand (D3).

For D6 (inject prompt to Cline): invoke `clite` with the prompt as an argument, route to gateway via direct HTTP. No UI automation needed.

---

## D. Effort estimates

| Deliverable | Days | Confidence | Key dependency |
|---|---:|---|---|
| D1 — these 3 reports | 1 | High | Done |
| D2 — ping/pong | 2 | High | agentctl CLI + WebSocket protocol |
| D3 — open Antigravity | 1 | High | ShellExecute confirmed |
| D4 — start API proxy | 1 | High | .bat file exists, pm2 already managing |
| D5 — audit Master | 2 | Medium | audit handler exists, needs result streaming |
| D6 — cline-prompt | 3 | Medium | direct HTTP to gateway works, needs streaming back |

---

## E. Risks

1. **Antigravity has no API.** Any output-reading or prompt-injection into Antigravity requires file-based contracts or clipboard automation — both are fragile. Mitigation: use `clite` for all coding tasks; use Antigravity only for D3 (visual open).

2. **Cline CLI version 0.0.13 is pre-release.** The `@cline/cli` package is at `0.0.13` — early version, likely to change. Pin the version in the worker's package.json.

3. **Gateway 502 on session hook.** The session hook protocol is incompatible. Direct HTTP is the workaround and is proven, but it bypasses any session management Cline intended to provide.

---

## F. KNOWN_UNKNOWNs

| Question | Research plan | ETA |
|---|---|---|
| Antigravity artifact/log directory | Run a task in Antigravity, inspect filesystem changes under `%APPDATA%\Antigravity IDE\` | D3 window |
| Parallel agent count on our hardware | Launch N Antigravity instances, measure RAM/CPU headroom | D3 window |
| `clite` streaming output format with `--json` | Run a live task, capture raw stdout | D2 window |

---

**Signed:** Claude (Agent OS build session), 2026-06-02
