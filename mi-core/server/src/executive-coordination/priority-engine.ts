/**
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