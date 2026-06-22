/**
 * P0 Security Hotfix — Response Scrubber Middleware
 *
 * MUST be applied to EVERY chat/WhatsApp reply before it leaves the system.
 * Prevents secrets from reaching the CEO's phone or any external channel.
 *
 * Gate order (P0-3 Gate-First Architecture):
 *   User input → Intent classification → Permission validation
 *   → Secret removal from LLM context
 *   → LLM call
 *   → scrubReply() on output   ← THIS FILE
 *   → CEO / WhatsApp
 *
 * Usage:
 *   import { scrubReply, scrubChatResult } from '../middleware/response-scrubber';
 *   const safe = scrubReply(rawLlmOutput);
 *   const safeResult = scrubChatResult(result);
 */

import { redactSecrets, type RedactionResult } from '../bigdata/secret-redactor';

// ── Audit log (in-memory ring buffer, last 200 events) ───────────────────────

interface ScrubEvent {
  ts: number;
  patterns: string[];
  snippet: string;   // first 60 chars of what was redacted
  source: string;    // 'chat' | 'whatsapp' | 'jarvis'
}

const _auditRing: ScrubEvent[] = [];
const RING_MAX = 200;

function audit(event: ScrubEvent) {
  if (_auditRing.length >= RING_MAX) _auditRing.shift();
  _auditRing.push(event);
  // Always log to console — P0 events must be visible in PM2 logs
  console.error(`[P0-SCRUB] Redacted ${event.patterns.join(',')} from ${event.source}: "${event.snippet}"`);
}

export function getScrubAuditLog(): ScrubEvent[] {
  return [..._auditRing];
}

// ── Core scrub function ───────────────────────────────────────────────────────

/**
 * Scrub a reply string. Returns the safe version.
 * If any secrets were found, logs to audit ring and PM2 console.
 */
export function scrubReply(reply: string, source = 'unknown'): string {
  if (!reply || typeof reply !== 'string') return reply;

  const result: RedactionResult = redactSecrets(reply);
  if (!result.clean) {
    audit({
      ts: Date.now(),
      patterns: result.found,
      snippet: reply.slice(0, 60).replace(/\n/g, ' '),
      source,
    });
  }
  return result.redacted;
}

/**
 * Scrub a full chat result object (reply + any string fields that could leak).
 * Safe to call on any shape — only touches string values named 'reply' or 'message'.
 */
export function scrubChatResult<T extends { reply?: string; message?: string; error?: string }>(
  result: T,
  source = 'chat',
): T {
  return {
    ...result,
    reply:   result.reply   != null ? scrubReply(result.reply,   source) : result.reply,
    message: result.message != null ? scrubReply(result.message, source) : result.message,
    // Never scrub 'error' — errors must be readable for debugging, but don't contain secrets
  };
}

/**
 * Scrub LLM context BEFORE sending to LLM.
 * Prevents secrets from reaching the model in the first place (P0-3).
 */
export function scrubLlmContext(messages: Array<{ role: string; content: string }>, source = 'llm_context'): Array<{ role: string; content: string }> {
  return messages.map(m => ({
    ...m,
    content: scrubReply(m.content, source),
  }));
}

/**
 * Express middleware: scrubs res.json() output at the HTTP layer.
 * Wire as the LAST middleware before routes send responses.
 *
 * Usage in Express:
 *   app.use('/api/chat', responseScrubberMiddleware, chatRouter);
 *   app.use('/api/jarvis', responseScrubberMiddleware, jarvisRouter);
 */
export function responseScrubberMiddleware(
  _req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
): void {
  const originalJson = res.json.bind(res);

  res.json = function (body: unknown) {
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      if (typeof b['reply'] === 'string') {
        b['reply'] = scrubReply(b['reply'], 'http_middleware');
      }
      if (typeof b['message'] === 'string') {
        b['message'] = scrubReply(b['message'], 'http_middleware');
      }
    }
    return originalJson(body);
  };

  next();
}
