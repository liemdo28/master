/**
 * Impact Analysis Engine — Business Knowledge Graph Part 3
 * Analyzes what happens when an entity fails or changes.
 */

import { getEntity, getRelationshipsFrom, getRelationshipsTo, getAllEntities, Entity, Relationship } from './entity-registry';

export interface ImpactResult {
  entityId: string;
  entityName: string;
  impactLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
  impactedEntities: Array<{
    id: string;
    name: string;
    type: string;
    division: string;
    relationshipType: string;
    impactPath: string[];
  }>;
  impactedWorkflows: Array<{
    id: string;
    name: string;
    division: string;
    status: string;
  }>;
  impactedAgents: Array<{
    id: string;
    name: string;
    division: string;
    role: string;
  }>;
  impactedConnectors: Array<{
    id: string;
    name: string;
    type: string;
    division: string;
  }>;
  impactedOSS: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  pendingApprovals: Array<{
    id: string;
    name: string;
    division: string;
    status: string;
  }>;
  recommendedActions: Array<{
    action: string;
    owner: string;
    priority: string;
    approvalRequired: boolean;
  }>;
}

function traverseDownstream(entityId: string, visited = new Set<string>()): { entities: Entity[]; rels: Relationship[]; path: string[][] } {
  const entities: Entity[] = [];
  const rels: Relationship[] = [];
  const path: string[][] = [];
  const queue: Array<{ id: string; path: string[] }> = [{ id: entityId, path: [entityId] }];

  while (queue.length > 0) {
    const { id, path: currentPath } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const e = getEntity(id);
    if (e && e.id !== entityId) {
      entities.push(e);
      path.push(currentPath);
    }

    // Follow outgoing relationships (this entity affects others)
    for (const rel of getRelationshipsFrom(id)) {
      if (!visited.has(rel.to)) {
        rels.push(rel);
        queue.push({ id: rel.to, path: [...currentPath, rel.to] });
      }
    }
  }

  return { entities, rels, path };
}

function traverseUpstream(entityId: string, visited = new Set<string>()): { entities: Entity[]; rels: Relationship[]; path: string[][] } {
  const entities: Entity[] = [];
  const rels: Relationship[] = [];
  const path: string[][] = [];
  const queue: Array<{ id: string; path: string[] }> = [{ id: entityId, path: [entityId] }];

  while (queue.length > 0) {
    const { id, path: currentPath } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const e = getEntity(id);
    if (e && e.id !== entityId) {
      entities.push(e);
      path.push(currentPath);
    }

    // Follow incoming relationships (things that affect this entity)
    for (const rel of getRelationshipsTo(id)) {
      if (!visited.has(rel.from)) {
        rels.push(rel);
        queue.push({ id: rel.from, path: [...currentPath, rel.from] });
      }
    }
  }

  return { entities, rels, path };
}

export function analyzeImpact(entityId: string): ImpactResult {
  const entity = getEntity(entityId);
  if (!entity) {
    return {
      entityId,
      entityName: 'Unknown',
      impactLevel: 'none',
      impactedEntities: [],
      impactedWorkflows: [],
      impactedAgents: [],
      impactedConnectors: [],
      impactedOSS: [],
      pendingApprovals: [],
      recommendedActions: [],
    };
  }

  const downstream = traverseDownstream(entityId);
  const upstream = traverseUpstream(entityId);

  // Impacted entities (from downstream traversal)
  const impactedEntities = downstream.entities
    .filter(e => e.id !== entityId)
    .map((e, i) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      division: e.metadata.division ?? 'unknown',
      relationshipType: downstream.rels.find(r => r.to === e.id)?.type ?? 'unknown',
      impactPath: downstream.path[i] ?? [entityId, e.id],
    }));

  // Categorize by type
  const impactedWorkflows = impactedEntities
    .filter(ie => ie.type === 'Workflow')
    .map(ie => ({
      id: ie.id,
      name: ie.name,
      division: ie.division,
      status: getEntity(ie.id)?.metadata.status ?? 'unknown',
    }));

  const impactedAgents = impactedEntities
    .filter(ie => ie.type === 'Agent')
    .map(ie => {
      const agent = getEntity(ie.id);
      return {
        id: ie.id,
        name: ie.name,
        division: ie.division,
        role: String(agent?.properties.role ?? 'unknown'),
      };
    });

  const impactedConnectors = impactedEntities
    .filter(ie => ie.type === 'Connector')
    .map(ie => {
      const conn = getEntity(ie.id);
      return {
        id: ie.id,
        name: ie.name,
        type: String(conn?.properties.type ?? 'unknown'),
        division: ie.division,
      };
    });

  const impactedOSS = impactedEntities
    .filter(ie => ie.type === 'OSSTool')
    .map(ie => {
      const oss = getEntity(ie.id);
      return {
        id: ie.id,
        name: ie.name,
        category: String(oss?.properties.category ?? 'unknown'),
      };
    });

  const pendingApprovals = impactedEntities
    .filter(ie => ie.type === 'Approval')
    .map(ie => {
      const appr = getEntity(ie.id);
      return {
        id: ie.id,
        name: ie.name,
        division: ie.division,
        status: String(appr?.properties.status ?? 'unknown'),
      };
    });

  // Determine impact level
  const criticalTypes = ['Store', 'Connector', 'Workflow', 'Approval'];
  const hasCritical = impactedEntities.some(e => criticalTypes.includes(e.type));
  const hasWorkflow = impactedWorkflows.length > 0;
  const hasApproval = pendingApprovals.length > 0;
  const totalImpacted = impactedEntities.length;

  let impactLevel: ImpactResult['impactLevel'];
  if (hasCritical && hasWorkflow) impactLevel = 'critical';
  else if (hasCritical || hasWorkflow) impactLevel = 'high';
  else if (totalImpacted > 2) impactLevel = 'medium';
  else if (totalImpacted > 0) impactLevel = 'low';
  else impactLevel = 'none';

  // Generate recommended actions
  const recommendedActions: Array<{
    action: string;
    owner: string;
    priority: string;
    approvalRequired: boolean;
  }> = [];

  if (entity.type === 'Connector') {
    recommendedActions.push({
      action: `Investigate ${entity.name} connector failure`,
      owner: entity.metadata.division ?? 'ops-team',
      priority: 'P1',
      approvalRequired: false,
    });
  }

  if (impactedWorkflows.length > 0) {
    recommendedActions.push({
      action: `Review and potentially pause workflow: ${impactedWorkflows.map(w => w.name).join(', ')}`,
      owner: 'ceo',
      priority: 'P0',
      approvalRequired: true,
    });
  }

  if (pendingApprovals.length > 0) {
    recommendedActions.push({
      action: `Review pending approvals: ${pendingApprovals.map(a => a.name).join(', ')}`,
      owner: 'finance',
      priority: 'P1',
      approvalRequired: false,
    });
  }

  return {
    entityId,
    entityName: entity.name,
    impactLevel,
    impactedEntities,
    impactedWorkflows,
    impactedAgents,
    impactedConnectors,
    impactedOSS,
    pendingApprovals,
    recommendedActions,
  };
}

export function analyzeDoordashFailure(): ImpactResult {
  return analyzeImpact('connector-doordash');
}