/**
 * Document secret scanner.
 *
 * Two failure modes matter equally here. Missing a real credential means it gets
 * chunked, indexed and later quoted back with a citation. But rejecting every file that
 * says "password policy" makes the whole feature useless, so ordinary prose about
 * credentials must pass. Detection therefore looks for *values*, not vocabulary.
 */

export type SecretCategory =
  | 'PRIVATE_KEY' | 'SERVICE_ACCOUNT' | 'OAUTH_TOKEN' | 'BEARER_TOKEN' | 'API_KEY'
  | 'CLOUD_CREDENTIAL' | 'VCS_TOKEN' | 'CONNECTION_STRING' | 'PASSWORD_ASSIGNMENT'
  | 'ENV_ASSIGNMENT' | 'SESSION_COOKIE' | 'WHATSAPP_SESSION' | 'SSH_MATERIAL';

export type SecretClassification = 'CLEAN' | 'SECRET_REJECTED';

export interface SecretScanResult {
  classification: SecretClassification;
  categories: SecretCategory[];
  /** Short, already-redacted excerpt showing where the match was, for the audit trail. */
  redactedPreview: string;
  safeReason: string;
}

interface Rule {
  category: SecretCategory;
  pattern: RegExp;
  /** Extra guard so documentation examples do not trip the rule. */
  reject?: (match: string, context: string) => boolean;
}

/** Placeholder values that appear in docs and never represent a live credential. */
const PLACEHOLDER = /^(x{3,}|y{3,}|\.{3,}|<[^>]*>|\{\{?[^}]*\}?\}|\$\{[^}]*\}|your[_-]?\w*|my[_-]?\w*|example\w*|sample\w*|placeholder\w*|redacted\w*|dummy\w*|test[_-]?\w*|fake\w*|changeme\w*|todo\w*|none|null|empty|abc123|password|secret|token|key)$/i;

function looksPlaceholder(value: string): boolean {
  const cleaned = value.replace(/^["'`]|["'`]$/g, '').trim();
  if (!cleaned || cleaned.length < 8) return true;
  if (PLACEHOLDER.test(cleaned)) return true;
  // A value with no entropy at all (single repeated char, or all-same-class short text).
  if (/^(.)\1+$/.test(cleaned)) return true;
  return false;
}

const RULES: Rule[] = [
  {
    category: 'PRIVATE_KEY',
    pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----[\s\S]{0,80}/g,
  },
  {
    category: 'SSH_MATERIAL',
    pattern: /\bssh-(?:rsa|ed25519|dss)\s+[A-Za-z0-9+/]{100,}={0,2}/g,
  },
  {
    // A service-account JSON is identified by its shape, not by any single word.
    category: 'SERVICE_ACCOUNT',
    pattern: /"type"\s*:\s*"service_account"[\s\S]{0,400}?"private_key"\s*:\s*"[^"]{40,}"/g,
  },
  {
    category: 'OAUTH_TOKEN',
    pattern: /\bya29\.[A-Za-z0-9._\-]{20,}/g,
  },
  {
    category: 'OAUTH_TOKEN',
    pattern: /"(?:access_token|refresh_token)"\s*:\s*"([^"]{20,})"/g,
    reject: (_m, ctx) => !looksPlaceholder(/"\s*:\s*"([^"]+)"/.exec(ctx)?.[1] || ''),
  },
  {
    category: 'BEARER_TOKEN',
    pattern: /\bbearer\s+([A-Za-z0-9._\-]{24,})/gi,
    reject: (match) => !looksPlaceholder(match.replace(/^bearer\s+/i, '')),
  },
  {
    category: 'API_KEY',
    pattern: /\bsk-[A-Za-z0-9]{24,}\b/g,
  },
  {
    category: 'VCS_TOKEN',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
  },
  {
    category: 'CLOUD_CREDENTIAL',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    category: 'CLOUD_CREDENTIAL',
    pattern: /\bASIA[0-9A-Z]{16}\b/g,
  },
  {
    // Only a connection string carrying an actual password counts. A documented
    // format such as postgres://USER:PASSWORD@HOST/DB is prose, not a credential.
    category: 'CONNECTION_STRING',
    pattern: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp|mssql)::?\/\/[^\s:@/]+:([^\s@/]{6,})@[^\s/]+/gi,
    reject: (match) => {
      const password = /:\/\/[^\s:@/]+:([^\s@/]+)@/.exec(match)?.[1] || '';
      return !looksPlaceholder(password) && !/^[A-Z_]{4,}$/.test(password);
    },
  },
  {
    category: 'PASSWORD_ASSIGNMENT',
    pattern: /\b(?:password|passwd|pwd)\s*[:=]\s*(["'`]?[^\s"'`,;]{8,}["'`]?)/gi,
    reject: (match) => !looksPlaceholder(/[:=]\s*(.+)$/.exec(match)?.[1] || ''),
  },
  {
    category: 'API_KEY',
    pattern: /\b(?:api[_-]?key|apikey|client[_-]?secret|secret[_-]?key|auth[_-]?token)\s*[:=]\s*(["'`]?[A-Za-z0-9._\-]{16,}["'`]?)/gi,
    reject: (match) => !looksPlaceholder(/[:=]\s*(.+)$/.exec(match)?.[1] || ''),
  },
  {
    category: 'ENV_ASSIGNMENT',
    pattern: /^[ \t]*(?:export[ \t]+)?[A-Z][A-Z0-9_]{3,}(?:_KEY|_SECRET|_TOKEN|_PASSWORD|_PASSWD|_CREDENTIALS)\s*=\s*(\S{8,})$/gm,
    reject: (match) => !looksPlaceholder(/=\s*(.+)$/.exec(match)?.[1] || ''),
  },
  {
    category: 'SESSION_COOKIE',
    pattern: /\b(?:session|sid|connect\.sid|jwt)\s*[:=]\s*(["'`]?ey[A-Za-z0-9._\-]{30,}["'`]?)/gi,
  },
  {
    category: 'WHATSAPP_SESSION',
    pattern: /"(?:WABrowserId|WASecretBundle|WAToken1|WAToken2)"\s*:\s*"[^"]{10,}"/g,
  },
];

export function scanForSecrets(content: string): SecretScanResult {
  const text = typeof content === 'string' ? content : '';
  const categories = new Set<SecretCategory>();
  let firstMatch = '';
  let firstIndex = -1;

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let hit: RegExpExecArray | null;
    while ((hit = rule.pattern.exec(text)) !== null) {
      const match = hit[0];
      const context = text.slice(Math.max(0, hit.index - 40), hit.index + match.length + 40);
      if (rule.reject && !rule.reject(match, context)) continue;
      categories.add(rule.category);
      if (firstIndex < 0) { firstIndex = hit.index; firstMatch = match; }
      break; // one hit per rule is enough; the file is rejected either way
    }
  }

  if (!categories.size) {
    return { classification: 'CLEAN', categories: [], redactedPreview: '', safeReason: '' };
  }

  const sorted = [...categories].sort();
  return {
    classification: 'SECRET_REJECTED',
    categories: sorted,
    redactedPreview: buildRedactedPreview(text, firstIndex, firstMatch),
    safeReason: `document rejected: credential-like content detected (${sorted.join(', ')})`,
  };
}

/**
 * Shows only where the match occurred, never the value. The original secret is never
 * persisted anywhere — not in the preview, not in the job record, not in logs.
 */
function buildRedactedPreview(text: string, index: number, match: string): string {
  if (index < 0) return '[REDACTED]';
  const line = text.slice(0, index).split(/\r?\n/).length;
  const before = text.slice(Math.max(0, index - 24), index).replace(/\s+/g, ' ').trim();
  return `line ${line}: …${before ? before + ' ' : ''}[REDACTED ${match.length} chars]…`;
}

/** Redacts in place for content that is kept but must not carry credentials. */
export function redactSecrets(content: string): string {
  let value = String(content || '');
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    value = value.replace(rule.pattern, m => (rule.reject && !rule.reject(m, m) ? m : '[REDACTED_SECRET]'));
  }
  return value;
}
