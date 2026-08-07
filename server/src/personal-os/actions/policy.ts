import { createHash } from 'crypto';
import type { ActionPreview, ActionRiskClass, ActionType } from './types';

export const PHASE5F_SCHEMA_VERSION = 7;

export const ALLOWED_EXECUTION_RISKS = new Set<ActionRiskClass>(['R1', 'R2', 'R3']);

const RISK_BY_ACTION: Record<ActionType, ActionRiskClass> = {
  GMAIL_CREATE_DRAFT: 'R2',
  GMAIL_SEND_DRAFT: 'R3',
  CALENDAR_EVENT_PROPOSAL: 'R1',
  CALENDAR_CREATE_EVENT: 'R3',
  LOCAL_TASK_DRAFT: 'R1',
  LOCAL_STATE_UPDATE: 'R1',
  CODING_TASK_APPROVAL: 'R1',
};

export function riskForAction(actionType: ActionType): ActionRiskClass {
  return RISK_BY_ACTION[actionType] ?? 'R4';
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function payloadHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function shortHash(hash: string): string {
  return hash.slice(0, 12);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function assertPlainPayload(input: unknown): void {
  if (!input || typeof input !== 'object') return;
  const stack = [input as Record<string, unknown>];
  while (stack.length) {
    const current = stack.pop()!;
    for (const key of Object.keys(current)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error('prototype pollution keys are not allowed');
      }
      const value = current[key];
      if (value && typeof value === 'object') stack.push(value as Record<string, unknown>);
    }
  }
}

export function sanitizeText(value: string, max = 8000): string {
  const trimmed = String(value ?? '').replace(/\r\n/g, '\n').trim();
  if (!trimmed) throw new Error('required text is empty');
  if (trimmed.length > max) throw new Error('payload text is too large');
  rejectSecret(trimmed);
  return trimmed
    .replace(/ignore previous instructions|system prompt|developer message/gi, '[untrusted-instruction]')
    .replace(/BEGIN (RSA|OPENSSH|PRIVATE) KEY[\s\S]*?END \1 KEY/gi, '[REDACTED_SECRET]')
    .replace(/bearer\s+[A-Za-z0-9._-]{20,}/gi, 'bearer [REDACTED_SECRET]')
    .replace(/(password|token|api[_-]?key)\s*=\s*\S+/gi, '$1=[REDACTED_SECRET]')
    .replace(/(postgres|mysql|mongodb(\+srv)?):\/\/\S+/gi, '[REDACTED_CONNECTION_STRING]');
}

export function rejectSecret(value: string): void {
  if (/(BEGIN (RSA|OPENSSH|PRIVATE) KEY|bearer\s+[A-Za-z0-9._-]{20,}|sk-[A-Za-z0-9]{20,}|password\s*=|token\s*=|api[_-]?key\s*=|postgres:\/\/|mysql:\/\/|mongodb(\+srv)?:\/\/|\.env\s*(contents|file)?)/i.test(value)) {
    throw new Error('secret-bearing payloads are not allowed in controlled actions');
  }
}

export function assertEmail(value: string): string {
  const email = sanitizeText(value, 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`invalid email recipient: ${value}`);
  return email;
}

export function assertDateTime(value: string, label: string): string {
  const text = sanitizeText(value, 80);
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) throw new Error(`${label} must be an ISO datetime`);
  return text;
}

export function textPreview(kind: ActionPreview['kind'], fields: ActionPreview['fields']): ActionPreview {
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value ?? ''}`);
  return { kind, fields, text: lines.join('\n') };
}
