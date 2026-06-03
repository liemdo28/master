# Port Merge Report

Generated: 2026-06-02 05:07 +07:00

## Final Registry

Source of truth:

```txt
E:\Project\Master\PORT_REGISTRY.json
```

Active registered services:

| Service | Port | Owner | Runtime |
| --- | ---: | --- | --- |
| `agent-coding-api-keys` | 3456 | Antigravity Universal AI Gateway | PM2 direct `dist/server.js` |
| `agent-control` | 3700 | Agent OS Control Plane | PM2 `dist/server.js` |
| `agent-worker` | none | Agent OS Worker | PM2 worker, no HTTP listener |

Reserved / discovered services:

| Service | Port | Status | Source |
| --- | ---: | --- | --- |
| `agent-os-ceo-chat` | 3000 | reserved | CEO directive |
| `validation-engine` | 3460 | reserved | CEO directive |
| `agent-coding-local-agent-ui` | 4001 | reserved | `Agent\agent-coding\.env.example`, local-agent UI docs |
| `agency-api` | 8000 | reserved | `Agent\agent-coding\apps\agency\.env` |
| `agency-unified-api` | 8001 | reserved | `Agent\agent-coding\apps\agency\.env` |
| `agency-control-api` | 8002 | reserved | Agency Vite proxy config |
| `agency-dashboard` | 8080 | reserved | Agency scripts/docs |
| `ai-search-tool` | 8788 | reserved | AI search tool README |
| `agent-coding-accounting-engine` | 8844 | reserved | Accounting engine source/docs |
| `ollama-local` | 11434 | external | Local model dependency |

## Files Changed

| File | Change |
| --- | --- |
| `E:\Project\Master\PORT_REGISTRY.json` | Rewritten as registry source of truth and expanded with discovered ports. |
| `E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-background.ps1` | Added hidden/background starter with log + PID artifact output. |
| `E:\Project\Master\Agent\agent-coding-api-keys\start-proxy-win.bat` | Removed `node proxy.js` + `pause`; delegates to background PowerShell script. |
| `E:\Project\Master\Agent\agent-coding-api-keys\src\server.ts` | Added clean Windows port-conflict failure messaging. |
| `E:\Project\Master\validation-engine\runners\port-audit.js` | Added registry-based port/process health checker. |
| `E:\Project\Master\validation-engine\runners\api-proxy.js` | Fixed validation from old port `3001` to active port `3456`; uses background script and artifact log. |
| `E:\Project\Master\validation-engine\validation-registry.json` | Updated API proxy port/script; worker is no-port control-plane validation. |
| `E:\Project\Master\agent-os\COMMAND_REGISTRY.json` | `Start API Proxy` now points at `start-proxy-background.ps1`; raw shell whitelist updated. |
| `E:\Project\Master\agent-os\agent-worker\src\handlers\index.ts` | Script whitelist tightened to approved background PowerShell script. |
| `E:\Project\Master\agent-os\agent-worker\src\handlers\commands.ts` | Legacy start API proxy handler now calls background PowerShell script. |
| `E:\Project\Master\agent-os\agent-worker\src\handlers\commands.handler.ts` | Legacy task handler now calls background PowerShell script and reads artifact log. |

## Conflicts Found

| Port | Finding | Resolution |
| ---: | --- | --- |
| 3456 | Gateway was active, but PM2 ran `proxy.js`, which spawned a child `dist/server.js` with a visible Node window title. | Replaced PM2 process with direct `dist/server.js`; health OK; no Node main window title. |
| 3700 | PM2 wrapper command line hid script owner from initial validator. | `port-audit.js` now reads `pm2 jlist` and resolves wrapper PID to `agent-control`. |
| 3001 | Old validation config expected API proxy on 3001. | Updated to 3456. |
| 3002 | Old worker validator expected worker health listener on 3002. | Marked worker as no HTTP listener; validate via control plane. |

## Not Changed

Historical markdown and old validation JSON artifacts still mention previous ports/scripts. They are retained as history, not live config.

## Final Validation

```txt
node E:\Project\Master\validation-engine\runners\port-audit.js -> PASS
node E:\Project\Master\validation-engine\runners\api-proxy.js -> exitCode 0
GET http://127.0.0.1:3456/health -> 200 OK
Get-Process node MainWindowTitle -> all empty
```

