/**
 * Structured LLM Caller — Phase 21
 *
 * Wraps the existing Ollama provider to add JSON schema enforcement.
 * Uses Ollama's `format` parameter for structured output when available.
 * Falls back to prompt-based JSON extraction if schema enforcement fails.
 */

import { getModelForRole, getOllamaBaseUrl } from './model-router';
import { ExecutiveModelRole } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StructuredLLMOptions {
  role: ExecutiveModelRole;
  schema?: Record<string, unknown>;    // JSON Schema for structured output
  systemPrompt: string;
  userContent: string;
  temperature?: number;
  timeoutMs?: number;
}

export interface StructuredLLMResult<T = Record<string, unknown>> {
  data: T;
  model: string;
  provider: string;
  latencyMs: number;
  raw?: string;  // raw response text if parsing was needed
}

// ── JSON Schema extraction helper ─────────────────────────────────────────────

/**
 * Extract the "properties" subset from a JSON Schema to pass to Ollama's `format` parameter.
 * Ollama expects a flat object schema (not full JSON Schema with $id, required, etc.).
 */
function extractOllamaFormat(schema: Record<string, unknown>): Record<string, unknown> {
  // Ollama's format parameter accepts a JSON object that defines the expected structure.
  // We pass the full schema and let Ollama handle it.
  return schema;
}

// ── JSON extraction from unstructured text ─────────────────────────────────────

function extractJSON(text: string): Record<string, unknown> | null {
  // Try to find JSON in the response
  // 1. Try parsing the entire response as JSON
  try {
    return JSON.parse(text);
  } catch { /* continue */ }

  // 2. Try to find JSON object in the response (between first { and last })
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch { /* continue */ }
  }

  // 3. Try to find JSON array
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      const arr = JSON.parse(text.slice(firstBracket, lastBracket + 1));
      return Array.isArray(arr) ? { items: arr } : null;
    } catch { /* continue */ }
  }

  return null;
}

// ── Ollama caller ─────────────────────────────────────────────────────────────

async function callOllama(
  model: string,
  systemPrompt: string,
  userContent: string,
  format?: Record<string, unknown>,
  temperature: number = 0.4,
  timeoutMs: number = 60000,
): Promise<string> {
  const baseUrl = getOllamaBaseUrl();

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    stream: false,
    options: {
      temperature,
      num_predict: 2048,
    },
  };

  // Add structured output format if schema is provided
  if (format) {
    body.format = extractOllamaFormat(format);
  }

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    throw new Error(`Ollama API error ${res.status}: ${errText}`);
  }

  const data = await res.json() as { message?: { content?: string }; response?: string };
  return data.message?.content || data.response || '';
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Call LLM with structured output enforcement.
 *
 * Strategy:
 * 1. If schema is provided, use Ollama's `format` parameter for native structured output
 * 2. If that fails or returns invalid JSON, try prompt-based extraction
 * 3. If all parsing fails, throw with the raw response for debugging
 */
export async function callStructuredLLM<T = Record<string, unknown>>(
  options: StructuredLLMOptions,
): Promise<StructuredLLMResult<T>> {
  const {
    role,
    schema,
    systemPrompt,
    userContent,
    temperature = 0.4,
    timeoutMs = 60000,
  } = options;

  const model = getModelForRole(role);
  const startTime = Date.now();
  let raw: string | undefined;

  try {
    // Attempt 1: Structured output via Ollama format parameter
    if (schema) {
      const response = await callOllama(model, systemPrompt, userContent, schema, temperature, timeoutMs);
      raw = response;

      const parsed = extractJSON(response);
      if (parsed) {
        return {
          data: parsed as T,
          model,
          provider: 'ollama',
          latencyMs: Date.now() - startTime,
          raw,
        };
      }
    }

    // Attempt 2: Without format parameter, add JSON instruction to prompt
    const jsonPrompt = `${systemPrompt}\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no explanation, just the JSON object.`;
    const response = await callOllama(model, jsonPrompt, userContent, undefined, temperature, timeoutMs);
    raw = response;

    const parsed = extractJSON(response);
    if (parsed) {
      return {
        data: parsed as T,
        model,
        provider: 'ollama',
        latencyMs: Date.now() - startTime,
        raw,
      };
    }

    // Attempt 3: All parsing failed — return raw as error context
    throw new Error(`Failed to parse JSON from LLM response. Raw: ${response.slice(0, 500)}`);

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    if (error instanceof Error && error.message.startsWith('Failed to parse')) {
      throw error;
    }
    throw new Error(`Structured LLM call failed (${model}, ${latencyMs}ms): ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Simple text generation without schema enforcement.
 * Useful for formatting, summaries, and non-structured outputs.
 */
export async function callLLMText(
  role: ExecutiveModelRole,
  systemPrompt: string,
  userContent: string,
  temperature: number = 0.5,
  timeoutMs: number = 60000,
): Promise<{ text: string; model: string; latencyMs: number }> {
  const model = getModelForRole(role);
  const startTime = Date.now();

  const text = await callOllama(model, systemPrompt, userContent, undefined, temperature, timeoutMs);

  return {
    text,
    model,
    latencyMs: Date.now() - startTime,
  };
}
