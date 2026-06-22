/**
 * Conversation Memory — Phase 1 True Human Assistant
 * Short-term per-session context: last N turns, entity memory, topic thread.
 * Enables Mi to say "anh vừa hỏi về Laptop1" or continue a thread naturally.
 */

export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
  intent?: string;
  timestamp: number;
  entities?: Record<string, string>;
}

export interface ConversationSession {
  session_id: string;
  phone: string;
  turns: ConversationTurn[];
  topic?: string;             // current active topic
  last_target?: string;       // last referenced node/store/project
  last_intent?: string;
  entity_stack: string[];     // P0-2: recent entities mentioned (max 5)
  entity_mentions: Record<string, number>;  // P0-2: entity → count for recency
  created_at: number;
  updated_at: number;
}

// In-memory store keyed by phone number (CEO phone)
const SESSIONS: Map<string, ConversationSession> = new Map();
const MAX_TURNS = 20;
const SESSION_TTL_MS = 4 * 60 * 60_000; // 4 hours

function pruneOldSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [k, s] of SESSIONS) {
    if (s.updated_at < cutoff) SESSIONS.delete(k);
  }
}

export function getOrCreateSession(phone: string): ConversationSession {
  pruneOldSessions();
  let session = SESSIONS.get(phone);
  if (!session) {
    session = {
      session_id: 'sess_' + Date.now(),
      phone,
      turns: [],
      entity_stack: [],
      entity_mentions: {},
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    SESSIONS.set(phone, session);
  }
  return session;
}

export function addUserTurn(phone: string, text: string, intent?: string, entities?: Record<string, string>) {
  const s = getOrCreateSession(phone);
  s.turns.push({ role: 'user', text, intent, timestamp: Date.now(), entities });
  if (intent) s.last_intent = intent;
  if (entities?.target) {
    s.last_target = entities.target;
    // P0-2: Track entity in stack for multi-entity disambiguation
    s.entity_stack = s.entity_stack.filter(e => e !== entities.target);
    s.entity_stack.push(entities.target!);
    if (s.entity_stack.length > 5) s.entity_stack.shift();
    s.entity_mentions[entities.target!] = (s.entity_mentions[entities.target!] || 0) + 1;
  }
  if (s.turns.length > MAX_TURNS) s.turns.shift();
  s.updated_at = Date.now();
}

export function addAssistantTurn(phone: string, text: string) {
  const s = getOrCreateSession(phone);
  s.turns.push({ role: 'assistant', text, timestamp: Date.now() });
  if (s.turns.length > MAX_TURNS) s.turns.shift();
  s.updated_at = Date.now();
}

export function getRecentTurns(phone: string, limit = 6): ConversationTurn[] {
  return (SESSIONS.get(phone)?.turns || []).slice(-limit);
}

export function getLastUserTurn(phone: string): ConversationTurn | null {
  const turns = SESSIONS.get(phone)?.turns || [];
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === 'user') return turns[i];
  }
  return null;
}

export function getSessionContext(phone: string): {
  last_intent: string | undefined;
  last_target: string | undefined;
  topic: string | undefined;
  turn_count: number;
  recent_summary: string;
  entity_stack: string[];              // P0-2: recent entities
  top_entities: string[];              // P0-2: most mentioned entities
  disambiguation_hint: string | null;  // P0-2: suggestion for ambiguous follow-ups
} {
  const s = SESSIONS.get(phone);
  if (!s) return { last_intent: undefined, last_target: undefined, topic: undefined, turn_count: 0, recent_summary: '', entity_stack: [], top_entities: [], disambiguation_hint: null };
  const recent = s.turns.slice(-4);
  const summary = recent.map(t => `${t.role === 'user' ? 'Anh' : 'Mi'}: ${t.text.slice(0, 60)}`).join(' | ');
  // P0-2: Sort entities by mention count to find most discussed
  const topEntities = Object.entries(s.entity_mentions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
  // P0-2: Build disambiguation hint when multiple entities are active
  const disambiguationHint = s.entity_stack.length > 1
    ? `Anh đang nói về ${s.entity_stack.join(' hay ')}?`
    : null;
  return {
    last_intent: s.last_intent,
    last_target: s.last_target,
    topic: s.topic,
    turn_count: s.turns.length,
    recent_summary: summary,
    entity_stack: s.entity_stack.slice(),
    top_entities: topEntities,
    disambiguation_hint: disambiguationHint,
  };
}

export function setTopic(phone: string, topic: string) {
  const s = getOrCreateSession(phone);
  s.topic = topic;
  s.updated_at = Date.now();
}

export function clearSession(phone: string) {
  SESSIONS.delete(phone);
}

export function getSessionStats() {
  return { active_sessions: SESSIONS.size };
}

/**
 * Resolve pronouns / topic continuity.
 * "Nó sao rồi?" after asking about Laptop1 → resolves to "Laptop1 sao rồi?"
 */
export function resolveMessage(phone: string, text: string): string {
  const s = SESSIONS.get(phone);
  if (!s) return text;
  const lower = text.toLowerCase().trim();
  // Pronoun + verb patterns — "Nó X chưa?", "Nó fix chưa?", "Đó sao rồi?"
  // Note: \b doesn't work with Vietnamese chars — use (?=\s|$) instead
  if (/^(nó|đó)(?=\s|$)/i.test(lower) && s.last_target) {
    return text.replace(/^(nó|đó)(?=\s|$)/i, s.last_target);
  }
  if (/^(store đó|cái đó|chỗ đó|chỗ này)(?=\s|$)/i.test(lower) && s.last_target) {
    return text.replace(/^(store đó|cái đó|chỗ đó|chỗ này)(?=\s|$)/i, s.last_target);
  }
  return text;
}
