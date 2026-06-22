/**
 * Ownership Intelligence Service — Phase 14.4
 * Higher-level ownership queries: blocker ownership, overloaded owners, unowned items.
 */

import { findEntities, getInEdges, getOutEdges } from './graph-db';
import { getOwnership, getOwnerLoad, findUnownedEntities, type OwnershipInfo, type OwnerLoadReport } from './ownership-graph';
import { analyzeImpact } from './dependency-intelligence';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BlockerOwnership {
  blocker_id: string;
  blocker_name: string;
  blocker_type: string;
  owner_name: string | null;
  owner_id: string | null;
  escalation_path: string;
  impact_count: number;
}

export interface OwnershipSummary {
  total_owners: number;
  total_entities: number;
  owned_count: number;
  unowned_count: number;
  overloaded_owners: OwnerLoadReport[];
  unowned_entities: Array<{ id: string; name: string; type: string }>;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function whoOwns(entityId: string): OwnershipInfo {
  return getOwnership(entityId);
}

export function getOwnerWorkload(ownerId: string): OwnerLoadReport {
  return getOwnerLoad(ownerId);
}

export function findOverloadedOwners(threshold = 8): OwnerLoadReport[] {
  const owners = findEntities('owner');
  const teams = findEntities('team');
  return [...owners, ...teams]
    .map(e => getOwnerLoad(e.id))
    .filter(r => r.total_load >= threshold)
    .sort((a, b) => b.total_load - a.total_load);
}

export function getBlockerOwnership(blockerId: string): BlockerOwnership {
  const ownership = getOwnership(blockerId);
  const impact = analyzeImpact(blockerId);

  const owner = ownership.owners[0];
  const escalationPath = owner
    ? `${owner.name} → CEO review if unresolved > 30min`
    : 'No owner assigned → CEO direct escalation required';

  return {
    blocker_id: blockerId,
    blocker_name: ownership.entity_name,
    blocker_type: ownership.entity_type,
    owner_name: owner?.name || null,
    owner_id: owner?.id || null,
    escalation_path: escalationPath,
    impact_count: impact.total_impacted,
  };
}

export function getOwnershipSummary(): OwnershipSummary {
  const owners = findEntities('owner');
  const teams = findEntities('team');
  const allOwners = [...owners, ...teams];

  const unowned = findUnownedEntities();
  const overloaded = findOverloadedOwners(8);

  const allEntities = findEntities();
  const ownedCount = allEntities.length - unowned.unowned_count - allOwners.length;

  return {
    total_owners: allOwners.length,
    total_entities: allEntities.length,
    owned_count: ownedCount,
    unowned_count: unowned.unowned_count,
    overloaded_owners: overloaded,
    unowned_entities: unowned.unowned,
  };
}
