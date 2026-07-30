/**
 * Task Manager — create/update/assign/complete tasks via Dashboard + Asana
 * All write actions go through approval gate.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { enqueue } from '../approval/gate';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const DASHBOARD_API = process.env.DASHBOARD_API || 'http://dashboard.bakudanramen.com';
const ASANA_TOKEN = process.env.ASANA_TOKEN || '';

export interface TaskDraft {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  due_date?: string;
  priority?: 'high' | 'medium' | 'low';
  project?: string;
  platform: 'dashboard' | 'asana';
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  approval_id?: string;
  store?: string;
  stores?: string[];
  parent_task_id?: string;
  created_at: string;
}

const DRAFTS_PATH = path.join(GLOBAL_DIR, 'mi-core', 'task-drafts.json');

function loadDrafts(): TaskDraft[] {
  try { return JSON.parse(fs.readFileSync(DRAFTS_PATH, 'utf-8')); }
  catch { return []; }
}

function saveDrafts(drafts: TaskDraft[]) {
  fs.mkdirSync(path.dirname(DRAFTS_PATH), { recursive: true });
  fs.writeFileSync(DRAFTS_PATH, JSON.stringify(drafts, null, 2));
}

function generateId(): string {
  return `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Create task draft (requires approval before execution) ─────────────────
export function createTaskDraft(params: {
  title: string;
  description?: string;
  assignee?: string;
  due_date?: string;
  priority?: 'high' | 'medium' | 'low';
  project?: string;
  platform?: 'dashboard' | 'asana';
  store?: string;
  stores?: string[];
  parent_task_id?: string;
}): TaskDraft | TaskDraft[] {
  const platform = params.platform || 'dashboard';
  const normalizedStores = Array.from(new Set((params.stores || []).map(s => s.trim()).filter(Boolean)));

  if (normalizedStores.length > 1) {
    const parentTaskId = params.parent_task_id || generateId();
    const drafts = normalizedStores.map(store => ({
      id: generateId(),
      title: params.title,
      description: params.description,
      assignee: params.assignee,
      due_date: params.due_date,
      priority: params.priority || 'medium',
      project: params.project,
      platform,
      status: 'pending_approval' as const,
      store,
      stores: [store],
      parent_task_id: parentTaskId,
      created_at: new Date().toISOString(),
    }));

    const approval = enqueue({
      risk_level: 2,
      category: 'task-create',
      target: platform,
      description: `Create ${drafts.length} tasks from multi-store request: "${params.title}"${params.assignee ? ` → ${params.assignee}` : ''}${params.due_date ? ` (due: ${params.due_date})` : ''}`,
      before_state: 'No tasks exist',
      rollback_plan: 'Reject the approval to cancel task creation',
    });

    drafts.forEach(d => { d.approval_id = approval.id; });
    const allDrafts = loadDrafts();
    allDrafts.push(...drafts);
    saveDrafts(allDrafts);
    return drafts;
  }

  const store = params.store || normalizedStores[0];
  const draft: TaskDraft = {
    id: generateId(),
    title: params.title,
    description: params.description,
    assignee: params.assignee,
    due_date: params.due_date,
    priority: params.priority || 'medium',
    project: params.project,
    platform,
    status: 'pending_approval',
    store,
    stores: store ? [store] : undefined,
    parent_task_id: params.parent_task_id,
    created_at: new Date().toISOString(),
  };

  const approval = enqueue({
    risk_level: 2,
    category: 'task-create',
    target: platform,
    description: `Create task: "${params.title}"${params.assignee ? ` → ${params.assignee}` : ''}${store ? ` [store: ${store}]` : ''}${params.due_date ? ` (due: ${params.due_date})` : ''}`,
    before_state: 'No task exists',
    rollback_plan: 'Reject the approval to cancel task creation',
  });

  draft.approval_id = approval.id;
  const drafts = loadDrafts();
  drafts.push(draft);
  saveDrafts(drafts);

  return draft;
}

// ── Parse natural language task request ────────────────────────────────────
export function parseTaskFromMessage(message: string): {
  title: string; assignee?: string; due_date?: string; priority?: 'high' | 'medium' | 'low'; store?: string; stores?: string[];
} {
  // Extract title
  let title = message
    .replace(/^(create|tạo|giao|add|thêm)\s+(task|việc|công việc|nhiệm vụ)\s*/i, '')
    .replace(/\s+(for|cho|giao cho)\s+\w+.*/i, '')
    .replace(/\s+(by|due|hạn|deadline)\s+.*/i, '')
    .trim();

  // Extract assignee
  const assigneeMatch = message.match(/(?:for|cho|giao cho|assign.*to)\s+([A-Za-z]+)/i);
  const assignee = assigneeMatch?.[1];

  // Extract due date
  const dueMatch = message.match(/(?:by|due|hạn|deadline|vào)\s+(.+?)(?:\s|$)/i);
  let due_date: string | undefined;
  if (dueMatch) {
    const raw = dueMatch[1].toLowerCase();
    const now = new Date();
    if (raw.includes('tomorrow') || raw.includes('ngày mai')) {
      now.setDate(now.getDate() + 1);
      due_date = now.toISOString().split('T')[0];
    } else if (raw.includes('friday') || raw.includes('thứ 6')) {
      const day = now.getDay();
      now.setDate(now.getDate() + (5 - day + 7) % 7);
      due_date = now.toISOString().split('T')[0];
    } else if (/\d{1,2}\/\d{1,2}/.test(raw)) {
      const [m, d] = raw.split('/').map(Number);
      due_date = `${now.getFullYear()}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
  }

  const multiStoreMatch = message.match(/(?:stores?|cửa hàng)\s*[:\-]?\s*([A-Za-z0-9À-ỹ,;&/\-\s]+)/i);
  const stores = multiStoreMatch
    ? multiStoreMatch[1]
        .split(/,|;|&|\/|\band\b|\bvà\b/i)
        .map(s => s.trim())
        .filter(Boolean)
    : [];
  const store = stores.length === 1 ? stores[0] : undefined;

  // Priority
  const priority: 'high' | 'medium' | 'low' = /urgent|khẩn|asap|priority.*high/i.test(message) ? 'high' : 'medium';

  return { title: title || message.slice(0, 80), assignee, due_date, priority, store, stores };
}

// ── List pending task drafts ────────────────────────────────────────────────
export function getPendingTaskDrafts(): TaskDraft[] {
  return loadDrafts().filter(d => d.status === 'pending_approval');
}

// ── Format task summary for Mi response ────────────────────────────────────
export function formatTaskDraftResponse(draft: TaskDraft): string {
  return [
    `✅ Task draft created:`,
    `  Title: "${draft.title}"`,
    draft.assignee ? `  Assignee: ${draft.assignee}` : '',
    draft.store ? `  Store: ${draft.store}` : '',
    draft.due_date ? `  Due: ${draft.due_date}` : '',
    `  Platform: ${draft.platform}`,
    `  Priority: ${draft.priority}`,
    ``,
    `→ Approval #${draft.approval_id} required before creating`,
    `[Approve] [Edit] [Reject]`,
  ].filter(Boolean).join('\n');
}
