# Control Plane — Technical Specification

**Status:** spec for dev team to implement (no code yet, this is the design contract)
**Companion:** `01-CEO_BRIEF.md`

---

## 1. The three layers

```
   ┌─────────────────────────────────────────────────────┐
   │                  Laptop                              │
   │                                                      │
   │   ┌─────────────┐         ┌──────────────────┐      │
   │   │   agentctl  │ ◄─────► │  Control Plane   │      │
   │   │   (CLI)     │  IPC    │   (broker)       │      │
   │   └─────────────┘         └────────┬─────────┘      │
   └───────────────────────────────────-│-────────────────┘
                                        │
                              WebSocket │ over TLS
                                  (PSK-authenticated)
                                        │
   ┌────────────────────────────────────┼─────────────────┐
   │                  PC Worker         │                  │
   │                                    ▼                  │
   │                         ┌──────────────────┐         │
   │                         │  Worker Daemon   │         │
   │                         │                  │         │
   │                         │  • task runner   │         │
   │                         │  • file streamer │         │
   │                         │  • log streamer  │         │
   │                         └────────┬─────────┘         │
   │                                  │                    │
   │             ┌────────────────────┼────────────────┐  │
   │             ▼                    ▼                ▼  │
   │      ┌──────────┐         ┌──────────┐    ┌─────────┐│
   │      │ Shell    │         │ Cline /  │    │ Anti-   ││
   │      │ Commands │         │ MCP      │    │ gravity ││
   │      │ (.bat,   │         │ Servers  │    │         ││
   │      │  .ps1,   │         │          │    │         ││
   │      │  binaries)│        │          │    │         ││
   │      └──────────┘         └──────────┘    └─────────┘│
   │             │                    │                ▼  │
   │             └────────────────────┴───────► E:\Project │
   │                                            ...        │
   └───────────────────────────────────────────────────────┘
```

## 2. Components

### 2.1 `agentctl` (Laptop CLI)

- Single binary or Node.js script (your choice — pick what ships fastest)
- Reads `~/.agentctl/config.json` for control plane address + auth token
- Pretty-prints results; supports `--json` for piping
- Reconnects automatically if Control Plane is restarted
- Sub-commands: see §3 below

### 2.2 Control Plane (Laptop, default)

- Long-running process on the laptop
- Listens on `127.0.0.1:7421` for `agentctl` (Unix socket on Mac/Linux preferred)
- Maintains persistent WebSocket to each registered Worker
- Persists task state in SQLite at `~/.agentctl/state.db`
- On `agentctl` task dispatch:
  - Creates a task row, status = `queued`
  - Picks a worker (by name, or by capability tag if multiple)
  - Sends task message to worker over WebSocket
  - Status → `dispatched`
  - On worker reply: status → `succeeded` or `failed`
  - On timeout: status → `timeout`
- Supports multiple workers; routes by hostname or capability tag

### 2.3 Worker Daemon (PC)

- Long-running process on each PC
- On startup:
  - Reads `~/.agent-os-worker/config.json`
  - Establishes WebSocket to Control Plane (outbound connection — no firewall config needed on PC)
  - Sends a `register` message with: hostname, OS, available tags, version
- Listens for task messages
- Per task: executes in a child process, captures stdout/stderr, streams updates back
- Heartbeats every 10 seconds
- Reconnects with exponential backoff (1s, 2s, 4s, ... max 60s) if connection drops

## 3. CLI surface (mandatory)

```
agentctl ping [--worker NAME]                  # round-trip latency test
agentctl workers list                          # show registered workers
agentctl workers show NAME                     # detail on one worker
agentctl exec COMMAND [ARGS...] [--worker N]   # dispatch a task, wait for result
agentctl tasks list [--limit N]                # list recent tasks
agentctl task show ID                          # full task detail
agentctl task abort ID                         # ask worker to abort a running task
agentctl logs RESOURCE [--tail N] [--follow]   # stream logs for a long-running task
agentctl fetch WORKER:PATH [--to LOCAL]        # download file from worker
agentctl push LOCAL WORKER:PATH                # upload file to worker
agentctl status [RESOURCE]                     # snapshot status
agentctl pair WORKER_ADDRESS                   # one-time pairing flow (generates PSK)
```

## 4. Task message protocol

All messages are JSON over WebSocket. Every message has:
```
{
  "v": 1,
  "type": "...",
  "id": "<uuid>",
  "ts": "2026-05-..."
}
```

### 4.1 Dispatch (Control Plane → Worker)
```
{
  "v": 1,
  "type": "task.dispatch",
  "id": "task-abc123",
  "ts": "...",
  "command": "audit",
  "args": ["E:\\Project\\Master"],
  "timeout_sec": 600,
  "stream_logs": true,
  "auth_token_sig": "<HMAC of fields with PSK>"
}
```

### 4.2 Log stream (Worker → Control Plane, multiple per task)
```
{
  "v": 1,
  "type": "task.log",
  "id": "task-abc123",
  "ts": "...",
  "stream": "stdout" | "stderr" | "agent",
  "data": "<chunk>"
}
```

### 4.3 Result (Worker → Control Plane, one per task)
```
{
  "v": 1,
  "type": "task.result",
  "id": "task-abc123",
  "ts": "...",
  "status": "ok" | "error" | "timeout" | "aborted",
  "exit_code": 0,
  "duration_ms": 12345,
  "payload": { ... command-specific data ... },
  "error": "<if error>",
  "artifacts": [
    { "kind": "file", "path": "E:\\...\\report.md", "size_bytes": 12345 }
  ]
}
```

### 4.4 Heartbeat (Worker → Control Plane, every 10s)
```
{
  "v": 1,
  "type": "heartbeat",
  "ts": "...",
  "load": { "cpu_pct": 23, "mem_pct": 45 },
  "active_tasks": 0
}
```

### 4.5 Abort (Control Plane → Worker)
```
{
  "v": 1,
  "type": "task.abort",
  "id": "task-abc123",
  "ts": "...",
  "reason": "user_requested"
}
```

## 5. Authentication

### 5.1 First-time pairing
```
On PC:    agent-os-worker pair --code <6-digit>
On Laptop: agentctl pair pc-master.local --code <6-digit>
```

Both ends generate a shared secret (32 bytes random). PC stores it in `~/.agent-os-worker/keys/<laptop-id>.psk`. Laptop stores in `~/.agentctl/keys/<worker-id>.psk`.

The 6-digit code is short-lived (5 minutes) and is used only to bootstrap the shared secret. After pairing, the code is invalid.

### 5.2 Per-message auth
Every message includes an HMAC-SHA256 signature over the message body using the PSK. Worker rejects unsigned/bad-signature messages.

### 5.3 TLS
WebSocket over TLS even on LAN. Use self-signed certs generated during pairing. The PSK pins the cert (TOFU).

### 5.4 Why this design
- PC doesn't need any inbound firewall hole (outbound WSS only)
- No external auth server, no internet dependency
- Compromise of laptop ≠ instant pwn of PC (PSK is per-pair, not per-laptop)
- Simple enough to audit; secure enough for personal use

## 6. Built-in commands the Worker must support

These are the canonical commands `agentctl exec` can dispatch. Worker has a registry of command handlers; each handler is a small module under `worker/commands/`.

### 6.1 `ping`
- Worker responds with `pong` + hostname + version. No work.

### 6.2 `shell`
- Args: `<command line>`
- Worker spawns `cmd.exe /c <command>` (Windows) or `/bin/sh -c` (Unix)
- Streams stdout/stderr
- Returns exit code

### 6.3 `run-script`
- Args: `<path-to-script>` [extra args]
- Worker runs the script; same as shell but with path validation (must exist, must be in allowlist of script directories)

### 6.4 `start-service`, `stop-service`, `status-service`
- Args: `<service-name>`
- Manages long-running processes that the Worker started
- `start`: spawns the process detached, records pid, captures logs to file
- `stop`: sends SIGTERM/CTRL_BREAK then SIGKILL/TerminateProcess after 10s
- `status`: returns pid, uptime, last 20 lines of log
- Used for: API proxy, dev server, watcher daemons

### 6.5 `open-app`
- Args: `<app-name>`
- Windows: ShellExecute to known paths (Antigravity, VS Code, Cursor, browser)
- Returns the process handle/pid so we can later `close-app`

### 6.6 `close-app`
- Args: `<pid>` or `<app-name>`
- Sends WM_CLOSE then TerminateProcess if it doesn't respond

### 6.7 `cline-prompt`
- Args: `--project PATH --prompt TEXT`
- Implementation depends on Check 3 outcome (see capability report)
- Likely flow:
  1. Open VS Code at `PATH`
  2. Trigger Cline command (mechanism per report)
  3. Inject prompt
  4. Stream Cline's output back via log stream messages

### 6.8 `audit`
- Args: `<path>`
- Invokes the Master Intelligence Layer's audit module
- Streams progress
- Returns: report path on Worker, summary, counts

### 6.9 `fetch-file`
- Args: `<worker-path>`
- Streams file contents back to laptop in chunks
- Laptop's `agentctl fetch` reassembles to local disk

### 6.10 `push-file`
- Args: `<worker-path>`
- Receives chunks, writes to worker filesystem

## 7. Path safety

Worker has an allowlist of directories it can read/write:

```
# E:\Project\Master\Agent\agent-os-worker\config.json
{
  "allowed_paths": [
    "E:\\Project\\Master\\",
    "C:\\Users\\hoang\\AppData\\Roaming\\agent-os-worker\\"
  ],
  "forbidden_paths": [
    "C:\\Windows\\",
    "C:\\Program Files\\"
  ]
}
```

`shell` and `run-script` commands check the cwd against allowlist; outside paths are rejected with a clear error.

## 8. Concurrency

- Worker default: 1 active task at a time (predictable)
- Can be raised to N via config `max_concurrent_tasks`
- Long-running services (started via `start-service`) don't count against task slots

## 9. Failure modes (document each)

- Laptop loses WiFi: tasks already dispatched continue on Worker; new dispatches queue locally in laptop's state.db until reconnect
- PC reboots: Worker daemon auto-starts via Task Scheduler / launchd / systemd
- Long-running task killed by OS: Worker detects child process death, reports status `crashed` with last log tail
- Cline hangs: Worker enforces task timeout, kills process tree, reports `timeout`
- PSK mismatch (re-paired one side only): Worker rejects, error tells user to re-pair
- Clock skew between machines: messages have `ts`; reject messages > 5 min old (replay protection)

## 10. Observability

- Worker writes structured logs to `E:\Project\Master\.agent-os\logs\worker-YYYY-MM-DD.jsonl`
- Audit ledger (separate from logs): hash-chained, in `audit.db`, one row per task event
- `agentctl logs <task-id>` reads from worker over the wire
- `agentctl audit verify` walks the chain, asserts integrity

## 11. What this is NOT

- Not a job queue with retries and backpressure (yet) — V2 if we need it
- Not multi-tenant — one Laptop owner, one or more PCs they own
- Not internet-routable — assumes LAN or VPN between Laptop and PC
- Not a workflow engine (that's a separate layer that uses this as transport)

## 12. Open design decisions to confirm

These should be answered by Dev when they file `CONTROL_PLANE_CONNECTIVITY_REPORT.md`:

1. **Language for Worker daemon?** Node.js (consistent with rest of stack) or Go (single binary, easier to ship)? Recommend Node.js for now; Go in v2 if we need it.
2. **Control Plane on laptop or on PC?** Recommend laptop (PC stays a pure executor).
3. **Pairing UX** — 6-digit code via what channel? Telegram? Screen-to-screen? Document the choice.
4. **Multiple PCs** — when we add a 2nd PC, does it talk to the same Control Plane or its own? V1: same.
5. **Cline integration mechanism** — depends entirely on Check 3 outcome. Spec for cline-prompt is intentionally vague until Check 3 lands.
