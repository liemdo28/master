/**
 * SEO Control Center — secret redaction helper.
 * Shared by ChatGPTBrowserProvider and ManualPasteProvider so that no
 * API key / token / password / credential ever leaves this process in a
 * prompt sent to a browser session, a pasted-response job row, or evidence.
 *
 * This is a best-effort pattern scrub, not a cryptographic guarantee — it
 * exists to stop *accidental* leakage of obviously-secret-shaped strings
 * (env var values pasted into a prompt, an API key copy/pasted by mistake).
 */

interface RedactPattern {
  name: string;
  regex: RegExp;
}

const PATTERNS: RedactPattern[] = [
  // OpenAI-style keys: sk-..., sk-proj-...
  { name: 'openai_api_key', regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g },
  // Anthropic keys
  { name: 'anthropic_api_key', regex: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g },
  // Google API keys
  { name: 'google_api_key', regex: /\bAIza[0-9A-Za-z_-]{20,}\b/g },
  // AWS access key id
  { name: 'aws_access_key_id', regex: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g },
  // GitHub tokens
  { name: 'github_token', regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  // Slack tokens
  { name: 'slack_token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  // Generic bearer tokens
  { name: 'bearer_token', regex: /\bBearer\s+[A-Za-z0-9._-]{16,}\b/gi },
  // JWTs
  { name: 'jwt', regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
  // key=value / password=value style assignments for common secret field names
  {
    name: 'secret_assignment',
    regex: /\b((?:api[_-]?key|secret[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|pwd|private[_-]?key)\s*[:=]\s*)("?)([^\s"'`,;]{4,})\2/gi,
  },
  // Generic long base64/hex-ish token assignments after "token"
  { name: 'token_assignment', regex: /\b(token\s*[:=]\s*)("?)([A-Za-z0-9._-]{16,})\2/gi },
];

/**
 * Strip anything matching common API key / token / password patterns from
 * free-form text before it is sent to a ChatGPT session, stored in the
 * seo_ai_jobs table, or written to evidence.
 */
export function redactSecrets(text: string): string {
  if (!text) return text;
  let out = text;
  for (const p of PATTERNS) {
    if (p.name === 'secret_assignment' || p.name === 'token_assignment') {
      out = out.replace(p.regex, (_m, prefix, quote) => `${prefix}${quote}[REDACTED]${quote}`);
    } else {
      out = out.replace(p.regex, '[REDACTED]');
    }
  }
  return out;
}
