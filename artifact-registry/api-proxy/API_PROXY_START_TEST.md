# API Proxy Start Test

Generated: 2026-06-02 05:07 +07:00

## Result

Status: PASS

## Runtime

| Check | Result | Evidence |
| --- | --- | --- |
| Gateway port | PASS | `127.0.0.1:3456` listening on PID `5364` |
| PM2 owner | PASS | `antigravity-gateway` runs `E:\Project\Master\Agent\agent-coding-api-keys\dist\server.js` directly |
| Health endpoint | PASS | `GET http://127.0.0.1:3456/health` returned HTTP 200 |
| Background starter | PASS | `start-proxy-background.ps1` detected existing port and did not spawn a duplicate process |
| PID artifact | PASS | `E:\Project\Master\artifact-registry\executions\api-proxy.pid` contains `5364` |
| Log artifact | PASS | `E:\Project\Master\artifact-registry\logs\api-proxy.log` updated |
| Extra Node window | PASS | All `node.exe` `MainWindowTitle` values empty after PM2 direct-server change |

## Startup Path

Current production/service path:

```txt
PM2 antigravity-gateway
  -> E:\Project\Master\Agent\agent-coding-api-keys\dist\server.js
  -> binds 127.0.0.1:3456
```

Agent OS chat path:

```txt
Start API Proxy
  -> COMMAND_REGISTRY.json
  -> E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-background.ps1
  -> if 3456 is active: write PID/log, spawn nothing
  -> if 3456 is free: start hidden background launcher, write PID/log
```

## Validation Commands

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-background.ps1
node E:\Project\Master\validation-engine\runners\api-proxy.js
node E:\Project\Master\validation-engine\runners\port-audit.js
```

## Evidence

```txt
start-proxy-background.ps1:
API proxy already running on port 3456, PID 5364.

Agent OS chat Start API Proxy:
Task ed1050a3-94b2-4888-a69c-e0d5f7c81326 completed.
registryIntent=start_api_proxy
scriptPath=E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-background.ps1
BeforeNodeLike=15
AfterNodeLike=15
```

Screenshot/evidence:

```txt
E:\Project\Master\artifact-registry\screenshots\node-window-audit-20260602.png
E:\Project\Master\artifact-registry\screenshots\node-window-audit-20260602.json
```

