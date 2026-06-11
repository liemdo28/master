# Phase 3 Provider Router

## Implemented
- Added `server/src/providers/provider-router.ts`.
- Exposed `providerRouter.generateText()` and `providerRouter.generateEmbedding()`.
- Defined boundaries for `vision()`, `transcribe()`, and `rank()`.
- Added provider call audit table.
- Routed chat compatibility wrapper and embeddings through the provider router.

## Supported Providers
OpenAI-compatible, OpenAI, Anthropic, Gemini, DeepSeek, MiniMax, and Ollama are represented in routing order. Text calls support Anthropic, Ollama, and OpenAI-compatible adapters. Embeddings support Ollama and OpenAI-compatible adapters.

## Fallback Rule
Primary -> retry via ordered provider list -> secondary -> local Ollama.
