/**
 * Per-sender conversation memory — 10-minute sliding window.
 * Tracks last topic, entity, intent so follow-up messages like "là sao?" can
 * be resolved against the previous exchange without a database.
 */

export interface ConversationSession {
  sender: string;
  last_message: string;
  last_reply: string;
  last_entity: string;   // e.g. "Raw Sushi", "Dashboard", "Stone Oak"
  last_topic: string;    // e.g. "task", "seo", "revenue", "health", "dashboard"
  last_intent: string;   // e.g. "dashboard_status", "task_query", "phase_17"
  updated_at: number;
}

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
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
    updated_at: 0,
  };
  const existing = sessions.get(sender) ?? blank;
  sessions.set(sender, { ...existing, ...data, sender, updated_at: Date.now() });
}

// ── Follow-up detection ────────────────────────────────────────────────────

const FOLLOWUP_PATTERNS = [
  /^(la sao|roi sao|then what|nhu the nao|the nao|con gi nua|co gi nua|anh muon biet gi them)\??$/i,
  /^(sao|ha|sao anh|y nghia gi|nghia la gi|tai sao)\??$/i,
  /^(va|va roi|va sao)\??$/i,
  /^ke (them|tiep|nua)(\s+(di|nhe|anh))?\??$/i,   // "kể thêm đi", "kể tiếp nhé"
  /^co gi (nua|them|tiep)(\s+(khong|ko|anh))?\??$/i, // "có gì nữa không?"
];

export function isFollowUp(normalized: string): boolean {
  const t = normalized.trim().toLowerCase();
  if (t.length > 60) return false;
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
