/**
 * CEO Approval Center — pending approvals, summary, critical triage
 */
import fs from 'fs';
import path from 'path';
import { getPending, getById, approve, reject } from '../approval/gate';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';

function readJson<T>(file: string, def: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return def; }
}

function loadWaApprovals(): any[] {
  return readJson<any[]>(path.join(GLOBAL_DIR, 'connectors', 'whatsapp', 'approvals.json'), []);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApprovalUrgency = 'critical' | 'high' | 'normal';

export interface ApprovalItem {
  id: string;
  description: string;
  category: string;
  risk_level: number;
  urgency: ApprovalUrgency;
  age_minutes: number;
  source: 'gate' | 'whatsapp';
  created_at: string;
}

export interface ApprovalSummary {
  total_pending: number;
  critical: ApprovalItem[];
  high: ApprovalItem[];
  normal: ApprovalItem[];
  oldest_age_minutes: number;
  formatted: string;
}

// ── Urgency detection ─────────────────────────────────────────────────────────

function detectUrgency(description: string, riskLevel: number, ageMinutes: number): ApprovalUrgency {
  const lower = description.toLowerCase();
  if (riskLevel >= 3 || /payroll|production|deploy|delete.*project|critical/i.test(lower)) return 'critical';
  if (riskLevel >= 2 || ageMinutes > 60 || /send|gửi|create task|task proposal/i.test(lower)) return 'high';
  return 'normal';
}

// ── Load all pending approvals ────────────────────────────────────────────────

export function loadAllPendingApprovals(): ApprovalItem[] {
  const now = Date.now();
  const items: ApprovalItem[] = [];

  // From gate (in-memory)
  const gatePending = getPending();
  for (const g of gatePending) {
    const age = Math.round((now - new Date(g.created_at).getTime()) / 60000);
    items.push({
      id: g.id,
      description: g.description || 'No description',
      category: g.category || 'general',
      risk_level: g.risk_level || 1,
      urgency: detectUrgency(g.description || '', g.risk_level || 1, age),
      age_minutes: age,
      source: 'gate',
      created_at: g.created_at,
    });
  }

  // From WhatsApp store (file-based)
  const waApprovals = loadWaApprovals().filter((a: any) => a.status === 'pending');
  const gateIds = new Set(items.map(i => i.id));
  for (const a of waApprovals) {
    if (gateIds.has(a.approval_id)) continue; // already in gate
    const age = Math.round((now - new Date(a.created_at || 0).getTime()) / 60000);
    items.push({
      id: a.approval_id,
      description: a.action_description || 'WhatsApp action',
      category: 'whatsapp',
      risk_level: 2,
      urgency: detectUrgency(a.action_description || '', 2, age),
      age_minutes: age,
      source: 'whatsapp',
      created_at: a.created_at || new Date().toISOString(),
    });
  }

  return items.sort((a, b) => {
    const order = { critical: 0, high: 1, normal: 2 };
    if (order[a.urgency] !== order[b.urgency]) return order[a.urgency] - order[b.urgency];
    return b.age_minutes - a.age_minutes; // oldest first within same urgency
  });
}

// ── Summary generator ─────────────────────────────────────────────────────────

export function generateApprovalSummary(): ApprovalSummary {
  const items = loadAllPendingApprovals();
  const critical = items.filter(i => i.urgency === 'critical');
  const high = items.filter(i => i.urgency === 'high');
  const normal = items.filter(i => i.urgency === 'normal');
  const oldest = items.reduce((max, i) => Math.max(max, i.age_minutes), 0);

  const lines: string[] = ['✅ *Approval Center*', ''];

  if (items.length === 0) {
    lines.push('Không có approval nào đang pending. ✅');
  } else {
    lines.push(`Pending: *${items.length}* tổng cộng`);
    lines.push('');

    if (critical.length > 0) {
      lines.push(`🔴 *Critical (${critical.length})*`);
      critical.slice(0, 3).forEach(a => {
        lines.push(`  • *${a.id}*`);
        lines.push(`    ${a.description.slice(0, 80)}`);
        lines.push(`    Age: ${formatAge(a.age_minutes)} | Risk: ${a.risk_level}/3`);
        lines.push(`    approve ${a.id} | cancel`);
      });
      lines.push('');
    }

    if (high.length > 0) {
      lines.push(`🟠 *High Priority (${high.length})*`);
      high.slice(0, 3).forEach(a => {
        lines.push(`  • *${a.id}* — ${a.description.slice(0, 60)}`);
        lines.push(`    Age: ${formatAge(a.age_minutes)} | reply *approve ${a.id}*`);
      });
      lines.push('');
    }

    if (normal.length > 0) {
      lines.push(`🟡 *Normal (${normal.length})*`);
      normal.slice(0, 2).forEach(a => lines.push(`  • *${a.id}* — ${a.description.slice(0, 60)}`));
      lines.push('');
    }

    if (oldest > 120) {
      lines.push(`⚠️ Oldest approval: ${formatAge(oldest)} — cần xử lý sớm.`);
    }
  }

  return {
    total_pending: items.length,
    critical,
    high,
    normal,
    oldest_age_minutes: oldest,
    formatted: lines.join('\n'),
  };
}

function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

// ── Bulk operations ───────────────────────────────────────────────────────────

export interface BulkResult {
  processed: number;
  failed: string[];
  formatted: string;
}

export function approveAllNormal(approvedBy: string): BulkResult {
  const items = loadAllPendingApprovals().filter(i => i.urgency === 'normal');
  const failed: string[] = [];
  let processed = 0;

  for (const item of items) {
    if (item.source === 'gate') {
      const ok = approve(item.id, approvedBy);
      if (ok) processed++;
      else failed.push(item.id);
    }
  }

  return {
    processed,
    failed,
    formatted: processed > 0
      ? `✅ Approved ${processed} normal-priority item(s).${failed.length ? ` Failed: ${failed.join(', ')}` : ''}`
      : 'No normal-priority items to approve.',
  };
}

export function getCriticalApprovalsSummary(): string {
  const summary = generateApprovalSummary();
  if (summary.critical.length === 0) return '✅ No critical approvals pending.';
  return summary.critical
    .slice(0, 5)
    .map(a => `🔴 *${a.id}*: ${a.description.slice(0, 80)}\n   reply *approve ${a.id}* để xác nhận`)
    .join('\n\n');
}
