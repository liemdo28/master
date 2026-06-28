/**
 * department-scorecard.ts
 * Tracks department performance metrics.
 */
import type { DepartmentId } from './department-registry';

export interface DepartmentScorecard {
  department: DepartmentId;
  tasks_owned: number;
  tasks_completed: number;
  tasks_pending: number;
  tasks_handed_off: number;
  support_requests_made: number;
  support_requests_received: number;
  boundary_violations: number;
  last_updated: string;
}

const scorecards = new Map<DepartmentId, DepartmentScorecard>();

export function getScorecard(dept: DepartmentId): DepartmentScorecard {
  return scorecards.get(dept) ?? {
    department: dept,
    tasks_owned: 0,
    tasks_completed: 0,
    tasks_pending: 0,
    tasks_handed_off: 0,
    support_requests_made: 0,
    support_requests_received: 0,
    boundary_violations: 0,
    last_updated: new Date().toISOString(),
  };
}

export function updateScorecard(dept: DepartmentId, update: Partial<DepartmentScorecard>): void {
  const current = getScorecard(dept);
  scorecards.set(dept, { ...current, ...update, last_updated: new Date().toISOString() });
}

export function getAllScorecards(): DepartmentScorecard[] {
  return [...scorecards.values()];
}
