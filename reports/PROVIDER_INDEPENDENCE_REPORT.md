# Provider Independence Report

**Generated:** 2026-06-11

## Scope
Runtime verification of Mi-Core provider-router safety with missing provider credentials and unavailable local fallback.

## Provider Router Status

Implemented boundary:

- `providerRouter.generateText()`
- `providerRouter.generateEmbedding()`
- `providerRouter.vision()` boundary defined
- `providerRouter.transcribe()` boundary defined
- `providerRouter.rank()` boundary defined

## Safety Tests

### No Provider Keys

Request:

```json
{
  "messages": [{ "role": "user", "content": "Say OK only." }],
  "providers": ["openai-compatible"],
  "timeout_ms": 1000
}
```

Response:

```json
{
  "ok": false,
  "error": "Error: generateText failed across providers: OPENAI_COMPATIBLE_API_KEY not configured"
}
```

Result: pass. Missing keys fail clearly and do not crash the server.

### Fake Primary Provider Failure

OpenAI-compatible with no configured key fails before any network call with a clear missing-key error.

Result: pass.

### Fallback Provider Configured

Request attempted:

```json
{
  "providers": ["openai-compatible", "ollama"],
  "timeout_ms": 15000
}
```

Result: the OpenAI-compatible provider failed cleanly due missing key, then Ollama fallback timed out. Server returned JSON error and did not crash.

### Local / Offline Mode

Health and enterprise health endpoints do not call providers. Missing provider credentials do not prevent server startup or health reporting.

## Audit Log

Provider audit writes are implemented through `provider_call_audit`. Runtime verification of audit rows is blocked because Postgres is not reachable.

## Lock-In Assessment

No direct provider key is hardcoded. Provider adapters read keys from environment variables only. Chat and embedding paths now go through provider-router.

## Remaining Work

- Verify audit rows once Postgres is running.
- Configure a known local Ollama model and rerun fallback test with a larger timeout.
- Add Gemini, DeepSeek, and MiniMax native API adapters if OpenAI-compatible endpoints are not sufficient.
