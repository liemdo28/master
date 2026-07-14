import crypto from 'crypto';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function normalize(value: unknown): JsonValue {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(item => normalize(item));
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('unsupported_non_finite_number');
    return value;
  }
  if (typeof value === 'object') {
    const out: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined) out[key] = normalize(child);
    }
    return out;
  }
  throw new Error(`unsupported_payload_type:${typeof value}`);
}

export function canonicalizeSeoPayload(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function hashCanonicalSeoPayload(value: unknown): string {
  return crypto.createHash('sha256').update(Buffer.from(canonicalizeSeoPayload(value), 'utf8')).digest('hex');
}
