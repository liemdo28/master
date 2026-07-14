/**
 * Knowledge Query Engine — Business Knowledge Graph Part 4
 * Query interface for the knowledge graph.
 */

import { getAllEntities, getEntitiesByType, getAllRelationships, getRelationshipsFrom, getRelationshipsTo, searchEntities, Entity, Relationship, EntityType } from './entity-registry';

export interface QueryResult {
  entities: Entity[];
  relationships: Relationship[];
  summary: {
    totalEntities: number;
    totalRelationships: number;
    entityTypes: Record<string, number>;
    relationshipTypes: Record<string, number>;
  };
}

export interface ImpactAnalysisQuery {
  entityId: string;
  direction: 'downstream' | 'upstream' | 'both';
  depth?: number;
}

export interface GraphQuery {
  type?: EntityType;
  division?: string;
  status?: string;
  search?: string;
  limit?: number;
}

export function queryGraph(q: GraphQuery): QueryResult {
  let entities = getAllEntities();
  let relationships = getAllRelationships();

  if (q.type) {
    entities = entities.filter(e => e.type === q.type);
  }
  if (q.division) {
    entities = entities.filter(e => e.metadata.division === q.division);
  }
  if (q.status) {
    entities = entities.filter(e => e.metadata.status === q.status);
  }
  if (q.search) {
    const s = searchEntities(q.search);
    const ids = new Set(s.map(e => e.id));
    entities = entities.filter(e => ids.has(e.id));
  }
  if (q.limit) {
    entities = entities.slice(0, q.limit);
  }

  // Filter relationships to only those involving queried entities
  const entityIds = new Set(entities.map(e => e.id));
  relationships = relationships.filter(r => entityIds.has(r.from) || entityIds.has(r.to));

  // Build summary
  const entityTypes: Record<string, number> = {};
  const relationshipTypes: Record<string, number> = {};
  for (const e of entities) entityTypes[e.type] = (entityTypes[e.type] ?? 0) + 1;
  for (const r of relationships) relationshipTypes[r.type] = (relationshipTypes[r.type] ?? 0) + 1;

  return {
    entities,
    relationships,
    summary: {
      totalEntities: entities.length,
      totalRelationships: relationships.length,
      entityTypes,
      relationshipTypes,
    },
  };
}

export function getEntityProfile(id: string): {
  entity: Entity | null;
  incoming: Relationship[];
  outgoing: Relationship[];
  neighbors: Entity[];
} {
  const entity = getAllEntities().find(e => e.id === id) ?? null;
  const incoming = entity ? getRelationshipsTo(id) : [];
  const outgoing = entity ? getRelationshipsFrom(id) : [];
  const neighborIds = new Set([...incoming.map(r => r.from), ...outgoing.map(r => r.to)]);
  const neighbors = getAllEntities().filter(e => neighborIds.has(e.id));

  return { entity, incoming, outgoing, neighbors };
}