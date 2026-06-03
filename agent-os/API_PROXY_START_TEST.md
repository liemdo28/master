# API Proxy Start Test

Generated: 2026-06-02 05:07 +07:00

Status: PASS

Canonical artifact:

```txt
E:\Project\Master\artifact-registry\api-proxy\API_PROXY_START_TEST.md
```

Summary:

- API gateway is active on `127.0.0.1:3456`.
- PM2 `antigravity-gateway` now runs `dist/server.js` directly.
- Agent OS `Start API Proxy` routes to `start-proxy-background.ps1`.
- Background starter writes:
  - `E:\Project\Master\artifact-registry\logs\api-proxy.log`
  - `E:\Project\Master\artifact-registry\executions\api-proxy.pid`
- No duplicate process was created during startup test.
- Node window audit shows all `node.exe` `MainWindowTitle` values empty.

Validation:

```txt
node E:\Project\Master\validation-engine\runners\api-proxy.js -> exitCode 0
node E:\Project\Master\validation-engine\runners\port-audit.js -> PASS
```
