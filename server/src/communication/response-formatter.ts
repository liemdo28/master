/**
 * Formats Mi responses for WhatsApp delivery.
 * WhatsApp supports bold (*text*), italic (_text_), monospace (```text```) and newlines.
 * Enforces: no secrets, no raw tokens, length limits, truncation.
 */

const MAX_WA_LENGTH = 4000; // WhatsApp message limit

const SECRET_PATTERNS = [
  /\b[A-Za-z0-9_-]{40,}\b/g,           // long tokens
  /Bearer\s+\S+/gi,
  /api[_-]?key[=:]\s*\S+/gi,
  /password[=:]\s*\S+/gi,
  /secret[=:]\s*\S+/gi,
  /GOCSPX-[A-Za-z0-9_-]+/g,
  /ya29\.[A-Za-z0-9_-]+/g,
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

export function formatWhatsApp(text: string, opts?: {
  truncate?: boolean;
  header?: string;
  footer?: string;
}): string {
  let result = redactSecrets(text);

  if (opts?.header) result = `*${opts.header}*\n${result}`;
  if (opts?.footer) result = `${result}\n_${opts.footer}_`;

  if (opts?.truncate !== false && result.length > MAX_WA_LENGTH) {
    result = result.slice(0, MAX_WA_LENGTH - 50) + '\n...\n_(truncated — ask for specific section)_';
  }

  return result;
}

export function formatError(message: string): string {
  return `⚠️ ${message}`;
}

export function formatSuccess(message: string): string {
  return `✅ ${message}`;
}

export function formatList(title: string, items: string[]): string {
  if (!items.length) return `*${title}*\n_Không có dữ liệu._`;
  return `*${title}*\n${items.map(i => `• ${i}`).join('\n')}`;
}

export function formatTable(headers: string[], rows: string[][]): string {
  const header = headers.join(' | ');
  const divider = headers.map(() => '---').join(' | ');
  const body = rows.map(r => r.join(' | ')).join('\n');
  return `\`\`\`\n${header}\n${divider}\n${body}\n\`\`\``;
}

export function formatApprovalRequest(params: {
  id: string;
  description: string;
  risk_level: number;
  rollback?: string;
}): string {
  const riskLabel = params.risk_level === 3 ? '🔴 NGUY HIỂM' : params.risk_level === 2 ? '🟡 Cần duyệt' : '🟢 Tự động';
  return [
    `*Yêu cầu phê duyệt* ${riskLabel}`,
    `ID: \`${params.id}\``,
    `Hành động: ${params.description}`,
    params.rollback ? `Rollback: ${params.rollback}` : '',
    `\nAnh reply *approve ${params.id}* để xác nhận, hoặc *cancel* để bỏ.`,
  ].filter(Boolean).join('\n');
}
