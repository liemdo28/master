# Port & Process Audit

Generated: 2026-06-02 05:07 +07:00  
Scope: Windows listening ports, Node/npm/pnpm/yarn processes, PM2-managed services.

## Executive Summary

Status: PASS after cleanup.

Actions taken:

- Killed duplicate/orphan Agent OS worker PID `15836`.
- Kept PM2-managed `agent-worker` as the single valid worker.
- Reconfigured PM2 `antigravity-gateway` to run `dist/server.js` directly instead of `proxy.js`, removing the extra child Node window.
- Saved PM2 process list with `pm2 save`.
- Did not kill `chrome-devtools-mcp` Node processes because owner is tooling/connector, not a project app, and CEO rule says do not kill without confirmed owner.

## Active Registered Ports

| Port | PID | Process | Project Path | Status | Reason |
| --- | ---: | --- | --- | --- | --- |
| 3456 | 5364 | PM2 `antigravity-gateway` | `E:\Project\Master\Agent\agent-coding-api-keys\dist\server.js` | KEEP | Active Antigravity Universal AI Gateway. Health OK. |
| 3700 | 31204 | PM2 `agent-control` | `E:\Project\Master\agent-os\agent-control\dist\server.js` | KEEP | Active Agent OS control plane/UI. |

Reserved ports not currently listening:

| Port | Owner | Status | Reason |
| ---: | --- | --- | --- |
| 3000 | Agent OS CEO Chat | RESERVED | Future CEO chat port; current control plane remains on 3700. |
| 3460 | Agent OS Validation | RESERVED | Reserved for validation HTTP runner; current runner is CLI-only. |
| 4001 | Agent Coding Local Agent UI | RESERVED | Discovered in source/config. |
| 8000 | Agency API | RESERVED | Discovered in agency `.env`. |
| 8001 | Agency Unified API | RESERVED | Discovered in agency `.env`. |
| 8002 | Agency Control API | RESERVED | Discovered in Vite proxy config. |
| 8080 | Agency Dashboard | RESERVED | Discovered in agency scripts. |
| 8788 | AI Search Tool | RESERVED | Discovered in README. |
| 8844 | Accounting Engine | RESERVED | Discovered in source/config. |
| 11434 | Ollama Local | EXTERNAL | External local model server dependency, not owned by this project. |

## Node Process Classification

| PID | Process | Command / PM2 owner | Status | Reason |
| ---: | --- | --- | --- | --- |
| 5364 | node.exe | PM2 `antigravity-gateway`, `dist/server.js` | KEEP | Active gateway on 3456. |
| 31204 | node.exe | PM2 `agent-control`, `dist/server.js` | KEEP | Active control plane on 3700. |
| 496 | node.exe | PM2 `agent-worker`, `dist/worker.js` | KEEP | Single active worker. |
| 15868 | node.exe | PM2 daemon | KEEP | Required process manager. |
| 11316, 10048, 8364, 32512, 32508, 22948, 3024, 11936, 28892, 27996 | node.exe | `chrome-devtools-mcp` / `npx` tooling | KEEP | Tooling owned by current browser/devtools connector; not project app. |
| 15836 | node.exe | Direct `agent-os\agent-worker\dist\worker.js` | KILL | Duplicate worker outside PM2. Terminated with `taskkill /PID 15836 /F`. |

## Window Evidence

`Get-Process node | Select Id,ProcessName,MainWindowTitle` after PM2 direct-server change:

```txt
All node.exe MainWindowTitle values are empty.
```

Evidence artifacts:

- `E:\Project\Master\artifact-registry\screenshots\node-window-audit-20260602.png`
- `E:\Project\Master\artifact-registry\screenshots\node-window-audit-20260602.json`

## Validation

Command:

```powershell
node E:\Project\Master\validation-engine\runners\port-audit.js
```

Result:

```json
{
  "status": "PASS",
  "conflicts": [],
  "orphanProcesses": [],
  "health": {
    "ok": true,
    "statusCode": 200,
    "url": "http://127.0.0.1:3456/health"
  }
}
```

