/**
 * WhatsApp Message Store for Mi-Core
 *
 * Persists messages, groups, participants, action items, approvals
 * in .local-agent-global/connectors/whatsapp/
 */
import fs from 'fs';
import path from 'path';

// ── Paths ───────────────────────────────────────────────────────────────────
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const WA_DIR = path.join(GLOBAL_DIR, 'connectors', 'whatsapp');

const MESSAGES_PATH    = path.join(WA_DIR, 'messages.json');
const GROUPS_PATH      = path.join(WA_DIR, 'groups.json');
const PARTICIPANTS_PATH = path.join(WA_DIR, 'participants.json');
const SUMMARIES_PATH   = path.join(WA_DIR, 'summaries.json');
const ACTION_ITEMS_PATH = path.join(WA_DIR, 'action_items.json');
const APPROVALS_PATH   = path.join(WA_DIR, 'approvals.json');
const LAST_SYNC_PATH   = path.join(WA_DIR, 'last_sync.json');
const ERRORS_PATH      = path.join(WA_DIR, 'errors.json');

// ── Types ───────────────────────────────────────────────────────────────────
export interface WhatsAppMessage {
  message_id: string;
  chat_id: string;
  group_id: string;
  sender: string;
  sender_name: string;
  text: string;
  normalized_text: string;
  timestamp: string;
  intent: string;
  response: string;
  approval_id: string | null;
  status: 'received' | 'processed' | 'replied' | 'failed' | 'duplicate';
  attachments: Array<{ type: string; url: string; name?: string }>;
  created_at: string;
}

export interface WhatsAppGroup {
  group_id: string;
  name: string;
  participants: string[];
  last_message_at: string;
  unread_count: number;
  is_muted: boolean;
}

export interface WhatsAppParticipant {
  sender: string;
  sender_name: string;
  chat_id: string;
  last_seen: string;
  message_count: number;
}

export interface ApprovalRecord {
  approval_id: string;
  message_id: string;
  chat_id: string;
  sender: string;
  action_description: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
}

export interface ErrorRecord {
  ts: string;
  message_id: string;
  chat_id: string;
  error: string;
  detail?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function ensureDir() {
  if (!fs.existsSync(WA_DIR)) fs.mkdirSync(WA_DIR, { recursive: true });
}

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return fallback; }
}

function writeJson(filePath: string, data: any) {
  try {
    ensureDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch { /* non-critical store write failure */ }
}

// ── Messages ────────────────────────────────────────────────────────────────
export function saveMessage(msg: WhatsAppMessage) {
  const messages = readJson<WhatsAppMessage[]>(MESSAGES_PATH, []);
  messages.push(msg);
  // Keep last 5000 messages
  if (messages.length > 5000) messages.splice(0, messages.length - 5000);
  writeJson(MESSAGES_PATH, messages);
}

export function getMessageById(messageId: string): WhatsAppMessage | undefined {
  const messages = readJson<WhatsAppMessage[]>(MESSAGES_PATH, []);
  return messages.find(m => m.message_id === messageId);
}

export function getAllMessages(limit = 50): WhatsAppMessage[] {
  const messages = readJson<WhatsAppMessage[]>(MESSAGES_PATH, []);
  return messages.slice(-limit).reverse();
}

export function getMessagesByChatId(chatId: string, limit = 20): WhatsAppMessage[] {
  const messages = readJson<WhatsAppMessage[]>(MESSAGES_PATH, []);
  return messages.filter(m => m.chat_id === chatId).slice(-limit).reverse();
}

export function updateMessageStatus(messageId: string, status: WhatsAppMessage['status'], response?: string, approvalId?: string | null) {
  const messages = readJson<WhatsAppMessage[]>(MESSAGES_PATH, []);
  const msg = messages.find(m => m.message_id === messageId);
  if (msg) {
    msg.status = status;
    if (response !== undefined) msg.response = response;
    if (approvalId !== undefined) msg.approval_id = approvalId;
    writeJson(MESSAGES_PATH, messages);
  }
}

export function getMessageCount(): number {
  const messages = readJson<WhatsAppMessage[]>(MESSAGES_PATH, []);
  return messages.length;
}

// ── Groups ──────────────────────────────────────────────────────────────────
export function saveGroup(group: WhatsAppGroup) {
  const groups = readJson<WhatsAppGroup[]>(GROUPS_PATH, []);
  const idx = groups.findIndex(g => g.group_id === group.group_id);
  if (idx >= 0) groups[idx] = group;
  else groups.push(group);
  writeJson(GROUPS_PATH, groups);
}

export function getAllGroups(): WhatsAppGroup[] {
  return readJson<WhatsAppGroup[]>(GROUPS_PATH, []);
}

// ── Participants ────────────────────────────────────────────────────────────
export function saveParticipant(participant: WhatsAppParticipant) {
  const participants = readJson<WhatsAppParticipant[]>(PARTICIPANTS_PATH, []);
  const idx = participants.findIndex(p => p.sender === participant.sender);
  if (idx >= 0) {
    participants[idx] = {
      ...participants[idx],
      ...participant,
      message_count: participants[idx].message_count + 1,
    };
  } else {
    participant.message_count = 1;
    participants.push(participant);
  }
  writeJson(PARTICIPANTS_PATH, participants);
}

// ── Approvals ───────────────────────────────────────────────────────────────
export function saveApproval(approval: ApprovalRecord) {
  const approvals = readJson<ApprovalRecord[]>(APPROVALS_PATH, []);
  approvals.push(approval);
  if (approvals.length > 1000) approvals.splice(0, approvals.length - 1000);
  writeJson(APPROVALS_PATH, approvals);
}

export function updateApproval(approvalId: string, status: 'approved' | 'rejected', resolvedBy: string) {
  const approvals = readJson<ApprovalRecord[]>(APPROVALS_PATH, []);
  const rec = approvals.find(a => a.approval_id === approvalId);
  if (rec) {
    rec.status = status;
    rec.resolved_at = new Date().toISOString();
    rec.resolved_by = resolvedBy;
    writeJson(APPROVALS_PATH, approvals);
  }
}

export function getApprovals(limit = 50): ApprovalRecord[] {
  return readJson<ApprovalRecord[]>(APPROVALS_PATH, []).slice(-limit).reverse();
}

export function getPendingWhatsAppApprovals(): ApprovalRecord[] {
  return readJson<ApprovalRecord[]>(APPROVALS_PATH, []).filter(a => a.status === 'pending');
}

// ── Error log ───────────────────────────────────────────────────────────────
export function logError(entry: ErrorRecord) {
  const errors = readJson<ErrorRecord[]>(ERRORS_PATH, []);
  errors.push(entry);
  if (errors.length > 500) errors.splice(0, errors.length - 500);
  writeJson(ERRORS_PATH, errors);
}

export function getErrors(limit = 50): ErrorRecord[] {
  return readJson<ErrorRecord[]>(ERRORS_PATH, []).slice(-limit).reverse();
}

// ── Sync metadata ───────────────────────────────────────────────────────────
export function updateLastSync() {
  writeJson(LAST_SYNC_PATH, { last_sync: new Date().toISOString() });
}

export function getLastSync(): string | null {
  try {
    const data = readJson<{ last_sync: string }>(LAST_SYNC_PATH, { last_sync: '' });
    return data.last_sync || null;
  } catch {
    return null;
  }
}

// ── Summary (admin stats) ───────────────────────────────────────────────────
export function getSummary(): {
  total_messages: number;
  total_groups: number;
  total_approvals: number;
  pending_approvals: number;
  last_message_at: string;
  last_sync: string | null;
  recent_errors: number;
} {
  const messages = readJson<WhatsAppMessage[]>(MESSAGES_PATH, []);
  const groups = readJson<WhatsAppGroup[]>(GROUPS_PATH, []);
  const approvals = readJson<ApprovalRecord[]>(APPROVALS_PATH, []);
  const errors = readJson<ErrorRecord[]>(ERRORS_PATH, []);
  const lastSync = getLastSync();

  return {
    total_messages: messages.length,
    total_groups: groups.length,
    total_approvals: approvals.length,
    pending_approvals: approvals.filter(a => a.status === 'pending').length,
    last_message_at: messages.length > 0 ? messages[messages.length - 1].timestamp : '',
    last_sync: lastSync,
    recent_errors: errors.filter(e => Date.now() - new Date(e.ts).getTime() < 86400000).length, // last 24h
  };
}
