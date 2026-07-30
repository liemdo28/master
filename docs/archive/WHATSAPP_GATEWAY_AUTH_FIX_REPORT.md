# WhatsApp Gateway Auth Fix Report

Timestamp: 2026-06-15 21:45 Asia/Saigon

## Problem

Real gateway forwarding to Mi-Core failed with:

```json
{
  "statusCode": 401,
  "error": "HTTP 401",
  "response_body": {
    "ok": false,
    "error": "MISSING_API_KEY"
  }
}
```

Root cause:

- Mi-Core had a configured WhatsApp client hash.
- `whatsapp-ai-gateway` PM2 runtime had no usable `MI_CORE_API_KEY`.
- Gateway forwarder only relied on `process.env.MI_CORE_API_KEY`.

## Fix Applied

1. Generated a new Mi-Core gateway API key.
2. Stored only the salted hash in:

```text
E:\Project\Master\.local-agent-global\mi-core\whatsapp-client.json
```

3. Added the raw key to:

```text
E:\Project\Master\whatsapp-ai-gateway\.env
```

4. Patched gateway outbound HTTP in:

```text
E:\Project\Master\whatsapp-ai-gateway\src\forwarding\agent-mi-forwarder.js
```

Gateway now sends:

```text
X-API-Key: <MI_CORE_API_KEY>
```

and still includes the redacted body `api_key` field for backward compatibility.

5. Restarted gateway:

```text
pm2 restart whatsapp-ai-gateway --update-env
```

## Runtime Verification

Gateway PM2:

```json
{
  "name": "whatsapp-ai-gateway",
  "status": "online",
  "pid": 25244,
  "restarts": 1,
  "pm_exec_path": "E:\\Project\\Master\\whatsapp-ai-gateway\\src\\index.js"
}
```

Mi-Core PM2:

```json
{
  "name": "mi-core",
  "status": "online",
  "pid": 36824,
  "restarts": 3,
  "pm_exec_path": "e:\\Project\\Master\\mi-core\\server\\dist\\index.js"
}
```

Gateway status endpoint confirms:

```json
{
  "mi_core_api_key": {
    "configured": true,
    "prefix": "mi-core-...",
    "length": 72
  }
}
```

## Header Verification

Captured outbound gateway request:

```json
{
  "outbound_has_x_api_key": true,
  "x_api_key_length": 72,
  "body_has_api_key": true
}
```

## Mi-Core Acceptance Verification

Direct Mi-Core request using `X-API-Key` returned:

```json
{
  "status": 200,
  "missing_api_key": false,
  "approval_required": true,
  "approval_id": "APPR-mqfbmr3x-000",
  "workflow_id": "SEO-CONTENT-20260615-995",
  "source": "execution-engine"
}
```

## Verdict

`401 MISSING_API_KEY` is fixed for Gateway → Mi-Core forwarding.
