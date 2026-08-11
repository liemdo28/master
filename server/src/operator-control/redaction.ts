const SECRET_KEY = /(secret|token|password|api[_-]?key|authorization|cookie|private[_-]?key|credential|session)/i;
const SECRET_VALUE = /(bearer\s+[a-z0-9._-]+|sk-[a-z0-9]{12,}|xox[baprs]-[a-z0-9-]+|gh[pousr]_[a-z0-9_]+|AIza[0-9A-Za-z_-]{20,})/i;

export function sanitizeText(input: unknown, max = 500): string {
  const raw = typeof input === 'string' ? input : input == null ? '' : JSON.stringify(input);
  return raw.replace(SECRET_VALUE, '[redacted]').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function sanitizeRecord(input: Record<string, unknown>, maxFields = 12): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input).slice(0, maxFields)) {
    out[key] = SECRET_KEY.test(key) ? '[redacted]' : sanitizeText(value, 160);
  }
  return out;
}

export function hasSecretLeak(value: unknown): boolean {
  return SECRET_VALUE.test(JSON.stringify(value));
}
