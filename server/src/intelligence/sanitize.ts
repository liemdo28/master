/**
 * Phase 5C external-content trust boundary.
 *
 * Everything arriving from Gmail or Calendar is attacker-controlled: anyone who knows
 * the owner's address can put text in front of Mi. Nothing in this file interprets that
 * text as instructions — it only strips, neutralises and bounds it.
 */

import { createHash } from 'crypto';
import type { ContextSensitivity } from './types';

export const MAX_BODY_BYTES = 16_000;
export const MAX_SUMMARY_CHARS = 1_200;
export const MAX_SUBJECT_CHARS = 300;
export const MAX_ATTACHMENTS = 20;
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Attachment types Mi will not even record as actionable. Metadata only, never fetched. */
const DANGEROUS_ATTACHMENT_EXTENSIONS = new Set([
  '.exe', '.scr', '.bat', '.cmd', '.com', '.pif', '.msi', '.vbs', '.js', '.jse',
  '.wsf', '.wsh', '.ps1', '.jar', '.hta', '.dll', '.lnk', '.reg',
]);

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/gi, '[REDACTED_PRIVATE_KEY]'],
  [/\bbearer\s+[A-Za-z0-9._\-]{20,}/gi, 'bearer [REDACTED_SECRET]'],
  [/\bsk-[A-Za-z0-9]{20,}\b/gi, '[REDACTED_SECRET]'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/gi, '[REDACTED_SECRET]'],
  [/\bya29\.[A-Za-z0-9._\-]{20,}\b/gi, '[REDACTED_SECRET]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED_SECRET]'],
  [/\b(password|passwd|token|api[_-]?key|secret|client[_-]?secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED_SECRET]'],
  [/\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp)::?\/\/\S+/gi, '[REDACTED_CONNECTION_STRING]'],
  [/\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/\S+/gi, '[REDACTED_CONNECTION_STRING]'],
];

/**
 * Phrases that try to steer the model. They are neutralised in place rather than
 * dropped, so a human reading the summary can still see that someone tried.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+)?(?:the\s+)?previous\s+instructions?/gi,
  /ignore\s+(?:all\s+)?(?:prior|above|earlier)\s+instructions?/gi,
  /disregard\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|prompts?)/gi,
  /system\s+prompt/gi,
  /developer\s+message/gi,
  /you\s+are\s+now\s+(?:a|an|in)\b/gi,
  /\bnew\s+instructions?\s*:/gi,
  /<\s*\|?\s*(?:im_start|im_end|system|assistant)\s*\|?\s*>/gi,
  /\[\s*(?:system|assistant)\s*\]/gi,
  /reveal\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions|secrets?)/gi,
  /send\s+(?:me\s+)?(?:the\s+)?(?:credentials?|password|api[_-]?key|token)/gi,
  /delete\s+(?:this|the)\s+(?:email|message|thread)/gi,
];

export function stripHtml(input: string): string {
  return input
    // Whole elements whose content must never survive.
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<head\b[\s\S]*?<\/head\s*>/gi, ' ')
    .replace(/<iframe\b[\s\S]*?<\/iframe\s*>/gi, ' ')
    .replace(/<object\b[\s\S]*?<\/object\s*>/gi, ' ')
    .replace(/<embed\b[^>]*>/gi, ' ')
    // Tracking pixels and remote images: 1x1 beacons and anything else.
    .replace(/<img\b[^>]*>/gi, ' ')
    // HTML comments frequently hide injected instructions.
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Anything else that looks like markup.
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Drop quoted reply history so injected text hiding below the fold cannot reach Mi. */
export function trimQuotedHistory(input: string): string {
  const lines = input.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break;
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
    if (/^\s*_{5,}\s*$/.test(line)) break;
    if (/^\s*On .{4,80}\bwrote:\s*$/i.test(line)) break;
    if (/^\s*From:\s*.+<.+@.+>/i.test(line) && out.length > 0) break;
    out.push(line);
  }
  return out.join('\n').trim();
}

export function redactSecrets(input: string): string {
  let value = input;
  for (const [pattern, replacement] of SECRET_PATTERNS) value = value.replace(pattern, replacement);
  return value;
}

export function neutraliseInjection(input: string): string {
  let value = input;
  for (const pattern of INJECTION_PATTERNS) value = value.replace(pattern, '[untrusted-instruction]');
  return value;
}

export function containsSecret(input: string): boolean {
  return redactSecrets(input) !== input;
}

export function containsInjectionAttempt(input: string): boolean {
  return INJECTION_PATTERNS.some(p => { p.lastIndex = 0; return p.test(input); });
}

export interface SanitisedText {
  text: string;
  truncated: boolean;
  secretRedacted: boolean;
  injectionNeutralised: boolean;
  sensitivity: ContextSensitivity;
}

/**
 * The single entry point for turning untrusted external text into something Mi may
 * summarise. Order matters: strip markup first so instructions hidden inside
 * attributes or comments cannot survive, then redact, then neutralise, then bound.
 */
export function sanitiseExternalText(raw: string, maxChars = MAX_SUMMARY_CHARS): SanitisedText {
  const input = typeof raw === 'string' ? raw : '';
  const oversized = Buffer.byteLength(input, 'utf8') > MAX_BODY_BYTES;
  const bounded = oversized ? input.slice(0, MAX_BODY_BYTES) : input;

  const stripped = trimQuotedHistory(stripHtml(bounded));
  const secretRedacted = containsSecret(stripped);
  const injectionNeutralised = containsInjectionAttempt(stripped);
  let text = neutraliseInjection(redactSecrets(stripped));

  const truncated = oversized || text.length > maxChars;
  if (text.length > maxChars) text = text.slice(0, maxChars).trimEnd() + '…';

  return {
    text,
    truncated,
    secretRedacted,
    injectionNeutralised,
    sensitivity: secretRedacted ? 'SECRET_REDACTED' : injectionNeutralised ? 'PRIVATE' : 'INTERNAL',
  };
}

export function sanitiseSubject(raw: string): string {
  return sanitiseExternalText(raw || '(no subject)', MAX_SUBJECT_CHARS).text || '(no subject)';
}

export function isDangerousAttachment(filename: string): boolean {
  const lower = (filename || '').toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot >= 0 && DANGEROUS_ATTACHMENT_EXTENSIONS.has(lower.slice(dot));
}

export function evidenceHash(parts: unknown): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16);
}

/** Email addresses are PII; evidence references carry an opaque digest, not the address. */
export function evidenceReference(kind: 'email' | 'calendar', id: string): string {
  return `${kind}:${evidenceHash(id)}`;
}
