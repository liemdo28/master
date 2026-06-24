/**
 * Secret Redactor — Phase 8 + P0 Security Hotfix
 * Detects and redacts credentials/secrets.
 *
 * Used in TWO places:
 *  1. Storage gate: before anything is written to MinIO / PostgreSQL / Qdrant
 *  2. Response gate: on EVERY chat/WhatsApp reply before it leaves the system
 *
 * NEVER store raw secrets. NEVER send secrets to CEO chat or LLM context.
 */

export interface RedactionResult {
  redacted: string;
  found: string[];
  clean: boolean;
}

const PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  // ── Known high-value secrets (must come first — most specific) ──────────────
  // Deploy URL with key param — the confirmed P0 leak vector
  { name: 'deploy_url_key', pattern: /https?:\/\/[^\s"'`]*(?:deploy|webhook|hook)[^\s"'`]*[?&]key=[^\s"'`&]+/gi, replacement: '[REDACTED:deploy_url]' },
  // Any URL with secret/token/key/api_key in query string
  { name: 'url_secret_param', pattern: /https?:\/\/[^\s"'`]*[?&](?:key|token|secret|api_key|apikey|access_token|auth|password|pwd)=[^\s"'`&"']{4,}/gi, replacement: '[REDACTED:url_with_secret]' },
  // Credentials in URL (https://user:pass@host)
  { name: 'url_credentials', pattern: /https?:\/\/[^\s@"'`]+:[^\s@"'`]+@[^\s"'`]+/g, replacement: '[REDACTED:url_credentials]' },

  // ── API key prefixes ────────────────────────────────────────────────────────
  { name: 'openai_key',     pattern: /sk-[A-Za-z0-9\-_]{20,}/g,              replacement: '[REDACTED:openai_key]' },
  { name: 'anthropic_key',  pattern: /sk-ant-[A-Za-z0-9\-_]{40,}/g,          replacement: '[REDACTED:anthropic_key]' },
  { name: 'github_pat',     pattern: /ghp_[A-Za-z0-9]{36}/g,                 replacement: '[REDACTED:github_pat]' },
  { name: 'github_pat2',    pattern: /github_pat_[A-Za-z0-9_]{20,}/g,        replacement: '[REDACTED:github_pat]' },
  { name: 'slack_bot',      pattern: /xoxb-[A-Za-z0-9\-]{50,}/g,             replacement: '[REDACTED:slack_bot]' },
  { name: 'slack_user',     pattern: /xoxp-[A-Za-z0-9\-]{50,}/g,             replacement: '[REDACTED:slack_user]' },
  { name: 'aws_access',     pattern: /AKIA[A-Z0-9]{16}/g,                     replacement: '[REDACTED:aws_access_key]' },
  { name: 'aws_secret',     pattern: /(?<=[^A-Za-z0-9])[A-Za-z0-9/+]{40}(?=[^A-Za-z0-9=])/g, replacement: '[REDACTED:aws_secret]' },
  { name: 'stripe_key',     pattern: /sk_(?:live|test)_[A-Za-z0-9]{24,}/g,   replacement: '[REDACTED:stripe_key]' },
  { name: 'stripe_rk',      pattern: /rk_(?:live|test)_[A-Za-z0-9]{24,}/g,   replacement: '[REDACTED:stripe_rk]' },
  { name: 'cloudflare_key', pattern: /[A-Za-z0-9]{40}(?=\s|$)/g,             replacement: '[REDACTED:possible_token]' },

  // ── Generic key=value patterns ──────────────────────────────────────────────
  { name: 'password_kv',    pattern: /(?:password|passwd|pwd)\s*[=:]\s*["']?[^\s"',;\n]{6,}["']?/gi, replacement: '[REDACTED:password]' },
  { name: 'token_kv',       pattern: /(?:\btoken\b|access_token|refresh_token|id_token|bearer_token)\s*[=:]\s*["']?[A-Za-z0-9\-_.]{20,}["']?/gi, replacement: '[REDACTED:token]' },
  { name: 'api_key_kv',     pattern: /(?:api[_\-]?key|apikey)\s*[=:]\s*["']?[A-Za-z0-9\-_.]{10,}["']?/gi, replacement: '[REDACTED:api_key]' },
  { name: 'secret_kv',      pattern: /(?:secret|client[_\-]secret|app[_\-]secret|webhook[_\-]secret)\s*[=:]\s*["']?[A-Za-z0-9\-_.]{8,}["']?/gi, replacement: '[REDACTED:secret]' },
  { name: 'auth_bearer',    pattern: /(?:authorization|x-api-key|x-auth-token)\s*:\s*(?:bearer\s+)?[A-Za-z0-9\-_.]{20,}/gi, replacement: '[REDACTED:auth_header]' },
  { name: 'auth_basic',     pattern: /authorization\s*:\s*basic\s+[A-Za-z0-9+/=]{10,}/gi, replacement: '[REDACTED:auth_basic]' },

  // ── MI-Core specific secrets ────────────────────────────────────────────────
  // MI_SNAPSHOT_SECRET and similar env var values if they appear in text
  { name: 'mi_env_value',   pattern: /(?:MI_SNAPSHOT_SECRET|DEPLOY_KEY|DEPLOY_TOKEN|MI_REMOTE_TOKEN|MI_PIN|REVIEW_SYSTEM_INTERNAL_TOKEN|REVIEW_APPROVAL_INTERNAL_TOKEN)\s*[=:]\s*["']?[^\s"',;\n]+["']?/gi, replacement: '[REDACTED:mi_env]' },
  // Deploy key values matching pattern deploy-XX-XXXX
  { name: 'deploy_key',     pattern: /deploy-[a-z0-9]+-\d{4}/gi,              replacement: '[REDACTED:deploy_key]' },
  // QB credentials
  { name: 'qb_secret',      pattern: /(?:QB_CLIENT_SECRET|QB_REFRESH_TOKEN|QB_REALM_ID)\s*[=:]\s*["']?[^\s"',;\n]+["']?/gi, replacement: '[REDACTED:qb_secret]' },

  // ── Crypto / PKI ────────────────────────────────────────────────────────────
  { name: 'private_key',    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, replacement: '[REDACTED:private_key_block]' },
  { name: 'cert_block',     pattern: /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, replacement: '[REDACTED:certificate_block]' },

  // ── OAuth / Google ──────────────────────────────────────────────────────────
  { name: 'google_client',  pattern: /[0-9]+-[A-Za-z0-9_]+\.apps\.googleusercontent\.com/g, replacement: '[REDACTED:google_client_id]' },
  { name: 'google_refresh', pattern: /1\/\/[A-Za-z0-9\-_]{40,}/g,            replacement: '[REDACTED:google_refresh_token]' },

  // ── .env file assignments ───────────────────────────────────────────────────
  { name: 'dotenv_secret',  pattern: /^(?:DB_PASSWORD|POSTGRES_PASSWORD|MINIO_ROOT_PASSWORD|REDIS_PASSWORD|SECRET_KEY|ENCRYPTION_KEY|JWT_SECRET|GOOGLE_CLIENT_SECRET|GOOGLE_REFRESH_TOKEN|ASANA_TOKEN|ANTHROPIC_API_KEY|OPENAI_API_KEY|SKYVERN_API_KEY|AGENT_CODING_API_KEY|MI_PIN|MI_REMOTE_TOKEN)=.+$/gim, replacement: '[REDACTED:env_secret]' },
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
        if (/password|secret|private_key|access_token|refresh_token|api_key|client_secret|\btoken\b/.test(kl)) {
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
