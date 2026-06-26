/**
<<<<<<< a471ef81
 * Phase 0G — Priority Engine
 *
 * Standardize task priority across the company.
 * P0 — Company critical (revenue stopped / production down / security / payroll)
 * P1 — High impact (revenue opportunity / broken conversion / major SEO)
 * P2 — Normal work (content / optimization / reports / minor bug)
 * P3 — Low priority (cleanup / docs / refactor / nice-to-have)
 */
import { PRIORITY_WEIGHT, TaskPriority, Task } from './types';

interface Rule {
  priority: TaskPriority;
  weight: number;
  patterns: RegExp[];
  reason: string;
}

const RULES: Rule[] = [
  // P0 — Company critical
  {
    priority: 'P0', weight: PRIORITY_WEIGHT.P0,
    patterns: [
      /\b(production down|revenue stopped|payroll failure|security incident|data loss|outage|critical bug|down)\b/i,
      /\b(cannot ship|cannot deploy|blocked production|production broken)\b/i,
      /\b(urgent|emergency|asap)\b/i,
    ],
    reason: 'P0 — production / revenue critical',
  },
  // P1 — High impact
  {
    priority: 'P1', weight: PRIORITY_WEIGHT.P1,
    patterns: [
      /\b(revenue|conversion|broken|broken conversion|stale sync|major seo|failed workflow)\b/i,
      /\b(opportunity|high impact)\b/i,
      /\b(seo audit|seo improvement|gsc|ga4)\b/i,
    ],
    reason: 'P1 — high business impact',
  },
  // P3 — Low priority
  {
    priority: 'P3', weight: PRIORITY_WEIGHT.P3,
    patterns: [
      /\b(docs|documentation|refactor|cleanup|nice[- ]to[- ]have|polish)\b/i,
      /\b(rename|formatting|typo|comment)\b/i,
    ],
    reason: 'P3 — low priority / docs / cleanup',
  },
  // P2 — Normal (default)
  {
    priority: 'P2', weight: PRIORITY_WEIGHT.P2,
    patterns: [/\b(content|optimization|report|minor bug|task|update)\b/i],
    reason: 'P2 — normal work',
  },
];

export interface PriorityResult {
  priority: TaskPriority;
  score: number;
  reason: string;
}

export function autoClassify(title: string, description: string = ''): PriorityResult {
  const text = `${title} ${description}`;
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      if (re.test(text)) {
        return {
          priority: rule.priority,
          score: rule.weight,
          reason: `${rule.reason} (matched: ${re.source.slice(0, 40)})`,
        };
      }
    }
  }
  return { priority: 'P2', score: PRIORITY_WEIGHT.P2, reason: 'P2 default — no priority signal detected' };
}

export function prioritizeTask(task: Task): PriorityResult {
  return autoClassify(task.title, task.description);
}

export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
}

export function priorityBreakdown(tasks: Task[]): Record<TaskPriority, number> {
  const out: Record<TaskPriority, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const t of tasks) out[t.priority]++;
  return out;
}

// CEO override — must be logged with reason
const overrideLog: Array<{
  taskId: string; fromPriority: TaskPriority; toPriority: TaskPriority;
  reason: string; overrideBy: string; at: string;
}> = [];

export function ceoOverridePriority(
  taskId: string, newPriority: TaskPriority,
  reason: string, overrideBy: string = 'ceo',
): { logged: boolean; reason: string } {
  if (!reason || reason.length < 5) {
    return { logged: false, reason: 'override reason too short' };
  }
  overrideLog.push({
    taskId, fromPriority: 'P0', toPriority: newPriority,
    reason, overrideBy, at: new Date().toISOString(),
  });
  return { logged: true, reason: 'CEO override logged' };
}

export function getOverrideLog() { return [...overrideLog]; }
=======
 * Phase 0 — Priority Engine
 *
 * Standardizes task priority: P0, P1, P2, P3
 * Business rules:
 *   - Revenue > Documentation
 *   - Production > Nice-to-have
 *   - P0 = revenue-critical / production down
 *   - P1 = high business impact
 *   - P2 = normal work
 *   - P3 = nice-to-have / documentation
 */

import type { CoordinatedTask, Priority } from './types';

// ── Auto-classification rules ───────────────────────────────────────────────

interface PriorityRule {
  pattern: RegExp;
  priority: Priority;
  reason: string;
}

const RULES: PriorityRule[] = [
  // P0 — Revenue critical or production down
  { pattern: /\brevenue\b|\bsales\b|lost.money/i, priority: 'P0', reason: 'Revenue-critical' },
  { pattern: /production.down|\boutage\b|\bbroken\b|\bcritical\b/i, priority: 'P0', reason: 'Production down / critical' },
  { pattern: /\bdeploy\b.*\bproduction\b|\bproduction\b.*\bdeploy\b/i, priority: 'P0', reason: 'Production deployment' },
  { pattern: /\bpayroll\b|\binvoice\b|\bpayment\b/i, priority: 'P0', reason: 'Financial critical' },

  // P1 — High business impact
  { pattern: /\bdashboard\b|\breport\b|\banalytics\b|\bga4\b|\bkpi\b/i, priority: 'P1', reason: 'Business visibility' },
  { pattern: /\bseo\b|\btraffic\b|\bconversion\b|\blead\b/i, priority: 'P1', reason: 'Growth engine' },
  { pattern: /\bcustomer\b|\breview\b|\brating\b/i, priority: 'P1', reason: 'Customer-facing' },

  // P3 — Documentation / nice-to-have
  { pattern: /\bdocumentation\b|\bdocs\b|\breadme\b|\brefactor\b|\bcleanup\b/i, priority: 'P3', reason: 'Documentation / cleanup' },

  // P2 — Default for normal operational work
];

export function autoClassify(title: string, description: string): { priority: Priority; reason: string } {
  const text = `${title} ${description}`;
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return { priority: rule.priority, reason: rule.reason };
    }
  }
  return { priority: 'P2', reason: 'Default operational task' };
}

// ── Priority-aware sort ────────────────────────────────────────────────────

export function sortByPriority(tasks: CoordinatedTask[]): CoordinatedTask[] {
  const weight: Record<Priority, number> = { P0: 4, P1: 3, P2: 2, P3: 1 };
  return [...tasks].sort((a, b) => {
    if (weight[b.priority] !== weight[a.priority]) {
      return weight[b.priority] - weight[a.priority];
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

// ── Re-prioritize ───────────────────────────────────────────────────────────

export function prioritizeTask(task: CoordinatedTask, newPriority: Priority): CoordinatedTask {
  return { ...task, priority: newPriority, updatedAt: new Date().toISOString() };
}

// ── Priority Statistics ────────────────────────────────────────────────────

export function priorityBreakdown(tasks: CoordinatedTask[]): Record<Priority, number> {
  const result: Record<Priority, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const t of tasks) result[t.priority]++;
  return result;
}
>>>>>>> origin/seo/phase-29-revenue-execution-loop
