/**
 * dependency-map.ts
 * Tracks cross-department task dependencies.
 */
import type { DepartmentId } from './department-registry';

export interface Dependency {
  from_task_id: string;
  to_task_id: string;
  from_department: DepartmentId;
  to_department: DepartmentId;
  dependency_type: 'blocks' | 'supports' | 'reports_to';
  created_at: string;
}

const dependencyGraph = new Map<string, Dependency[]>();

export function addDependency(dep: Omit<Dependency, 'created_at'>): Dependency {
  const full: Dependency = { ...dep, created_at: new Date().toISOString() };

  const existing = dependencyGraph.get(dep.from_task_id) ?? [];
  existing.push(full);
  dependencyGraph.set(dep.from_task_id, existing);

  return full;
}

export function getDependencies(taskId: string): Dependency[] {
  return dependencyGraph.get(taskId) ?? [];
}

export function getDependents(taskId: string): Dependency[] {
  const all = [...dependencyGraph.values()].flat();
  return all.filter((d) => d.to_task_id === taskId);
}

export function isBlocked(taskId: string): boolean {
  const deps = getDependencies(taskId);
  return deps.some((d) => d.dependency_type === 'blocks');
}

export function clearDependency(fromTaskId: string, toTaskId: string): void {
  const existing = dependencyGraph.get(fromTaskId) ?? [];
  const filtered = existing.filter((d) => d.to_task_id !== toTaskId);
  if (filtered.length > 0) {
    dependencyGraph.set(fromTaskId, filtered);
  } else {
    dependencyGraph.delete(fromTaskId);
  }
}
