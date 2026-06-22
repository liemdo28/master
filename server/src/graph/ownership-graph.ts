/**
 * Ownership Graph Service — Phase 14.2
 * Answers: Who owns X? Which owner is overloaded? Which items have no owner?
 */

import { getEntity, getInEdges, getOutEdges, findEntities, type Entity, type Edge } from './graph-db';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OwnershipInfo {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  owners: Array<{ id: string; name: string; type: string; relationship: string }>;
  has_owner: boolean;
  team_responsible: string | null;
}

export interface OwnerLoadReport {
  owner_id: string;
  owner_name: string;
  owned_count: number;
  responsible_for_count: number;
  total_load: number;
  items: Array<{ id: string; name: string; type: string; relationship: string }>;
  load_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface UnownedReport {
  total_entities: number;
  unowned_count: number;
  unowned: Array<{ id: string; name: string; type: string }>;
}

// ── Ownership queries ──────────────────────────────────────────────────────────

export function getOwnership(entityId: string): OwnershipInfo {
  const entity = getEntity(entityId);
  if (!entity) throw new Error(`Entity not found: ${entityId}`);

  // Find all inbound owner_of / responsible_for edges
  const ownerEdges = [
    ...getInEdges(entityId, 'owner_of'),
    ...getInEdges(entityId, 'responsible_for'),
  ];

  const owners = ownerEdges.map(e => {
    const ownerEntity = getEntity(e.from_id);
    return {
      id: e.from_id,
      name: ownerEntity?.name || e.from_id,
      type: ownerEntity?.type || 'unknown',
      relationship: e.relationship,
    };
  });

  const teamOwner = owners.find(o => o.type === 'team');

  return {
    entity_id: entityId,
    entity_name: entity.name,
    entity_type: entity.type,
    owners,
    has_owner: owners.length > 0,
    team_responsible: teamOwner?.name || null,
  };
}

export function getOwnerLoad(ownerId: string): OwnerLoadReport {
  const owner = getEntity(ownerId);
  if (!owner) throw new Error(`Owner not found: ${ownerId}`);

  const ownedEdges = getOutEdges(ownerId, 'owner_of');
  const responsibleEdges = getOutEdges(ownerId, 'responsible_for');

  const allEdges = [...ownedEdges, ...responsibleEdges];
  const items = allEdges.map(e => {
    const target = getEntity(e.to_id);
    return { id: e.to_id, name: target?.name || e.to_id, type: target?.type || 'unknown', relationship: e.relationship };
  });

  const total = items.length;
  const loadLevel: OwnerLoadReport['load_level'] =
    total >= 15 ? 'CRITICAL' : total >= 10 ? 'HIGH' : total >= 5 ? 'MEDIUM' : 'LOW';

  return {
    owner_id: ownerId,
    owner_name: owner.name,
    owned_count: ownedEdges.length,
    responsible_for_count: responsibleEdges.length,
    total_load: total,
    items,
    load_level: loadLevel,
  };
}

export function findUnownedEntities(): UnownedReport {
  const all = findEntities();
  const unowned: Entity[] = [];

  for (const entity of all) {
    // Owners/teams are exempt from needing an owner
    if (entity.type === 'owner' || entity.type === 'team') continue;
    const hasOwner = getInEdges(entity.id, 'owner_of').length > 0 ||
                     getInEdges(entity.id, 'responsible_for').length > 0;
    if (!hasOwner) unowned.push(entity);
  }

  return {
    total_entities: all.length,
    unowned_count: unowned.length,
    unowned: unowned.map(e => ({ id: e.id, name: e.name, type: e.type })),
  };
}

export function searchEntityByName(name: string): Entity[] {
  return findEntities(undefined, name);
}
