# PM2 Runtime Source Audit

Audit timestamp: 2026-06-15 21:38 Asia/Saigon

## Build

Command:

```text
npm run build
```

Result:

```text
PASS
```

Note: build was initially blocked by unrelated strict TypeScript catch-variable errors in `server/src/operations/connector-live-probes.ts`. Those were fixed with typed error normalization.

## PM2 Runtime

Mi-Core:

```json
{
  "name": "mi-core",
  "status": "online",
  "pid": 36824,
  "restarts": 3,
  "pm_exec_path": "e:\\Project\\Master\\mi-core\\server\\dist\\index.js",
  "pm_cwd": "e:\\Project\\Master\\mi-core"
}
```

WhatsApp Gateway:

```json
{
  "name": "whatsapp-ai-gateway",
  "status": "online",
  "pid": 420,
  "restarts": 0,
  "pm_exec_path": "E:\\Project\\Master\\whatsapp-ai-gateway\\src\\index.js",
  "pm_cwd": "E:\\Project\\Master\\whatsapp-ai-gateway"
}
```

## Runtime Config Evidence

Runtime config check:

```json
{
  "whatsapp-ai-gateway_has_MI_CORE_API_KEY": false,
  "mi-core_has_MI_PIN": false,
  "mi-core_has_MI_PIN_HASH": false
}
```

Impact:

- Gateway source points to `/api/whatsapp/mi`.
- Gateway runtime cannot authenticate to Mi-Core because `MI_CORE_API_KEY` is missing.
- Direct `/api/chat` returned `401 Unauthorized` and could not be tested with token because raw PIN was unavailable in PM2 env.

## Verdict

Mi-Core is running compiled `server/dist/index.js` after rebuild/restart.

Real WhatsApp runtime path is blocked by missing gateway API key configuration.
