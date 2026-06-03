/**
 * Antigravity Universal AI Gateway — Structured Request Logger
 *
 * Writes one JSON-line per request to gateway.log.
 * Captures: model, provider, protocol, streaming, tools, latency, status.
 * Rotates when file exceeds LOG_MAX_BYTES (default 10 MB).
 *
 * In-memory circular buffer (last 500 entries) for the dashboard's live view.
 */

import fs from 'node:fs';
import path from 'node:path';

const LOG_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const LOG_PATH = path.resolve(process.cwd(), 'gateway.log');
const BUFFER_MAX = 500;

// Patterns that look like API keys — never log these
const KEY_PATTERNS = [
  /\bsk[-_][A-Za-z0-9_-]{20,}\b/g,
  /\bAGOP-[A-F0-9-]{10,}\b/gi,
  /Bearer\s+[A-Za-z0-9._~+/-]{20,}/g,
  /x-api-key["\s:]+[A-Za-z0-9._~+/-]{20,}/gi,
];

function redactSecrets(text: string): string {
  let out = text;
  for (const pattern of KEY_PATTERNS) out = out.replace(pattern, '[REDACTED]');
  return out;
}

export interface RequestLogEntry {
  ts: string;
  // Request
  requestId: string;
  endpoint: 'openai' | 'anthropic' | 'embeddings' | 'other';
  model: string;
  streaming: boolean;
  toolsRequested: boolean;
  toolCount: number;
  inputMessages: number;
  // Routing
  provider: string | null;
  providerKind: string | null;
  resolvedModel: string | null;
  attempts: number;
  fallbacks: number;
  // Response
  status: 'ok' | 'error' | 'stream';
  finishReason: string | null;
  toolCallsReturned: number;
  inputTokens: number;
  outputTokens: number;
  // Performance
  durationMs: number;
  // Error
  error: string | null;
}

const buffer: RequestLogEntry[] = [];

function rotate(): void {
  try {
    if (!fs.existsSync(LOG_PATH)) return;
    const stat = fs.statSync(LOG_PATH);
    if (stat.size > LOG_MAX_BYTES) {
      const archive = LOG_PATH + '.1';
      if (fs.existsSync(archive)) fs.unlinkSync(archive);
      fs.renameSync(LOG_PATH, archive);
    }
  } catch { /* non-fatal */ }
}

function persist(entry: RequestLogEntry): void {
  try {
    rotate();
    const line = redactSecrets(JSON.stringify(entry));
    fs.appendFileSync(LOG_PATH, line + '\n', 'utf8');
  } catch { /* non-fatal — logging must never crash the gateway */ }
}

export function logRequest(entry: RequestLogEntry): void {
  // In-memory buffer for dashboard
  buffer.push(entry);
  if (buffer.length > BUFFER_MAX) buffer.shift();
  // Persist to disk
  persist(entry);
}

export function getRecentLogs(count = 200): RequestLogEntry[] {
  return buffer.slice(-count).reverse();
}

export function getLogStats() {
  const total = buffer.length;
  const errors = buffer.filter((e) => e.status === 'error').length;
  const toolRequests = buffer.filter((e) => e.toolsRequested).length;
  const streams = buffer.filter((e) => e.streaming).length;
  const byProvider = new Map<string, number>();
  for (const e of buffer) {
    if (e.provider) byProvider.set(e.provider, (byProvider.get(e.provider) ?? 0) + 1);
  }
  const avgLatency = total
    ? Math.round(buffer.reduce((s, e) => s + e.durationMs, 0) / total)
    : 0;
  return { total, errors, toolRequests, streams, avgLatency, byProvider: Object.fromEntries(byProvider) };
}

/** Build a partial log entry at request start; complete it with finalize(). */
export function startLog(opts: {
  endpoint: RequestLogEntry['endpoint'];
  model: string;
  streaming: boolean;
  toolCount: number;
  inputMessages: number;
}): { requestId: string; t0: number } {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return { requestId, t0: Date.now() };
}

export function finalizeLog(
  requestId: string,
  t0: number,
  partial: {
    endpoint: RequestLogEntry['endpoint'];
    model: string;
    streaming: boolean;
    toolCount: number;
    inputMessages: number;
  },
  result: Partial<RequestLogEntry>,
): void {
  const entry: RequestLogEntry = {
    ts: new Date().toISOString(),
    requestId,
    ...partial,
    toolsRequested: partial.toolCount > 0,
    provider: null,
    providerKind: null,
    resolvedModel: null,
    attempts: 1,
    fallbacks: 0,
    status: 'ok',
    finishReason: null,
    toolCallsReturned: 0,
    inputTokens: 0,
    outputTokens: 0,
    durationMs: Date.now() - t0,
    error: null,
    ...result,
  };
  logRequest(entry);
}
