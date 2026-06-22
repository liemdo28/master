"""
Mi AI Service — Python FastAPI
Wraps Ollama with model routing, fallback, and future NLP/RAG expansion.
"""

import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Literal
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
FAST_MODEL = os.getenv("OLLAMA_FAST_MODEL", "qwen3:8b")
DEEP_MODEL = os.getenv("OLLAMA_DEEP_MODEL", "qwen3:14b")

app = FastAPI(title="Mi AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    stream: bool = False
    mode: str = "fast"  # fast | deep | coding


class ChatResponse(BaseModel):
    text: str
    model: str
    tokens_used: int | None = None


ROLE_PRIORITY = {
    "fast": [FAST_MODEL, "qwen2.5:7b", "llama3.2:3b", "phi3:mini", "mistral:7b"],
    "deep": [DEEP_MODEL, FAST_MODEL, "deepseek-r1:14b", "llama3.1:8b"],
    "coding": ["qwen2.5-coder:7b", "deepseek-coder-v2:16b", "codellama:7b", FAST_MODEL],
}

async def select_model(mode: str) -> str:
    """Auto-select best available model for role. Never hardcode missing model."""
    available = await get_available_models()
    candidates = ROLE_PRIORITY.get(mode, ROLE_PRIORITY["fast"])
    for candidate in candidates:
        base = candidate.split(":")[0]
        match = next((m for m in available if m == candidate or m.startswith(base + ":")), None)
        if match:
            return match
    # Last resort: first non-embed model
    non_embed = [m for m in available if "embed" not in m]
    if non_embed:
        return non_embed[0]
    raise HTTPException(status_code=503, detail="No Ollama models available. Run: ollama pull qwen3:8b")


async def get_available_models() -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            data = r.json()
            return [m["name"] for m in data.get("models", [])]
    except Exception:
        return []


async def call_ollama(messages: list[dict], model: str) -> dict:
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{OLLAMA_URL}/api/chat",
            json={"model": model, "messages": messages, "stream": False},
        )
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Ollama error: {r.text}")
        return r.json()


@app.get("/health")
async def health():
    models = await get_available_models()
    return {
        "status": "ok",
        "ollama_reachable": len(models) > 0,
        "available_models": models,
        "fast_model": FAST_MODEL,
        "deep_model": DEEP_MODEL,
        "fast_model_ready": FAST_MODEL in models,
        "deep_model_ready": DEEP_MODEL in models,
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    target_model = await select_model(req.mode)

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    result = await call_ollama(messages, target_model)

    text = result.get("message", {}).get("content", "")
    tokens = result.get("eval_count")

    return ChatResponse(text=text, model=target_model, tokens_used=tokens)


@app.get("/models")
async def list_models():
    return {"models": await get_available_models()}
