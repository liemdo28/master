# Ollama — Local LLM Deployment

## Models for Mi Ultimate
- qwen3:8b — Fast chat, reasoning
- qwen3:14b — Deep reasoning, complex tasks
- qwen2.5-coder:7b — Code generation
- nomic-embed-text — Embeddings for RAG

## Commands
```bash
ollama pull qwen3:8b
ollama list
ollama run qwen3:8b
ollama serve  # Start API on :11434
```

## API
- POST /api/chat — Chat completion
- POST /api/generate — Text generation
- GET /api/tags — List models

## RAG Pattern
1. Chunk documents (500-1000 tokens)
2. Embed with nomic-embed-text
3. Store in vector DB
4. Query: embed question → find similar chunks → inject into prompt