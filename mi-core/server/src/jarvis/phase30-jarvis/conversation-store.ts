/**
 * Per-sender conversation memory — 30-minute sliding window, 20-turn history.
 * Tracks last topic, entity, intent so follow-up messages like "là sao?" can
 * be resolved against the previous exchange without a database.
 *
 * P4 UPGRADE: expanded from 10 to 20 turns, 10min to 30min TTL,
 * added turn history for followup resolution > 95% target.
 */

export interface ConversationTurn {
  role: 'ceo' | 'mi';
  text: string;
  timestamp: number;
  entity?: string;
  topic?: string;
}

export interface ConversationSession {
  sender: string;
  last_message: string;
  last_reply: string;
  last_entity: string;   // e.g. "Raw Sushi", "Dashboard", "Stone Oak"
  last_topic: string;    // e.g. "task", "seo", "revenue", "health", "dashboard"
  last_intent: string;   // e.g. "dashboard_status", "task_query", "phase_17"
  turns: ConversationTurn[];   // P4: full turn history (up to 20)
  updated_at: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // P4: expanded to 30 minutes
const MAX_TURNS = 20;                    // P4: last 20 turns available
const sessions = new Map<string, ConversationSession>();

export function getSession(sender: string): ConversationSession | null {
  const s = sessions.get(sender);
  if (!s) return null;
  if (Date.now() - s.updated_at > SESSION_TTL_MS) {
    sessions.delete(sender);
    return null;
  }
  return s;
}

export function updateSession(
  sender: string,
  data: Partial<Omit<ConversationSession, 'sender' | 'updated_at'>>,
): void {
  const blank: ConversationSession = {
    sender,
    last_message: '',
    last_reply: '',
    last_entity: '',
    last_topic: '',
    last_intent: '',
    turns: [],
    updated_at: 0,
  };
  const existing = sessions.get(sender) ?? blank;
  const updated = { ...existing, ...data, sender, updated_at: Date.now() };
  // Ensure turns array exists (migration from old sessions)
  if (!updated.turns) updated.turns = [];
  sessions.set(sender, updated);
}

// ── P4: Turn recording for 20-turn conversation history ───────────────────

export function recordTurn(
  sender: string,
  role: 'ceo' | 'mi',
  text: string,
  entity?: string,
  topic?: string,
): void {
  const blank: ConversationSession = {
    sender, last_message: '', last_reply: '', last_entity: '',
    last_topic: '', last_intent: '', turns: [], updated_at: 0,
  };
  const session = sessions.get(sender) ?? blank;
  if (!session.turns) session.turns = [];
  session.turns.push({
    role,
    text: text.slice(0, 500),
    timestamp: Date.now(),
    entity,
    topic,
  });
  // Keep only last MAX_TURNS
  if (session.turns.length > MAX_TURNS) {
    session.turns = session.turns.slice(-MAX_TURNS);
  }
  sessions.set(sender, { ...session, updated_at: Date.now() });
}

// ── P4: Get last N turns for followup resolution ──────────────────────────

export function getTurnHistory(sender: string, count: number = 20): ConversationTurn[] {
  const session = sessions.get(sender);
  if (!session || !session.turns) return [];
  const ttl = Date.now() - session.updated_at;
  if (ttl > SESSION_TTL_MS) {
    sessions.delete(sender);
    return [];
  }
  return session.turns.slice(-count);
}

// ── P4: Find the most recent entity from conversation history ─────────────

export function resolveEntityFromHistory(sender: string): string | null {
  const turns = getTurnHistory(sender, 20);
  // Walk backwards to find most recent entity
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].entity) return turns[i].entity!;
  }
  return null;
}

// ── P4: Find the most recent topic from conversation history ───────────────

export function resolveTopicFromHistory(sender: string): string | null {
  const turns = getTurnHistory(sender, 20);
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].topic) return turns[i].topic!;
  }
  return null;
}

// ── Follow-up detection ────────────────────────────────────────────────────

const FOLLOWUP_PATTERNS = [
  // P4: Enhanced followup detection — covers "Hả?", "K?", "Sao?", "Không có hình hả?"
  /^(la sao|roi sao|then what|nhu the nao|the nao|con gi nua|co gi nua|anh muon biet gi them)\??$/i,
  /^(sao|ha|sao anh|y nghia gi|nghia la gi|tai sao)\??$/i,
  /^(va|va roi|va sao)\??$/i,
  /^ke (them|tiep|nua)(\s+(di|nhe|anh))?\??$/i,   // "kể thêm đi", "kể tiếp nhé"
  /^co gi (nua|them|tiep)(\s+(khong|ko|anh))?\??$/i, // "có gì nữa không?"
  // P4: single-char / bare followups that lose context
  /^(k|ok|ha|h\b|uh|uhm|ok\s+ roi|ok\s+ nhe)\??$/i,
  // P4: image followups — "Không có hình hả?", "hình đâu?", "có hinh khong?"
  /(khong\s+co\s+hinh|hinh\s+dau|co\s+hinh\s+khong|hinh\s+o\s+dau|image|ảnh|no\s+image)/i,
  // P4: generic followup referencing previous context
  /^(no|cai do|cai nay|cai kia|the|the\s+ma)\s+(sao|ok|duoc|duoc\s+khong|chua)/i,
  // P4: "X sao rồi" referencing previous entity
  /^(sao roi|sao roi roi|the nao roi|den dau roi|bao gio xong)\??$/i,
];

export function isFollowUp(normalized: string): boolean {
  const t = normalized.trim().toLowerCase();
  if (t.length > 80) return false;  // P4: relaxed from 60 to 80 chars
  return FOLLOWUP_PATTERNS.some(p => p.test(t));
}

// ── Entity extraction from raw CEO text ───────────────────────────────────

const ENTITY_MAP: Array<[RegExp, string]> = [
  [/raw sushi/i, 'Raw Sushi'],
  [/stone oak/i, 'Stone Oak'],
  [/bakudan/i, 'Bakudan'],
  [/dashboard/i, 'Dashboard'],
  [/asana/i, 'Asana'],
  [/whatsapp/i, 'WhatsApp Gateway'],
  [/review automation/i, 'Review Automation'],
  [/doordash/i, 'DoorDash'],
  [/payroll/i, 'Payroll'],
  [/qb|quickbooks/i, 'QuickBooks'],
  [/seo/i, 'SEO'],
  [/hinh|anh|image|flyer|poster|banner|photo/i, 'Image'],
  [/maria/i, 'Maria'],
  [/integration/i, 'Integration System'],
];

export function extractEntity(text: string): string {
  for (const [pattern, label] of ENTITY_MAP) {
    if (pattern.test(text)) return label;
  }
  return '';
}

// ── Topic tagging from intent/phase ───────────────────────────────────────

export function extractTopic(phase: number | undefined, intent: string): string {
  if (intent.includes('dashboard')) return 'dashboard';
  if (intent.includes('task')) return 'task';
  if (intent.includes('health')) return 'health';
  if (intent.includes('briefing') || intent.includes('phase_17')) return 'briefing';
  if (intent.includes('strategic') || intent.includes('phase_18')) return 'strategy';
  if (intent.includes('workflow') || intent.includes('phase_40')) return 'workflow';
  if (intent.includes('graph') || intent.includes('phase_25')) return 'knowledge';
  if (phase === 17) return 'briefing';
  if (phase === 23) return 'health';
  if (phase === 40) return 'workflow';
  return 'general';
}
