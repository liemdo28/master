# Universal AI Provider Manager

Local AI gateway for Claude Code-compatible tools, Cline, OpenCode, Cursor,
Continue, RooCode, and any OpenAI-compatible client.

## Why this exists

Claude Code validates model names before a custom upstream provider can handle
them. That is why models such as `claude-opus-4-6` or `claude-opus-4-7` can fail
inside the Claude Code provider even when a third-party provider supports the
alias.

Use this gateway through an OpenAI-compatible client profile instead:

```txt
API Provider: OpenAI Compatible
Base URL: http://localhost:3456/v1
API Key: proxy
Model: claude-opus-4-7
```

The gateway then resolves aliases, routes to the best provider, and fails over
without changing the client UI.

## Commands

```bash
npm install
npm run build
npm start
```

Dashboard:

```txt
http://localhost:3456
```

Health:

```txt
http://localhost:3456/health
```

## Provider config

Secrets can stay in local `keys.json`, or in `.env`. Do not commit real keys.
The legacy `keys.json` format is still supported:

```json
{
  "activeProviders": ["opusmax", "antigravity"],
  "mode": "fallback",
  "providers": {
    "opusmax": {
      "baseURL": "https://opusmax.shop/v1",
      "model": "claude-opus-4-7",
      "keys": [{ "value": "YOUR_KEY", "active": true }]
    }
  }
}
```

## Supported endpoints

```txt
GET  /
GET  /health
GET  /api/status
GET  /api/logs
GET  /v1/models
POST /v1/chat/completions
POST /v1/messages
```

`/v1/chat/completions` is the recommended compatibility layer for Cline,
OpenCode, Cursor, Continue, and RooCode.

## Architecture

```txt
src/
├── adapters/      # OpenAI and Anthropic compatibility transforms
├── config/        # env + keys.json loader, defaults, schema normalization
├── health/        # provider health/model discovery
├── models/        # alias resolver and provider-specific model mapping
├── providers/     # pluggable provider implementations
├── router/        # fallback, round-robin, latency routing
├── ui/            # local dashboard
└── server.ts      # gateway API
```

## Model alias behavior

All IDEs send a single canonical model ID: `claude-opus-4-7`. The gateway translates
this transparently per provider before the outbound request — NKQ receives `claude-opus-4`,
OpusMax receives its API-native form. IDE config never needs to change.
