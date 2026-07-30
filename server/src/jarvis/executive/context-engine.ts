/**
 * Phase P7 — CEO Context Engine
 * Tracks conversation context per sender to resolve pronouns and follow-ups.
 */

export interface ConversationTurn {
  role: 'ceo' | 'mi';
  text: string;
  timestamp: string;
  topic?: string;
  entity?: string;
}

export interface SenderContext {
  sender: string;
  last_topic: string | null;
  last_entity: string | null;
  last_intent: string | null;
  turns: ConversationTurn[];
  updated_at: string;
}

const CONTEXT_MAP = new Map<string, SenderContext>();
const MAX_TURNS = 10;

// Entity extraction — known CEO entities
const ENTITIES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /laptop1/i, name: 'Laptop1' },
  { pattern: /laptop2/i, name: 'Laptop2' },
  { pattern: /mi.core/i, name: 'Mi-Core' },
  { pattern: /gateway/i, name: 'WhatsApp Gateway' },
  { pattern: /doordash/i, name: 'DoorDash' },
  { pattern: /stone oak/i, name: 'Stone Oak' },
  { pattern: /bandera/i, name: 'Bandera' },
  { pattern: /bakudan/i, name: 'Bakudan Ramen' },
  { pattern: /dashboard/i, name: 'Dashboard' },
  { pattern: /review/i, name: 'Review Automation' },
  { pattern: /integration/i, name: 'Integration System' },
  { pattern: /payroll/i, name: 'Payroll' },
  { pattern: /qb|quickbooks/i, name: 'QuickBooks' },
];

// Pronoun + topic-continuation patterns that refer to previous context
const PRONOUN_PATTERNS = [
  /^(nó|nó|it|that|this)\s/i,
  /^(store|máy|hệ thống|dự án|project|node)\s+(đó|này|kia|ấy)/i,
  /^(nó|cái đó|cái này)\s+(sao|thế nào|fix|ok|ổn)/i,
  /fix chưa/i,
  /fix chua/i,
  /no fix/i,
  /^sao rồi\?*$/i,
  /^sao roi\?*$/i,
  /^thế nào(\s+rồi)?\?*$/i,
  /^ổn không\?*$/i,
  /^on khong\?*$/i,
  /^the nao(\s+roi)?\?*$/i,
  /^ok chưa\?*$/i,
  /^ok chua\?*$/i,
  // Topic-based follow-ups (progress, status, result without naming entity)
  /^tien do.*(sao roi|the nao|\?)/i,
  /^tiến độ.*(sao rồi|thế nào|\?)/i,
  /^den dau roi/i,
  /^đến đâu rồi/i,
  /^ket qua sao/i,
  /^kết quả sao/i,
  /^update.{0,10}di$/i,
  /^bao gio xong/i,
  /^bao giờ xong/i,
  /^con lau khong/i,
  /^còn lâu không/i,
  /^du kien xong/i,
];

export function getContext(sender: string): SenderContext {
  if (!CONTEXT_MAP.has(sender)) {
    CONTEXT_MAP.set(sender, {
      sender,
      last_topic: null,
      last_entity: null,
      last_intent: null,
      turns: [],
      updated_at: new Date().toISOString(),
    });
  }
  return CONTEXT_MAP.get(sender)!;
}

export function addCEOTurn(sender: string, text: string, topic?: string, entity?: string): void {
  const ctx = getContext(sender);
  const detectedEntity = entity || detectEntity(text);
  // Also try to extract topic from statements like "Dev1 đang xử lý WhatsApp Runtime"
  const statementTopic = extractTopicFromStatement(text);
  const detectedTopic = topic || detectedEntity || statementTopic || ctx.last_topic || null;

  ctx.turns.push({ role: 'ceo', text, timestamp: new Date().toISOString(), topic: detectedTopic || undefined, entity: detectedEntity || undefined });
  if (detectedEntity) ctx.last_entity = detectedEntity;
  if (detectedTopic) ctx.last_topic = detectedTopic;
  ctx.updated_at = new Date().toISOString();
  if (ctx.turns.length > MAX_TURNS) ctx.turns = ctx.turns.slice(-MAX_TURNS);
}

export function addMiTurn(sender: string, text: string): void {
  const ctx = getContext(sender);
  ctx.turns.push({ role: 'mi', text, timestamp: new Date().toISOString() });
  ctx.updated_at = new Date().toISOString();
  if (ctx.turns.length > MAX_TURNS) ctx.turns = ctx.turns.slice(-MAX_TURNS);
}

export function updateIntent(sender: string, intent: string): void {
  const ctx = getContext(sender);
  ctx.last_intent = intent;
}

export function detectEntity(text: string): string | null {
  for (const e of ENTITIES) {
    if (e.pattern.test(text)) return e.name;
  }
  return null;
}

export function resolvePronouns(text: string, sender: string): string {
  const ctx = getContext(sender);
  const t = text.trim();
  const isFollowUp = PRONOUN_PATTERNS.some(p => p.test(t));
  if (!isFollowUp) return text;

  const lastRef = ctx.last_entity || ctx.last_topic;
  if (!lastRef) return text;

  // Topic-based follow-ups: "Tiến độ sao rồi?" → "[topic] tiến độ sao rồi?"
  if (/tiến độ|tien do|đến đâu rồi|den dau roi|kết quả sao|bao giờ xong|còn lâu/i.test(t)) {
    return `${lastRef} ${t}`;
  }

  // Bare status: "sao rồi?" → "[entity] sao rồi?"
  if (/^(sao rồi|thế nào|ổn không|ok chưa|fix chưa)\??$/i.test(t)) {
    return `${lastRef} ${t}`;
  }

  // Pronoun replacement
  return t
    .replace(/^(nó|it|that|this|cái đó|cái này)/i, lastRef)
    .replace(/^(store|máy|hệ thống|dự án|project|node)\s+(đó|này|kia|ấy)/i, lastRef)
    || `${lastRef} ${t}`;
}

// Extract topic from "X đang xử lý Y" / "X đang làm Y" patterns
export function extractTopicFromStatement(text: string): string | null {
  const patterns = [
    /(?:dev\d+|mi|team\w*)\s+đang\s+(?:xử lý|làm|build|fix|deploy|check)\s+(.+)/i,
    /(?:dev\d+|mi|team\w*)\s+đang\s+(?:xu ly|lam|check)\s+(.+)/i,
    /(.+)\s+(?:bị lỗi|đang lỗi|đang down|đang fix|bị down)/i,
    /(.+)\s+(?:bi loi|dang loi|dang down|dang fix)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim().slice(0, 60);
  }
  return null;
}

export function needsContextResolution(text: string): boolean {
  return PRONOUN_PATTERNS.some(p => p.test(text.trim()));
}
