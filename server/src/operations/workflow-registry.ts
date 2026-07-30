/**
 * O2 + O7 — Workflow Registry & Analytics
 * Every workflow Mi creates is recorded here with full traceability.
 */

import { getOpsDb, nowIso, shortId } from './ops-db';

export type WorkflowStatus =
  | 'pending_approval'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type WorkflowCategory =
  | 'seo' | 'website' | 'marketing' | 'email'
  | 'finance' | 'qb' | 'deploy' | 'flyer'
  | 'social' | 'campaign' | 'task' | 'general';

export interface Workflow {
  id: string;
  owner: string;
  target: string;
  intent: string;
  entity?: string;
  category: WorkflowCategory;
  status: WorkflowStatus;
  approval_id?: string;
  evidence?: string;
  created_at: string;
  updated_at: string;
}

export function registerWorkflow(params: {
  owner: string;
  target: string;
  intent: string;
  entity?: string;
  category?: WorkflowCategory;
  approval_id?: string;
  evidence?: Record<string, unknown>;
}): Workflow {
  const db = getOpsDb();
  const id = shortId('wf');
  const now = nowIso();
  const category = params.category ?? detectCategory(params.intent);

  db.prepare(`
    INSERT INTO workflows (id, owner, target, intent, entity, category, status, approval_id, evidence, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?, ?, ?)
  `).run(
    id, params.owner, params.target, params.intent,
    params.entity ?? null, category,
    params.approval_id ?? null,
    params.evidence ? JSON.stringify(params.evidence) : null,
    now, now,
  );

  return { id, owner: params.owner, target: params.target, intent: params.intent,
    entity: params.entity, category, status: 'pending_approval',
    approval_id: params.approval_id, created_at: now, updated_at: now };
}

export function updateWorkflowStatus(
  id: string,
  status: WorkflowStatus,
  evidence?: Record<string, unknown>,
): boolean {
  const db = getOpsDb();
  const now = nowIso();
  const r = db.prepare(`
    UPDATE workflows SET status=?, updated_at=?${evidence ? ', evidence=?' : ''} WHERE id=?
  `).run(status, now, ...(evidence ? [JSON.stringify(evidence)] : []), id);
  return r.changes > 0;
}

export function getWorkflows(opts: { status?: WorkflowStatus; category?: WorkflowCategory; limit?: number } = {}): Workflow[] {
  let sql = `SELECT * FROM workflows WHERE 1=1`;
  const args: unknown[] = [];
  if (opts.status) { sql += ` AND status=?`; args.push(opts.status); }
  if (opts.category) { sql += ` AND category=?`; args.push(opts.category); }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  args.push(opts.limit ?? 100);
  return getOpsDb().prepare(sql).all(...args) as Workflow[];
}

export function getWorkflowById(id: string): Workflow | null {
  return (getOpsDb().prepare(`SELECT * FROM workflows WHERE id=?`).get(id) as Workflow) ?? null;
}

export function getWorkflowAnalytics(): {
  total: number; pending: number; approved: number; completed: number;
  failed: number; cancelled: number;
  by_category: Record<string, number>;
  approval_rate: number; completion_rate: number;
} {
  const db = getOpsDb();
  const total   = (db.prepare(`SELECT COUNT(*) as n FROM workflows`).get() as any).n;
  const pending  = (db.prepare(`SELECT COUNT(*) as n FROM workflows WHERE status='pending_approval'`).get() as any).n;
  const approved = (db.prepare(`SELECT COUNT(*) as n FROM workflows WHERE status IN ('approved','executing','completed')`).get() as any).n;
  const completed = (db.prepare(`SELECT COUNT(*) as n FROM workflows WHERE status='completed'`).get() as any).n;
  const failed   = (db.prepare(`SELECT COUNT(*) as n FROM workflows WHERE status='failed'`).get() as any).n;
  const cancelled = (db.prepare(`SELECT COUNT(*) as n FROM workflows WHERE status='cancelled'`).get() as any).n;

  const catRows = db.prepare(`SELECT category, COUNT(*) as n FROM workflows GROUP BY category`).all() as Array<{category: string; n: number}>;
  const by_category: Record<string, number> = {};
  for (const r of catRows) by_category[r.category] = r.n;

  const decided = approved + failed + cancelled;
  const approval_rate  = decided > 0 ? Math.round((approved / decided) * 100) : 0;
  const completion_rate = approved > 0 ? Math.round((completed / approved) * 100) : 0;

  return { total, pending, approved, completed, failed, cancelled, by_category, approval_rate, completion_rate };
}

function detectCategory(intent: string): WorkflowCategory {
  const t = intent.toLowerCase();
  if (/seo|bài.*viết|content.*website/.test(t)) return 'seo';
  if (/flyer|poster|banner/.test(t)) return 'flyer';
  if (/facebook|instagram|social|caption/.test(t)) return 'social';
  if (/email.*marketing|email.*campaign|mass.*email/.test(t)) return 'email';
  if (/doordash|ubereats|campaign/.test(t)) return 'campaign';
  if (/qb|quickbooks/.test(t)) return 'qb';
  if (/finance|invoice|payment|bill|tax/.test(t)) return 'finance';
  if (/deploy|server|production/.test(t)) return 'deploy';
  if (/website|web/.test(t)) return 'website';
  if (/task|giao.*việc/.test(t)) return 'task';
  if (/marketing|quảng|ads/.test(t)) return 'marketing';
  return 'general';
}
