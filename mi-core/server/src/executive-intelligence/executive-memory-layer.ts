/**
 * Executive Memory Layer — Phase 21E
 * Maintains long-term company context that survives reboot and session restart.
 *
 * Tracks: incidents, recurring failures, CEO priorities, business goals,
 * operational risks, department performance — all persisted to disk.
 *
 * Extends the existing executive-memory.ts (Phase 15) with intelligence-layer
 * specific data structures for executive reasoning.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ── Storage paths ──────────────────────────────────────────────────────────────

const MI_CORE_ROOT = path.resolve(__dirname, '..', '..', '..');
const GLOBAL_DIR = process.env.GLOBAL_DIR || path.join(MI_CORE_ROOT, '.local-agent-global');
const MEMORY_DIR = path.join(GLOBAL_DIR, 'executive-intelligence-memory');

const FILES = {
  incidents: path.join(MEMORY_DIR, 'incidents.json'),
  recurring_failures: path.join(MEMORY_DIR, 'recurring_failures.json'),
  ceo_priorities: path.join(MEMORY_DIR, 'ceo_priorities.json'),
  business_goals: path.join(MEMORY_DIR, 'business_goals.json'),
  operational_risks: path.join(MEMORY_DIR, 'operational_risks.json'),
  department_scores: path.join(MEMORY_DIR, 'department_scores.json'),
  reasoning_history: path.join(MEMORY_DIR, 'reasoning_history.json'),
  context_snapshots: path.join(MEMORY_DIR, 'context_snapshots.json'),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface Incident {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  category: string;
  affected_systems: string[];
  resolved: boolean;
  resolved_at?: string;
  root_cause?: string;
  resolution?: string;
}

export interface RecurringFailure {
  id: string;
  pattern: string;
  first_seen: string;
  last_seen: string;
  occurrences: number;
  affected_systems: string[];
  resolution_history: string[];
  current_status: 'active' | 'resolved' | 'monitoring';
}

export interface CEOPriority {
  id: string;
  set_at: string;
  priority: string;
  category: string;
  urgency: SeverityLevel;
  status: 'active' | 'completed' | 'deferred';
  notes: string[];
}

export interface BusinessGoal {
  id: string;
  goal: string;
  target_date: string;
  progress: number;     // 0-100
  status: 'on_track' | 'at_risk' | 'behind' | 'completed';
  metrics: Record<string, number>;
  last_updated: string;
}

export interface OperationalRisk {
  id: string;
  identified_at: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: SeverityLevel;
  mitigation: string;
  status: 'open' | 'mitigated' | 'accepted' | 'closed';
}

export interface DepartmentScore {
  id: string;
  department: string;
  timestamp: string;
  score: number;        // 0-100
  metrics: Record<string, number>;
  trend: 'improving' | 'stable' | 'declining';
  notes: string[];
}

export interface ReasoningEntry {
  id: string;
  timestamp: string;
  input: string;
  intent: string;
  decision: string;
  confidence: number;
  outcome?: 'correct' | 'incorrect' | 'partial';
  feedback?: string;
}

export interface ContextSnapshot {
  id: string;
  timestamp: string;
  summary: string;
  active_incidents: number;
  open_risks: number;
  department_health: Record<string, number>;
  ceo_priorities_count: number;
  overall_status: 'healthy' | 'warning' | 'critical';
}

// ── File operations ────────────────────────────────────────────────────────────

function ensureDir(): void {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── Memory store ───────────────────────────────────────────────────────────────

function getList<T>(file: string): T[] {
  return readJson<T[]>(file, []);
}

function append<T extends { id: string }>(file: string, item: T): T {
  const list = getList<T>(file);
  list.push(item);
  writeJson(file, list);
  return item;
}

function updateWhere<T extends { id: string }>(
  file: string, predicate: (item: T) => boolean, updater: (item: T) => T
): T | null {
  const list = getList<T>(file);
  const idx = list.findIndex(predicate);
  if (idx === -1) return null;
  list[idx] = updater(list[idx]);
  writeJson(file, list);
  return list[idx];
}

// ── Public API ─────────────────────────────────────────────────────────────────

export const executiveIntelligenceMemory = {
  init(): void {
    ensureDir();
    for (const file of Object.values(FILES)) {
      if (!fs.existsSync(file)) {
        writeJson(file, []);
      }
    }
  },

  // ── Incidents ──────────────────────────────────────────────────────────────

  recordIncident(data: Omit<Incident, 'id' | 'timestamp' | 'resolved'>): Incident {
    const incident: Incident = {
      ...data,
      id: `inc-${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      resolved: false,
    };
    return append(FILES.incidents, incident);
  },

  resolveIncident(id: string, rootCause: string, resolution: string): Incident | null {
    return updateWhere<Incident>(FILES.incidents, i => i.id === id, i => ({
      ...i,
      resolved: true,
      resolved_at: new Date().toISOString(),
      root_cause: rootCause,
      resolution,
    }));
  },

  getActiveIncidents(): Incident[] {
    return getList<Incident>(FILES.incidents).filter(i => !i.resolved);
  },

  getRecentIncidents(days: number = 30): Incident[] {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    return getList<Incident>(FILES.incidents).filter(i => i.timestamp >= cutoff);
  },

  // ── Recurring failures ─────────────────────────────────────────────────────

  recordRecurringFailure(data: Omit<RecurringFailure, 'id' | 'first_seen' | 'occurrences'>): RecurringFailure {
    const existing = getList<RecurringFailure>(FILES.recurring_failures)
      .find(f => f.pattern === data.pattern);

    if (existing) {
      existing.occurrences++;
      existing.last_seen = new Date().toISOString();
      writeJson(FILES.recurring_failures, getList(FILES.recurring_failures));
      return existing;
    }

    const failure: RecurringFailure = {
      ...data,
      id: `fail-${crypto.randomUUID().slice(0, 8)}`,
      first_seen: new Date().toISOString(),
      occurrences: 1,
    };
    return append(FILES.recurring_failures, failure);
  },

  getRecurringFailures(): RecurringFailure[] {
    return getList<RecurringFailure>(FILES.recurring_failures);
  },

  getActiveRecurringFailures(): RecurringFailure[] {
    return getList<RecurringFailure>(FILES.recurring_failures)
      .filter(f => f.current_status === 'active');
  },

  // ── CEO priorities ─────────────────────────────────────────────────────────

  setCEOPriority(priority: string, category: string, urgency: SeverityLevel, notes: string[] = []): CEOPriority {
    // Mark existing active priorities as deferred if same category
    const existing = getList<CEOPriority>(FILES.ceo_priorities)
      .filter(p => p.category === category && p.status === 'active');
    for (const p of existing) {
      p.status = 'deferred';
    }
    writeJson(FILES.ceo_priorities, getList<CEOPriority>(FILES.ceo_priorities));

    const item: CEOPriority = {
      id: `pri-${crypto.randomUUID().slice(0, 8)}`,
      set_at: new Date().toISOString(),
      priority,
      category,
      urgency,
      status: 'active',
      notes,
    };
    return append(FILES.ceo_priorities, item);
  },

  getActivePriorities(): CEOPriority[] {
    return getList<CEOPriority>(FILES.ceo_priorities).filter(p => p.status === 'active');
  },

  completePriority(id: string): CEOPriority | null {
    return updateWhere<CEOPriority>(FILES.ceo_priorities, p => p.id === id, p => ({
      ...p, status: 'completed' as const,
    }));
  },

  // ── Business goals ─────────────────────────────────────────────────────────

  setBusinessGoal(goal: string, targetDate: string, metrics: Record<string, number> = {}): BusinessGoal {
    const item: BusinessGoal = {
      id: `goal-${crypto.randomUUID().slice(0, 8)}`,
      goal,
      target_date: targetDate,
      progress: 0,
      status: 'on_track',
      metrics,
      last_updated: new Date().toISOString(),
    };
    return append(FILES.business_goals, item);
  },

  updateGoalProgress(id: string, progress: number, status?: BusinessGoal['status']): BusinessGoal | null {
    return updateWhere<BusinessGoal>(FILES.business_goals, g => g.id === id, g => ({
      ...g,
      progress: Math.min(100, Math.max(0, progress)),
      status: status || g.status,
      last_updated: new Date().toISOString(),
    }));
  },

  getBusinessGoals(): BusinessGoal[] {
    return getList<BusinessGoal>(FILES.business_goals);
  },

  // ── Operational risks ──────────────────────────────────────────────────────

  addOperationalRisk(data: Omit<OperationalRisk, 'id' | 'identified_at' | 'status'>): OperationalRisk {
    const risk: OperationalRisk = {
      ...data,
      id: `risk-${crypto.randomUUID().slice(0, 8)}`,
      identified_at: new Date().toISOString(),
      status: 'open',
    };
    return append(FILES.operational_risks, risk);
  },

  getOpenRisks(): OperationalRisk[] {
    return getList<OperationalRisk>(FILES.operational_risks).filter(r => r.status === 'open');
  },

  mitigateRisk(id: string, mitigation: string): OperationalRisk | null {
    return updateWhere<OperationalRisk>(FILES.operational_risks, r => r.id === id, r => ({
      ...r, status: 'mitigated' as const, mitigation,
    }));
  },

  // ── Department scores ──────────────────────────────────────────────────────

  recordDepartmentScore(dept: string, score: number, metrics: Record<string, number> = {}, notes: string[] = []): DepartmentScore {
    const history = getList<DepartmentScore>(FILES.department_scores)
      .filter(d => d.department === dept);
    const lastScore = history.length > 0 ? history[history.length - 1].score : score;
    const trend: DepartmentScore['trend'] =
      score > lastScore + 2 ? 'improving' :
      score < lastScore - 2 ? 'declining' : 'stable';

    const item: DepartmentScore = {
      id: `dept-${crypto.randomUUID().slice(0, 8)}`,
      department: dept,
      timestamp: new Date().toISOString(),
      score,
      metrics,
      trend,
      notes,
    };
    return append(FILES.department_scores, item);
  },

  getLatestDepartmentScores(): DepartmentScore[] {
    const all = getList<DepartmentScore>(FILES.department_scores);
    const latest = new Map<string, DepartmentScore>();
    for (const s of all) {
      latest.set(s.department, s);
    }
    return Array.from(latest.values());
  },

  // ── Reasoning history ���─────────────────────────────────────────────────────

  recordReasoning(input: string, intent: string, decision: string, confidence: number): ReasoningEntry {
    const item: ReasoningEntry = {
      id: `reason-${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      input,
      intent,
      decision,
      confidence,
    };
    return append(FILES.reasoning_history, item);
  },

  getRecentReasoning(count: number = 20): ReasoningEntry[] {
    return getList<ReasoningEntry>(FILES.reasoning_history).slice(-count);
  },

  // ── Context snapshots ──────────────────────────────────────────────────────

  takeContextSnapshot(): ContextSnapshot {
    const snapshot: ContextSnapshot = {
      id: `snap-${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      summary: '',
      active_incidents: this.getActiveIncidents().length,
      open_risks: this.getOpenRisks().length,
      department_health: {},
      ceo_priorities_count: this.getActivePriorities().length,
      overall_status: 'healthy',
    };

    // Department health
    const deptScores = this.getLatestDepartmentScores();
    for (const ds of deptScores) {
      snapshot.department_health[ds.department] = ds.score;
    }

    // Overall status
    if (snapshot.active_incidents > 0 || snapshot.open_risks > 3) {
      snapshot.overall_status = 'critical';
    } else if (snapshot.active_incidents > 0 || snapshot.ceo_priorities_count > 2) {
      snapshot.overall_status = 'warning';
    }

    // Summary
    snapshot.summary = [
      `Active incidents: ${snapshot.active_incidents}`,
      `Open risks: ${snapshot.open_risks}`,
      `CEO priorities: ${snapshot.ceo_priorities_count}`,
      `Department scores: ${deptScores.map(d => `${d.department}=${d.score}`).join(', ') || 'N/A'}`,
    ].join(' | ');

    append(FILES.context_snapshots, snapshot);
    return snapshot;
  },

  getLatestSnapshot(): ContextSnapshot | null {
    const snaps = getList<ContextSnapshot>(FILES.context_snapshots);
    return snaps.length > 0 ? snaps[snaps.length - 1] : null;
  },

  // ── Summary ──────────────────────────────────────────────────────────────────

  getCompanyIntelligenceSummary(): string {
    const activeIncidents = this.getActiveIncidents();
    const openRisks = this.getOpenRisks();
    const priorities = this.getActivePriorities();
    const goals = this.getBusinessGoals();
    const deptScores = this.getLatestDepartmentScores();
    const recurring = this.getActiveRecurringFailures();

    const lines: string[] = [
      '🧠 *Executive Intelligence Memory — Company Summary*',
      '',
      `🔴 Active Incidents: ${activeIncidents.length}`,
      `⚠️ Open Risks: ${openRisks.length}`,
      `🎯 CEO Priorities: ${priorities.length}`,
      `📈 Business Goals: ${goals.length} (${goals.filter(g => g.status === 'on_track').length} on track)`,
      `🔄 Recurring Failures: ${recurring.length}`,
      '',
      'Department Scores:',
    ];

    for (const ds of deptScores) {
      const trend = ds.trend === 'improving' ? '📈' : ds.trend === 'declining' ? '📉' : '➡️';
      lines.push(`  ${trend} ${ds.department}: ${ds.score}/100`);
    }

    return lines.join('\n');
  },
};
