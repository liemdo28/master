# Antigravity Universal AI Gateway — Architecture

> **Rule:** This repository is the gateway layer only.  
> Never modify `~/Projects/agent-coding/` — it is the IDE layer and is considered production-stable.

---

## 4-Layer Separation

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: IDE Layer                                          │
│  ~/Projects/agent-coding/                                    │
│  • Antigravity IDE (local-agent)                             │
│  • Stable, production-locked. NEVER modify.                  │
│  • Connects to gateway via env vars only.                    │
└───────────────────────┬──────────────────────────────────────┘
                        │  HTTP (env var: OPUSMAX_BASE_URL etc.)
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 2: Gateway Layer        localhost:3456                │
│  ~/Projects/agent-coding-api-keys/  ← THIS REPO             │
│  • Antigravity Universal AI Gateway                          │
│  • Protocol translation (Anthropic ↔ OpenAI)                │
│  • Real SSE streaming                                        │
│  • Tool-use normalization                                    │
│  • Structured logging                                        │
│  • Dashboard (/)                                             │
└───────────────────────┬──────────────────────────────────────┘
                        │
          ┌─────────────▼───────────────┐
┌─────────┴──────────┐   ┌─────────────┴──────────────────────┐
│  Layer 3: Protocol  │   │  Layer 3: Protocol                  │
│  src/protocols/     │   │  src/compatibility/                 │
│  • anthropic.ts     │   │  • tool-bridge.ts                   │
│  • openai.ts        │   │  • streaming-proxy.ts               │
│  • index.ts         │   │                                     │
└─────────┬──────────┘   └──────────────┬──────────────────────┘
          └──────────────┬──────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────┐
│  Layer 4: Provider Layer                                        │
│  src/providers/                                                 │
│  • AnthropicProvider  → api.anthropic.com / api.nkq.vn / ...   │
│  • OpenAICompatible   → opusmax.shop / openai.com / openrouter  │
│  • OllamaProvider     → localhost:11434                         │
└────────────────────────────────────────────────────────────────┘
```

---

## Gateway Source Layout

```
src/
├── server.ts              Entry point — HTTP server, route dispatch
│
├── protocols/             Protocol definitions & metadata
│   ├── anthropic.ts       Anthropic Messages API (re-exports adapter + metadata)
│   ├── openai.ts          OpenAI Chat Completions (re-exports adapter + metadata)
│   └── index.ts           detectInboundProtocol(), PROTOCOL_SUMMARY
│
├── registry/              Dynamic model capability registry
│   └── model-registry.ts  ModelRegistry, ModelEntry, registry singleton
│
├── streaming/             Streaming engine
│   └── engine.ts          dispatchStream(), SSE_HEADERS, re-exports proxy fns
│
├── tools/                 Tool orchestration layer
│   └── orchestrator.ts    validateTools(), checkModelToolSupport(), countToolCalls()
│
├── logging/               Structured request logger
│   └── request-logger.ts  JSON-lines to gateway.log, in-memory buffer
│
├── compatibility/         Low-level protocol bridging (stable)
│   ├── tool-bridge.ts     OpenAI↔Anthropic tool/message conversion
│   └── streaming-proxy.ts Real SSE parsing and transformation
│
├── adapters/              Wire-format adapters (stable, backward-compat)
│   ├── anthropic-adapter.ts
│   └── openai-adapter.ts
│
├── providers/             Upstream provider clients
│   ├── base-provider.ts        chat() + fetchStream() interface
│   ├── anthropic-provider.ts   Native Anthropic Messages API
│   ├── openai-compatible-provider.ts  OpenAI-format providers
│   ├── ollama-provider.ts      Ollama local models
│   └── provider-factory.ts     createProvider(config)
│
├── router/                Routing & fallback logic
│   └── provider-router.ts route() + routeStream()
│
├── health/                Provider health monitoring
│   └── health-manager.ts
│
├── models/                Model resolution
│   ├── capabilities.ts    Legacy capability check
│   └── model-resolver.ts  Alias → canonical model ID per provider
│
├── config/                Configuration loading
│   ├── config-loader.ts   loadGatewayConfig() — reads keys.json + env
│   └── defaults.ts        Default provider definitions
│
├── ui/                    Dashboard
│   └── dashboard.ts       HTML dashboard with live provider status & logs
│
├── utils/
│   └── http.ts            HTTP helpers (readJsonBody, sendJson, etc.)
│
└── types.ts               All shared TypeScript types
```

---

## IDE Integration (Zero IDE Code Changes)

Point the IDE at the gateway via environment variables only:

```bash
# Copy .env.gateway → ~/Projects/agent-coding/.env
# or export these in your shell:

export OPUSMAX_BASE_URL=http://127.0.0.1:3456/v1
export OPUSMAX_API_KEY=proxy
export ANTHROPIC_BASE_URL=http://127.0.0.1:3456
export ANTHROPIC_API_KEY=proxy
```

The IDE's `ProviderRouter.js` reads these env vars and connects to the gateway transparently. No IDE code changes are required in either direction.

---

## Protocol Translation Matrix

| Client sends    | Provider speaks | Transform applied                  |
|----------------|-----------------|------------------------------------|
| OpenAI format  | Anthropic       | `pipeAnthropicToOpenAIStream()`    |
| OpenAI format  | OpenAI-compat   | Pass-through                       |
| Anthropic format | Anthropic     | Pass-through                       |
| Anthropic format | OpenAI-compat | `pipeOpenAIToAnthropicStream()`    |

---

## Tool-Use Flow (Cline / Agentic Clients)

```
1. Client: POST /v1/chat/completions { tools: [OpenAI format] }
2. Gateway: openAIToolsToAnthropic() → { input_schema: ... }
3. Gateway: router.routeStream() → selects provider
4. AnthropicProvider: sends Anthropic-format request upstream
5. Upstream returns: tool_use content blocks in SSE
6. Gateway: pipeAnthropicToOpenAIStream() transforms in real time
7. Client receives: tool_calls chunks with finish_reason: "tool_calls"

Turn 2 (tool result):
1. Client: { role: "tool", tool_call_id: "toolu_xxx", content: "..." }
2. Gateway: openAIMessagesToUniversal() → { type: "tool_result", tool_use_id: "toolu_xxx" }
3. Sends to Anthropic upstream as Anthropic-native tool_result
4. Model answers → client receives final text response
```

---

## Compatible Clients

| Client          | Endpoint              | API Key | Model          |
|----------------|-----------------------|---------|----------------|
| Antigravity IDE | env var redirect      | proxy   | claude-opus-4-7 |
| Cline           | /v1 (OpenAI compat)   | proxy   | claude-opus-4-7 |
| Claude Code     | ANTHROPIC_BASE_URL    | real key| any claude     |
| RooCode         | /v1 (OpenAI compat)   | proxy   | claude-opus-4-7 |
| Continue        | /v1 (OpenAI compat)   | proxy   | claude-opus-4-7 |
| OpenCode        | /v1 (OpenAI compat)   | proxy   | claude-opus-4-7 |
| Cursor          | /v1 (OpenAI compat)   | proxy   | claude-opus-4-7 |

---

## Migration Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Complete | Gateway built, tool-use fixed, real streaming |
| 2 | ✅ Complete | Protocol layer, registry, logging, streaming engine |
| 3 | Ready | Connect IDE through .env.gateway (env var swap only) |
| 4 | Future | Add provider health validation tests |
| 5 | Future | Add fallback/orchestration rules per model family |
