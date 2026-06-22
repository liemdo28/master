/**
 * Owner Memory — Phase 15.4
 * Answers: What does Dev1 usually work on? Which owner resolves fastest? Who is overloaded?
 */

import { getDb } from './operational-memory-db';

// Role → display name mapping
const ROLE_DISPLAY: Record<string, string> = {
  developer: 'Dev1',
  engineering_manager: 'Dev1',   // Dev1 maps to both developer and engineering_manager
  product_manager: 'PM',
  qa: 'QA Agent',
  qa_agent: 'QA Agent',
  release: 'Release Agent',
  auditor: 'Auditor',
  auditor_agent: 'Auditor',
  ceo_interpreter: 'CEO Interpreter',
};

// Reverse: display name → DB role patterns
const DISPLAY_TO_ROLES: Record<string, string[]> = {
  dev1: ['developer', 'engineering_manager'],
  'engineering manager': ['engineering_manager'],
  pm: ['product_manager'],
  qa: ['qa', 'qa_agent'],
  release: ['release'],
  auditor: ['auditor', 'auditor_agent'],
};

export interface OwnerProfile {
  owner_or_role: string;
  display_name: string;
  total_actions: number;
  pass_count: number;
  fail_count: number;
  success_rate: number;
  top_targets: Array<{ target: string; count: number }>;
  top_action_types: Array<{ action_type: string; count: number }>;
  avg_duration_ms: number;
  last_active: string | null;
  load_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'OVERLOADED';
}

export interface OwnerSpeedRanking {
  owner_or_role: string;
  avg_resolution_ms: number;
  resolved_count: number;
}

function resolveRolePatterns(nameOrRole: string): string[] {
  const key = nameOrRole.toLowerCase().trim();
  return DISPLAY_TO_ROLES[key] || [key];
}

function loadLevel(count: number): OwnerProfile['load_level'] {
  if (count < 10) return 'LOW';
  if (count < 30) return 'MEDIUM';
  if (count < 60) return 'HIGH';
  return 'OVERLOADED';
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** What does a given owner/role usually work on? */
export function getOwnerProfile(ownerOrRole: string): OwnerProfile {
  const db = getDb();
  const patterns = resolveRolePatterns(ownerOrRole);

  // Build OR condition for matching owner or agent_role
  const placeholders = patterns.map(() => '?').join(', ');
  const params = [...patterns, ...patterns];

  const rows = db.prepare(`
    SELECT * FROM owner_actions
    WHERE agent_role IN (${placeholders}) OR owner IN (${placeholders})
    ORDER BY ts DESC
  `).all(...params) as any[];

  const passes = rows.filter(r => r.verdict === 'PASS').length;
  const fails = rows.filter(r => r.verdict === 'FAIL').length;
  const avgDur = rows.length
    ? rows.reduce((s: number, r: any) => s + (r.duration_ms || 0), 0) / rows.length
    : 0;

  // Top targets
  const targetCounts: Record<string, number> = {};
  for (const r of rows) {
    if (r.target) targetCounts[r.target] = (targetCounts[r.target] || 0) + 1;
  }
  const topTargets = Object.entries(targetCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([target, count]) => ({ target, count }));

  // Top action types
  const actionCounts: Record<string, number> = {};
  for (const r of rows) {
    actionCounts[r.action_type] = (actionCounts[r.action_type] || 0) + 1;
  }
  const topActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([action_type, count]) => ({ action_type, count }));

  const displayName = ROLE_DISPLAY[patterns[0]] || ownerOrRole;

  return {
    owner_or_role: ownerOrRole,
    display_name: displayName,
    total_actions: rows.length,
    pass_count: passes,
    fail_count: fails,
    success_rate: rows.length ? Math.round((passes / rows.length) * 100) : 0,
    top_targets: topTargets,
    top_action_types: topActions,
    avg_duration_ms: Math.round(avgDur),
    last_active: rows[0]?.ts || null,
    load_level: loadLevel(rows.length),
  };
}

/** Which roles are most active in a time window */
export function getOwnerActivityRanking(days = 30): Array<{
  agent_role: string;
  display_name: string;
  total_actions: number;
  success_rate: number;
  load_level: string;
}> {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();

  const rows = db.prepare(`
    SELECT agent_role,
           COUNT(*) as total_actions,
           ROUND(AVG(CASE WHEN verdict='PASS' THEN 100.0 ELSE 0 END), 1) as success_rate
    FROM owner_actions
    WHERE ts >= ?
    GROUP BY agent_role
    ORDER BY total_actions DESC
  `).all(cutoff) as any[];

  return rows.map(r => ({
    agent_role: r.agent_role,
    display_name: ROLE_DISPLAY[r.agent_role] || r.agent_role,
    total_actions: r.total_actions,
    success_rate: r.success_rate,
    load_level: loadLevel(r.total_actions),
  }));
}

/** Which owner/role resolves issues fastest */
export function getResolutionSpeedRanking(): OwnerSpeedRanking[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT agent_role,
           AVG(duration_ms) as avg_ms,
           COUNT(*) as cnt
    FROM owner_actions
    WHERE verdict = 'PASS' AND duration_ms > 0
    GROUP BY agent_role
    ORDER BY avg_ms ASC
  `).all() as any[];

  return rows.map(r => ({
    owner_or_role: ROLE_DISPLAY[r.agent_role] || r.agent_role,
    avg_resolution_ms: Math.round(r.avg_ms),
    resolved_count: r.cnt,
  }));
}

/** Which roles appear overloaded (action count > threshold) */
export function getOverloadedOwners(threshold = 50): Array<{
  agent_role: string;
  display_name: string;
  action_count: number;
}> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT agent_role, COUNT(*) as c
    FROM owner_actions
    GROUP BY agent_role
    HAVING c >= ?
    ORDER BY c DESC
  `).all(threshold) as any[];

  return rows.map(r => ({
    agent_role: r.agent_role,
    display_name: ROLE_DISPLAY[r.agent_role] || r.agent_role,
    action_count: r.c,
  }));
}
