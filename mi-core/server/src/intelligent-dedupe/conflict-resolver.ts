/**
 * conflict-resolver.ts
 * Resolves cross-agent, cross-department task conflicts.
 */
import type { DepartmentId } from '../department-map/department-registry';

export interface Conflict {
  entity_type: 'task' | 'workflow' | 'objective';
  entity_id: string;
  claimants: Array<{ department: DepartmentId; claimed_at: string }>;
  resolution: 'assigned_to' | 'shared' | 'escalated' | 'blocked';
  resolved_to?: DepartmentId;
  reason: string;
}

const conflicts = new Map<string, Conflict>();

export function registerConflict(entity: Conflict): Conflict {
  conflicts.set(entity.entity_id, entity);
  return entity;
}

export function resolveConflict(entityId: string, resolution: 'assigned_to' | 'shared' | 'escalated' | 'blocked', resolvedTo?: DepartmentId): Conflict | null {
  const existing = conflicts.get(entityId);
  if (!existing) return null;
  const resolved: Conflict = { ...existing, resolution, resolved_to: resolvedTo };
  conflicts.set(entityId, resolved);
  return resolved;
}

export function getConflict(entityId: string): Conflict | null {
  return conflicts.get(entityId) ?? null;
}

export function resolveOwnerConflict(claimants: Array<{ department: DepartmentId; claimed_at: string }>, entityId: string, entityType: Conflict['entity_type']): DepartmentId {
  // Priority: executive > finance > operations > marketing > it > ...
  const priority: DepartmentId[] = ['executive', 'finance', 'operations', 'marketing', 'creative', 'it', 'engineering', 'data-platform', 'security', 'customer-experience', 'hr-labor', 'procurement'];
  
  const sorted = [...claimants].sort((a, b) => {
    return priority.indexOf(a.department) - priority.indexOf(b.department);
  });

  const winner = sorted[0].department;
  registerConflict({ entity_type: entityType, entity_id: entityId, claimants, resolution: 'assigned_to', resolved_to: winner, reason: `Resolved by priority: ${winner} wins` });
  return winner;
}
