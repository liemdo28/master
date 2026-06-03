# WORKER_CONNECTIVITY_REPORT.md

**Author:** <your name>
**Date:** <YYYY-MM-DD>
**Purpose:** Document the PC Worker side of the control plane — what we can run, what we can stream, what we can open.

---

## 1. Worker host inventory

- Hostname: 
- OS: Windows 10 / 11 / Windows Server / other:
- Username it runs under: 
- CPU / RAM: 
- GPU (if any): 
- Disk free: 

## 2. Worker daemon — proposed implementation

- Language: <Node.js / Go / Python / other>
- How it starts at boot: Task Scheduler / Windows Service / systemd / launchd
- Where its config lives: <path>
- Where its logs go: <path>
- Where its audit DB lives: <path>

## 3. Outbound connectivity (PC → Control Plane)

Document what the PC can reach when laptop is at home / on the road:

| From PC | To | Reachable? | Notes |
|---|---|---|---|
| PC | Laptop on same LAN | Y/N | |
| PC | Laptop over Tailscale | Y/N | |
| PC | Laptop over WireGuard | Y/N | |
| PC | Laptop over public Internet (laptop has public IP / DDNS) | Y/N | |

Recommendation for transport: <which option above, and why>

## 4. Inbound connectivity (Control Plane → PC)

Same matrix as above but inbound. **Default architecture says PC never accepts inbound** — confirm this remains true.

## 5. Process control — Check 6

Demonstrate that the Worker can run `E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-win.bat`.

Paste real evidence:

```
> agent-os-worker.exe run-script "E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-win.bat"
{ task_id: "...", started_pid: 12345 }

> agent-os-worker.exe logs --tail 20
[2026-05-... INFO] proxy listening on port 8080
[2026-05-... INFO] ...
```

If the .bat needs admin / specific env vars / specific working directory — document.

## 6. File operations

### 6.1 Allowed read paths (configured)

```
[
  "E:\\Project\\Master",
  "...",
]
```

### 6.2 Allowed write paths

```
[
  ...
]
```

### 6.3 Explicitly forbidden

```
[
  "C:\\Windows",
  "C:\\Program Files",
  ...
]
```

### 6.4 Fetch test

Demonstrate the worker can send a file back to laptop:

```
> agentctl fetch pc-master:E:\Project\Master\README.md
fetched 12,345 bytes to ./README.md
```

## 7. Long-running services (start-service)

What services do we expect to manage? Each row should be present in `services.json`:

| Name | Command | Working dir | Notes |
|---|---|---|---|
| api-proxy | `E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-win.bat` | `E:\...` | started on boot? |
| ollama | `ollama serve` | `%USERPROFILE%` | already running? |
| antigravity (when needed) | `<path>` | | not started on boot |

For each, describe:
- Start command
- Stop signal (`CTRL_BREAK` vs `WM_CLOSE` vs kill)
- Health check (process exists? port listening?)
- Log destination

## 8. UI automation (only if Cline requires it)

If Check 3 in the capability report concluded we need OS-level UI automation:

- Tool of choice: AutoHotkey / pyautogui / nut.js / Windows UI Automation API
- Failure mode: how do we detect when the script breaks (e.g., Cline UI changed)?
- Recovery: how do we re-pair / re-discover?

If we don't need this: write "Not required — Cline integration uses <mechanism>." and move on.

## 9. Recovery & resilience

- What happens when the daemon crashes?  → restart policy
- What happens when the daemon's connection to Control Plane drops?  → reconnect with backoff
- What happens when the PC reboots mid-task?  → task marked as `aborted_by_reboot`, audit row written on restart

## 10. Acceptance: minimum proof of life

Paste the full agentctl session that proves Worker is alive:

```
> agentctl workers list
hostname     status    last_seen      tags         version
pc-master    online    2s ago         windows,gpu  0.1.0

> agentctl ping pc-master
pong from pc-master, latency 23ms

> agentctl exec --worker pc-master shell "ver"
Microsoft Windows [Version 10.0.22631.4317]
exit_code: 0  duration_ms: 84
```
