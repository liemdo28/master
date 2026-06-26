/**
 * Executive Briefing — priorities, risks, approvals, store status
 */
import fs from 'fs';
import path from 'path';
import { getActionItems } from './context-memory';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';

function readJson<T>(file: string, def: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return def; }
}

// ── Data sources ──────────────────────────────────────────────────────────────

function loadApprovals() {
  const p = path.join(GLOBAL_DIR, 'connectors', 'whatsapp', 'approvals.json');
  return readJson<any[]>(p, []);
}

function loadFoodSafety() {
  const p = path.join(GLOBAL_DIR, 'visibility', 'food-safety', 'data.json');
  return readJson<any>(p, { status: 'no_data', recent_submissions: [], total_records: 0 });
}

function loadProjects() {
  const p = path.join(GLOBAL_DIR, 'visibility', 'projects', 'summary.json');
  return readJson<any>(p, { total: 0, with_issues: 0 });
}

function loadDailySnapshot() {
  const p = path.join(GLOBAL_DIR, 'visibility', 'daily-snapshot.json');
  return readJson<any>(p, {});
}

// ── Priority Engine ───────────────────────────────────────────────────────────

export interface Priority {
  level: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  detail: string;
  action?: string;
}

function detectPriorities(): Priority[] {
  const priorities: Priority[] = [];

  // Pending approvals
  const approvals = loadApprovals().filter((a: any) => a.status === 'pending');
  if (approvals.length > 0) {
    priorities.push({
      level: approvals.length > 3 ? 'critical' : 'high',
      category: 'approvals',
      title: `${approvals.length} pending approval${approvals.length > 1 ? 's' : ''}`,
      detail: approvals.slice(0, 3).map((a: any) => `• ${a.action_description?.slice(0, 60) || a.approval_id}`).join('\n'),
      action: '/mi approval summary',
    });
  }

  // Open action items
  const openItems = getActionItems({ status: 'open' });
  if (openItems.length > 0) {
    priorities.push({
      level: openItems.length > 5 ? 'high' : 'medium',
      category: 'action_items',
      title: `${openItems.length} open action item${openItems.length > 1 ? 's' : ''}`,
      detail: openItems.slice(0, 3).map(a => `• ${a.text.slice(0, 60)}${a.owner ? ' → ' + a.owner : ''}`).join('\n'),
      action: '/mi action items',
    });
  }

  // Project issues
  const projects = loadProjects();
  if (projects.with_issues > 0) {
    priorities.push({
      level: 'high',
      category: 'projects',
      title: `${projects.with_issues} project${projects.with_issues > 1 ? 's' : ''} with issues`,
      detail: `${projects.total} total projects tracked`,
      action: '/mi store status',
    });
  }

  // Food safety
  const fs_data = loadFoodSafety();
  if (fs_data.status === 'no_data') {
    priorities.push({
      level: 'low',
      category: 'food_safety',
      title: 'Food safety pilot not started',
      detail: 'Stone Oak pilot tracking pending.',
      action: '/mi food safety summary',
    });
  } else if (fs_data.recent_submissions?.some((s: any) => s.status !== 'pass')) {
    priorities.push({
      level: 'high',
      category: 'food_safety',
      title: 'Food safety issues detected',
      detail: 'One or more recent submissions have issues.',
      action: '/mi food safety summary',
    });
  }

  return priorities.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.level] - order[b.level];
  });
}

// ── Risk Engine ───────────────────────────────────────────────────────────────

export interface Risk {
  severity: 'critical' | 'high' | 'medium' | 'low';
  area: string;
  description: string;
  mitigation?: string;
}

function detectRisks(): Risk[] {
  const risks: Risk[] = [];
  const approvals = loadApprovals().filter((a: any) => a.status === 'pending');
  const snapshot = loadDailySnapshot();

  // Stale approvals (> 24h)
  const staleApprovals = approvals.filter((a: any) => {
    const age = Date.now() - new Date(a.created_at || 0).getTime();
    return age > 24 * 60 * 60 * 1000;
  });
  if (staleApprovals.length > 0) {
    risks.push({
      severity: 'high',
      area: 'approvals',
      description: `${staleApprovals.length} approval${staleApprovals.length > 1 ? 's' : ''} pending > 24h`,
      mitigation: 'Review and approve/reject to unblock operations.',
    });
  }

  // System connectivity
  if (snapshot.connector_errors > 0) {
    risks.push({
      severity: 'medium',
      area: 'connectivity',
      description: `${snapshot.connector_errors} connector error${snapshot.connector_errors > 1 ? 's' : ''} in last sync`,
      mitigation: 'Check connector registry and re-sync.',
    });
  }

  return risks;
}

// ── Store Status ──────────────────────────────────────────────────────────────

interface StoreStatus {
  name: string;
  location: string;
  operational: boolean;
  food_safety: string;
  last_check: string;
}

function getStoreStatuses(): StoreStatus[] {
  const fsData = loadFoodSafety();
  const now = new Date().toLocaleDateString('vi');
  return [
    {
      name: 'Bakudan Ramen',
      location: 'San Antonio, TX',
      operational: true,
      food_safety: fsData.status === 'no_data' ? 'pilot pending' : 'tracking active',
      last_check: now,
    },
    {
      name: 'Raw Sushi Bar',
      location: 'Stockton, CA',
      operational: true,
      food_safety: 'standard monitoring',
      last_check: now,
    },
  ];
}

// ── Briefing Generator ────────────────────────────────────────────────────────

export interface ExecutiveBriefing {
  generated_at: string;
  date_label: string;
  priorities: Priority[];
  risks: Risk[];
  store_statuses: StoreStatus[];
  pending_approvals_count: number;
  open_action_items_count: number;
  formatted: string;
}

export function generateExecutiveBriefing(): ExecutiveBriefing {
  const now = new Date();
  const dateLabel = now.toLocaleDateString('vi', { weekday: 'long', day: 'numeric', month: 'long' });
  const priorities = detectPriorities();
  const risks = detectRisks();
  const stores = getStoreStatuses();
  const approvals = loadApprovals().filter((a: any) => a.status === 'pending');
  const openItems = getActionItems({ status: 'open' });

  const lines: string[] = [
    `📊 *Executive Briefing — ${dateLabel}*`,
    '',
  ];

  // Priorities
  if (priorities.length > 0) {
    lines.push('🎯 *Priorities*');
    for (const p of priorities.slice(0, 4)) {
      const icon = p.level === 'critical' ? '🔴' : p.level === 'high' ? '🟠' : p.level === 'medium' ? '🟡' : '🟢';
      lines.push(`${icon} ${p.title}`);
      if (p.detail) lines.push(p.detail);
    }
    lines.push('');
  }

  // Risks
  if (risks.length > 0) {
    lines.push('⚠️ *Risks*');
    for (const r of risks.slice(0, 3)) {
      lines.push(`• [${r.severity.toUpperCase()}] ${r.description}`);
      if (r.mitigation) lines.push(`  → ${r.mitigation}`);
    }
    lines.push('');
  }

  // Approvals
  lines.push(`✅ *Approvals*: ${approvals.length} pending`);
  if (approvals.length > 0) lines.push('  Reply: /mi approval summary');
  lines.push('');

  // Stores
  lines.push('🏪 *Stores*');
  for (const s of stores) {
    lines.push(`• ${s.name} (${s.location}): ${s.operational ? 'Online' : 'Offline'} | Food safety: ${s.food_safety}`);
  }

  const formatted = lines.join('\n');

  return {
    generated_at: now.toISOString(),
    date_label: dateLabel,
    priorities,
    risks,
    store_statuses: stores,
    pending_approvals_count: approvals.length,
    open_action_items_count: openItems.length,
    formatted,
  };
}
