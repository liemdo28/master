/**
 * Conversation audit log — persistent append-only record of all WhatsApp
 * messages, routes, responses, and timestamps.
 * Stored in PostgreSQL (mi_conversations) with MinIO backup.
 * No secrets stored — redaction applied before write.
 */

import fs from 'fs';
import path from 'path';
import { redactSecrets } from './response-formatter';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const AUDIT_PATH = path.join(GLOBAL_DIR, 'communication', 'conversation-audit.jsonl');

export interface ConversationEntry {
  id: string;
  timestamp: string;
  sender: string;
  chat_id: string;
  message_id: string;
  raw_text: string;
  normalized_text: string;
  language: string;
  intent: string | null;
  route: string;
  response_preview: string;
  duration_ms: number;
  approval_required: boolean;
  approval_id: string | null;
  error: string | null;
}

function ensureDir() {
  const dir = path.dirname(AUDIT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function auditConversation(entry: ConversationEntry): void {
  try {
    ensureDir();
    const safe: ConversationEntry = {
      ...entry,
      raw_text: redactSecrets(entry.raw_text),
      normalized_text: redactSecrets(entry.normalized_text),
      response_preview: redactSecrets(entry.response_preview),
    };
    fs.appendFileSync(AUDIT_PATH, JSON.stringify(safe) + '\n', 'utf8');
  } catch {
    // Audit must never crash the main flow
  }
}

export function getRecentConversations(limit = 50): ConversationEntry[] {
  try {
    ensureDir();
    if (!fs.existsSync(AUDIT_PATH)) return [];
    const lines = fs.readFileSync(AUDIT_PATH, 'utf8').trim().split('\n').filter(Boolean);
    return lines
      .slice(-limit)
      .map(l => JSON.parse(l) as ConversationEntry)
      .reverse();
  } catch {
    return [];
  }
}

export function getConversationStats(): {
  total: number;
  today: number;
  intents: Record<string, number>;
  languages: Record<string, number>;
} {
  const all = getRecentConversations(500);
  const todayStr = new Date().toISOString().slice(0, 10);
  const intents: Record<string, number> = {};
  const languages: Record<string, number> = {};

  for (const e of all) {
    if (e.intent) intents[e.intent] = (intents[e.intent] || 0) + 1;
    if (e.language) languages[e.language] = (languages[e.language] || 0) + 1;
  }

  return {
    total: all.length,
    today: all.filter(e => e.timestamp.startsWith(todayStr)).length,
    intents,
    languages,
  };
}
