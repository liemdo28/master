/**
 * Calls Python AI service (FastAPI) which wraps Ollama.
 * Falls back to direct Ollama if Python service is down.
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:4002';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiResponse {
  text: string;
  model: string;
  source: 'python-service' | 'ollama-direct';
}

async function callPythonService(messages: ChatMessage[], stream = false): Promise<AiResponse> {
  const res = await fetch(`${AI_SERVICE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, stream }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`AI service error: ${res.status}`);
  const data = await res.json() as { text: string; model: string };
  return { text: data.text, model: data.model, source: 'python-service' };
}

async function callOllamaDirect(messages: ChatMessage[]): Promise<AiResponse> {
  const model = process.env.OLLAMA_FAST_MODEL || 'qwen3:8b';
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json() as { message: { content: string } };
  return { text: data.message.content, model, source: 'ollama-direct' };
}

export async function askAi(messages: ChatMessage[]): Promise<AiResponse> {
  try {
    return await callPythonService(messages);
  } catch {
    console.warn('[Mi] Python AI service unavailable, falling back to Ollama direct');
    return await callOllamaDirect(messages);
  }
}
