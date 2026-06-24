/**
 * WhatsApp Context Memory
 * Persistent store for group history, participant history, action items, weekly summaries.
 */
import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const MEM_DIR = path.join(GLOBAL_DIR, 'connectors', 'whatsapp', 'context-memory');

const FILES = {
  group_history:    path.join(MEM_DIR, 'group_history.json'),
  participants:     path.join(MEM_DIR, 'participants.json'),
  action_items:     path.join(MEM_DIR, 'action_items.json'),
  weekly_summaries: path.join(MEM_DIR, 'weekly_summaries.json'),
};

function ensureDir() { fs.mkdirSync(MEM_DIR, { recursive: true }); }

function readJson<T>(file: string, defaultVal: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return defaultVal; }
}

function writeJson(file: string, data: unknown) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface GroupMessage {
  message_id: string;
  chat_id: string;
  sender: string;
  sender_name: string;
  text: string;
  timestamp: string;
  intent?: string;
}

export interface ParticipantRecord {
  sender: string;
  sender_name: string;
  chat_ids: string[];
  first_seen: string;
  last_seen: string;
  message_count: number;
  topics: string[];
}

export interface ActionItem {
  id: string;
  source_message_id: string;
  chat_id: string;
  text: string;
  owner?: string;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  created_at: string;
  updated_at: string;
  due_date?: string;
  approval_id?: string;
}

export interface WeeklySummary {
  week_start: string;
  week_end: string;
  total_messages: number;
  active_groups: string[];
  top_participants: string[];
  action_items_created: number;
  action_items_completed: number;
  key_topics: string[];
  summary_text: string;
  generated_at: string;
}

// ── Group History ─────────────────────────────────────────────────────────────

export function appendGroupMessage(msg: GroupMessage) {
  ensureDir();
  const all = readJson<Record<string, GroupMessage[]>>(FILES.group_history, {});
  if (!all[msg.chat_id]) all[msg.chat_id] = [];
  all[msg.chat_id].unshift(msg);
  // Keep last 200 messages per group
  if (all[msg.chat_id].length > 200) all[msg.chat_id] = all[msg.chat_id].slice(0, 200);
  writeJson(FILES.group_history, all);
}

export function getGroupHistory(chatId: string, limit = 20): GroupMessage[] {
  const all = readJson<Record<string, GroupMessage[]>>(FILES.group_history, {});
  return (all[chatId] || []).slice(0, limit);
}

export function getAllGroupIds(): string[] {
  const all = readJson<Record<string, GroupMessage[]>>(FILES.group_history, {});
  return Object.keys(all);
}

// ── Participant History ───────────────────────────────────────────────────────

export function upsertParticipant(sender: string, senderName: string, chatId: string, topic?: string) {
  ensureDir();
  const all = readJson<Record<string, ParticipantRecord>>(FILES.participants, {});
  const key = sender.replace(/\D/g, '');
  const now = new Date().toISOString();
  if (!all[key]) {
    all[key] = { sender, sender_name: senderName, chat_ids: [], first_seen: now, last_seen: now, message_count: 0, topics: [] };
  }
  all[key].last_seen = now;
  all[key].message_count++;
  if (!all[key].chat_ids.includes(chatId)) all[key].chat_ids.push(chatId);
  if (topic && !all[key].topics.includes(topic)) all[key].topics.unshift(topic);
  if (all[key].topics.length > 20) all[key].topics = all[key].topics.slice(0, 20);
  writeJson(FILES.participants, all);
}

export function getParticipant(sender: string): ParticipantRecord | null {
  const all = readJson<Record<string, ParticipantRecord>>(FILES.participants, {});
  return all[sender.replace(/\D/g, '')] || null;
}

export function getAllParticipants(): ParticipantRecord[] {
  const all = readJson<Record<string, ParticipantRecord>>(FILES.participants, {});
  return Object.values(all).sort((a, b) => b.message_count - a.message_count);
}

// ── Action Items ──────────────────────────────────────────────────────────────

export function createActionItem(item: Omit<ActionItem, 'id' | 'created_at' | 'updated_at'>): ActionItem {
  ensureDir();
  const all = readJson<ActionItem[]>(FILES.action_items, []);
  const now = new Date().toISOString();
  const newItem: ActionItem = {
    ...item,
    id: 'AI-' + Date.now().toString(36).toUpperCase(),
    created_at: now,
    updated_at: now,
  };
  all.unshift(newItem);
  writeJson(FILES.action_items, all);
  return newItem;
}

export function updateActionItem(id: string, updates: Partial<ActionItem>): boolean {
  const all = readJson<ActionItem[]>(FILES.action_items, []);
  const idx = all.findIndex(a => a.id === id);
  if (idx === -1) return false;
  all[idx] = { ...all[idx], ...updates, updated_at: new Date().toISOString() };
  writeJson(FILES.action_items, all);
  return true;
}

export function getActionItems(filter?: { status?: ActionItem['status']; chatId?: string; owner?: string }): ActionItem[] {
  const all = readJson<ActionItem[]>(FILES.action_items, []);
  return all.filter(a => {
    if (filter?.status && a.status !== filter.status) return false;
    if (filter?.chatId && a.chat_id !== filter.chatId) return false;
    if (filter?.owner && a.owner !== filter.owner) return false;
    return true;
  });
}

export function getActionItemById(id: string): ActionItem | null {
  const all = readJson<ActionItem[]>(FILES.action_items, []);
  return all.find(a => a.id === id) || null;
}

// ── Weekly Summaries ──────────────────────────────────────────────────────────

export function saveWeeklySummary(summary: WeeklySummary) {
  ensureDir();
  const all = readJson<WeeklySummary[]>(FILES.weekly_summaries, []);
  // Replace if same week exists
  const idx = all.findIndex(s => s.week_start === summary.week_start);
  if (idx >= 0) all[idx] = summary;
  else all.unshift(summary);
  if (all.length > 52) all.length = 52; // keep 1 year
  writeJson(FILES.weekly_summaries, all);
}

export function getLatestWeeklySummary(): WeeklySummary | null {
  const all = readJson<WeeklySummary[]>(FILES.weekly_summaries, []);
  return all[0] || null;
}

export function getWeeklySummaries(limit = 4): WeeklySummary[] {
  const all = readJson<WeeklySummary[]>(FILES.weekly_summaries, []);
  return all.slice(0, limit);
}

// ── Generate weekly summary from stored data ──────────────────────────────────

export function generateWeeklySummaryText(): string {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const groupIds = getAllGroupIds();
  const participants = getAllParticipants().slice(0, 5);
  const openItems = getActionItems({ status: 'open' });
  const doneItems = getActionItems({ status: 'done' });

  const summary: WeeklySummary = {
    week_start: weekStart.toISOString().slice(0, 10),
    week_end: now.toISOString().slice(0, 10),
    total_messages: groupIds.reduce((sum, id) => sum + getGroupHistory(id, 200).length, 0),
    active_groups: groupIds,
    top_participants: participants.map(p => p.sender_name || p.sender),
    action_items_created: openItems.length + doneItems.length,
    action_items_completed: doneItems.length,
    key_topics: [...new Set(participants.flatMap(p => p.topics).slice(0, 10))],
    summary_text: '',
    generated_at: now.toISOString(),
  };

  summary.summary_text = [
    `📅 Weekly Summary (${summary.week_start} → ${summary.week_end})`,
    `• Active groups: ${summary.active_groups.length}`,
    `• Total messages tracked: ${summary.total_messages}`,
    `• Action items open: ${openItems.length} | completed: ${doneItems.length}`,
    `• Top participants: ${summary.top_participants.slice(0, 3).join(', ') || 'None yet'}`,
    summary.key_topics.length ? `• Key topics: ${summary.key_topics.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  saveWeeklySummary(summary);
  return summary.summary_text;
}

export function getContextMemoryStats() {
  const groupIds = getAllGroupIds();
  const participants = getAllParticipants();
  const actionItems = getActionItems();
  const summaries = getWeeklySummaries(1);
  return {
    groups_tracked: groupIds.length,
    participants_tracked: participants.length,
    action_items_total: actionItems.length,
    action_items_open: actionItems.filter(a => a.status === 'open').length,
    action_items_done: actionItems.filter(a => a.status === 'done').length,
    weekly_summaries_stored: getWeeklySummaries(52).length,
    last_summary: summaries[0]?.week_start || null,
  };
}
