/**
 * Secret Redactor — Phase 8
 * Detects and redacts credentials/secrets before any data is stored or indexed.
 * NEVER store raw secrets in MinIO, PostgreSQL, or Qdrant.
 */

export interface RedactionResult {
  redacted: string;
  found: string[];
  clean: boolean;
}

const PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  // API key prefixes
  { name: 'openai_key',     pattern: /sk-[A-Za-z0-9\-_]{20,}/g,              replacement: '[REDACTED:openai_key]' },
  { name: 'github_pat',     pattern: /ghp_[A-Za-z0-9]{36}/g,                 replacement: '[REDACTED:github_pat]' },
  { name: 'slack_bot',      pattern: /xoxb-[A-Za-z0-9\-]{50,}/g,             replacement: '[REDACTED:slack_bot]' },
  { name: 'slack_user',     pattern: /xoxp-[A-Za-z0-9\-]{50,}/g,             replacement: '[REDACTED:slack_user]' },
  { name: 'anthropic_key',  pattern: /sk-ant-[A-Za-z0-9\-_]{40,}/g,          replacement: '[REDACTED:anthropic_key]' },
  { name: 'aws_access',     pattern: /AKIA[A-Z0-9]{16}/g,                     replacement: '[REDACTED:aws_access_key]' },
  { name: 'aws_secret',     pattern: /(?<=[^A-Za-z0-9])[A-Za-z0-9/+]{40}(?=[^A-Za-z0-9=])/g, replacement: '[REDACTED:aws_secret]' },
  { name: 'stripe_key',     pattern: /sk_(?:live|test)_[A-Za-z0-9]{24,}/g,   replacement: '[REDACTED:stripe_key]' },
  { name: 'stripe_rk',      pattern: /rk_(?:live|test)_[A-Za-z0-9]{24,}/g,   replacement: '[REDACTED:stripe_rk]' },
  // Generic patterns
  { name: 'password_kv',    pattern: /(?:password|passwd|pwd)\s*[=:]\s*["']?[^\s"',;]{6,}["']?/gi, replacement: '[REDACTED:password]' },
  { name: 'token_kv',       pattern: /(?:token|access_token|refresh_token|id_token)\s*[=:]\s*["']?[A-Za-z0-9\-_.]{20,}["']?/gi, replacement: '[REDACTED:token]' },
  { name: 'api_key_kv',     pattern: /(?:api_key|apikey|api-key)\s*[=:]\s*["']?[A-Za-z0-9\-_.]{10,}["']?/gi, replacement: '[REDACTED:api_key]' },
  { name: 'secret_kv',      pattern: /(?:secret|client_secret|app_secret)\s*[=:]\s*["']?[A-Za-z0-9\-_.]{8,}["']?/gi, replacement: '[REDACTED:secret]' },
  { name: 'auth_bearer',    pattern: /authorization\s*:\s*bearer\s+[A-Za-z0-9\-_.]{20,}/gi, replacement: '[REDACTED:auth_bearer]' },
  { name: 'auth_basic',     pattern: /authorization\s*:\s*basic\s+[A-Za-z0-9+/=]{10,}/gi,  replacement: '[REDACTED:auth_basic]' },
  { name: 'private_key',    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, replacement: '[REDACTED:private_key_block]' },
  { name: 'cert_block',     pattern: /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, replacement: '[REDACTED:certificate_block]' },
  // OAuth / Google
  { name: 'google_client',  pattern: /[0-9]+-[A-Za-z0-9_]+\.apps\.googleusercontent\.com/g, replacement: '[REDACTED:google_client_id]' },
  { name: 'google_refresh', pattern: /1\/\/[A-Za-z0-9\-_]{40,}/g,            replacement: '[REDACTED:google_refresh_token]' },
  // .env style
  { name: 'dotenv_secret',  pattern: /^(?:DB_PASSWORD|POSTGRES_PASSWORD|MINIO_ROOT_PASSWORD|REDIS_PASSWORD|SECRET_KEY|ENCRYPTION_KEY|JWT_SECRET)=.+$/gim, replacement: '[REDACTED:env_secret]' },
];

const BLOCKED_FILENAMES = [
  '.env', '.env.local', '.env.production', '.env.staging',
  'google-tokens.json', 'credentials.json', 'service-account.json',
  'id_rsa', 'id_ed25519', 'id_ecdsa',
  'private_key.pem', 'private.key', 'cert.pem',
];

export function redactSecrets(text: string): RedactionResult {
  let result = text;
  const found: string[] = [];

  for (const { name, pattern, replacement } of PATTERNS) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) found.push(name);
  }

  return { redacted: result, found, clean: found.length === 0 };
}

export function isBlockedFilename(filename: string): boolean {
  const base = filename.split('/').pop() || filename;
  return BLOCKED_FILENAMES.some(blocked =>
    base.toLowerCase() === blocked.toLowerCase() || base.toLowerCase().endsWith('.pem') || base.toLowerCase().endsWith('.key')
  );
}

export function redactObject(obj: unknown, path = ''): { clean: unknown; secrets: string[] } {
  const secrets: string[] = [];

  function walk(val: unknown, p: string): unknown {
    if (typeof val === 'string') {
      const r = redactSecrets(val);
      if (!r.clean) secrets.push(...r.found.map(f => `${p}:${f}`));
      return r.redacted;
    }
    if (Array.isArray(val)) return val.map((v, i) => walk(v, `${p}[${i}]`));
    if (val && typeof val === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        // Block known secret key names entirely
        const kl = k.toLowerCase();
        if (/password|secret|private_key|access_token|refresh_token|api_key|client_secret/.test(kl)) {
          result[k] = '[REDACTED:key_name]';
          secrets.push(`${p}.${k}:blocked_key_name`);
        } else {
          result[k] = walk(v, `${p}.${k}`);
        }
      }
      return result;
    }
    return val;
  }

  return { clean: walk(obj, path), secrets };
}
