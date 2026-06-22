/**
 * Dependency Intelligence Service — Phase 14.3
 * Answers: What depends on X? What does X depend on? What breaks if X fails?
 * Single Point of Failure analysis. Critical path computation.
 */

import { getEntity, getOutEdges, getInEdges, getAllEntities, getAllEdges, type Entity } from './graph-db';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DependencyTree {
  entity_id: string;
  entity_name: string;
  depends_on: DependencyNode[];        // what this entity needs
  depended_on_by: ImpactedEntity[];    // what needs this entity
}

export interface DependencyNode {
  id: string;
  name: string;
  type: string;
  relationship: string;
  weight: number;
  depth: number;
  critical: boolean;
}

export interface ImpactAnalysis {
  failed_entity_id: string;
  failed_entity_name: string;
  directly_impacted: ImpactedEntity[];
  transitively_impacted: ImpactedEntity[];
  total_impacted: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_score: number;
  summary: string;
}

export interface ImpactedEntity {
  id: string;
  name: string;
  type: string;
  impact_path: string[];
  depth: number;
  weight: number;
}

export interface CriticalPathResult {
  entity_id: string;
  entity_name: string;
  in_degree: number;          // how many depend on this
  out_degree: number;         // how many this depends on
  is_spof: boolean;           // single point of failure
  criticality_score: number;  // 0-100
  dependents: string[];       // entity names that depend on this
}

// ── Traversal helpers ──────────────────────────────────────────────────────────

function traverseDownstream(entityId: string, visited = new Set<string>(), depth = 0, maxDepth = 6): ImpactedEntity[] {
  if (depth >= maxDepth || visited.has(entityId)) return [];
  visited.add(entityId);

  // Who depends on entityId (i.e., inbound depends_on edges)
  const dependents = getInEdges(entityId, 'depends_on');
  const results: ImpactedEntity[] = [];

  for (const edge of dependents) {
    const entity = getEntity(edge.from_id);
    if (!entity || visited.has(edge.from_id)) continue;

    results.push({
      id: edge.from_id,
      name: entity.name,
      type: entity.type,
      impact_path: [entityId, edge.from_id],
      depth,
      weight: edge.weight,
    });

    const deeper = traverseDownstream(edge.from_id, visited, depth + 1, maxDepth);
    // Update paths for deeper nodes
    results.push(...deeper.map(d => ({
      ...d,
      impact_path: [entityId, edge.from_id, ...d.impact_path.slice(1)],
    })));
  }

  return results;
}

function traverseUpstream(entityId: string, visited = new Set<string>(), depth = 0, maxDepth = 6): DependencyNode[] {
  if (depth >= maxDepth || visited.has(entityId)) return [];
  visited.add(entityId);

  const deps = getOutEdges(entityId, 'depends_on');
  const results: DependencyNode[] = [];

  for (const edge of deps) {
    const entity = getEntity(edge.to_id);
    if (!entity) continue;

    results.push({
      id: edge.to_id,
      name: entity.name,
      type: entity.type,
      relationship: edge.relationship,
      weight: edge.weight,
      depth,
      critical: edge.weight >= 8,
    });

    results.push(...traverseUpstream(edge.to_id, visited, depth + 1, maxDepth));
  }

  return results;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function getDependencyTree(entityId: string): DependencyTree {
  const entity = getEntity(entityId);
  if (!entity) throw new Error(`Entity not found: ${entityId}`);

  const dependsOn = traverseUpstream(entityId);
  const dependedOnBy = traverseDownstream(entityId);

  return {
    entity_id: entityId,
    entity_name: entity.name,
    depends_on: dependsOn,
    depended_on_by: dependedOnBy,
  };
}

export function analyzeImpact(entityId: string): ImpactAnalysis {
  const entity = getEntity(entityId);
  if (!entity) throw new Error(`Entity not found: ${entityId}`);

  // Direct: who directly depends on this entity
  const directEdges = getInEdges(entityId, 'depends_on');
  const directlyImpacted: ImpactedEntity[] = directEdges.map(e => {
    const dep = getEntity(e.from_id);
    return { id: e.from_id, name: dep?.name || e.from_id, type: dep?.type || 'unknown', impact_path: [entityId, e.from_id], depth: 0, weight: e.weight };
  });

  // Transitive: full downstream traversal
  const visited = new Set<string>([entityId, ...directlyImpacted.map(d => d.id)]);
  const transitivelyImpacted: ImpactedEntity[] = [];
  for (const direct of directlyImpacted) {
    const deeper = traverseDownstream(direct.id, new Set([entityId]), 1);
    transitivelyImpacted.push(...deeper.filter(d => !directlyImpacted.some(dd => dd.id === d.id)));
  }

  const total = directlyImpacted.length + [...new Set(transitivelyImpacted.map(t => t.id))].length;
  const maxWeight = Math.max(0, ...directEdges.map(e => e.weight));
  const riskScore = Math.min(100, total * 10 + maxWeight * 5);
  const severity: ImpactAnalysis['severity'] =
    riskScore >= 75 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MEDIUM' : 'LOW';

  return {
    failed_entity_id: entityId,
    failed_entity_name: entity.name,
    directly_impacted: directlyImpacted,
    transitively_impacted: [...new Set(transitivelyImpacted.map(t => t.id))].map(id =>
      transitivelyImpacted.find(t => t.id === id)!
    ),
    total_impacted: total,
    severity,
    risk_score: riskScore,
    summary: `${entity.name} failure impacts ${total} system(s) — severity: ${severity}`,
  };
}

export function findCriticalPaths(): CriticalPathResult[] {
  const entities = getAllEntities();
  const results: CriticalPathResult[] = [];

  for (const entity of entities) {
    if (entity.type === 'owner' || entity.type === 'team' || entity.type === 'repository') continue;

    const inEdges = getInEdges(entity.id, 'depends_on');
    const outEdges = getOutEdges(entity.id, 'depends_on');

    const inDegree = inEdges.length;
    const avgWeight = inEdges.reduce((s, e) => s + e.weight, 0) / (inEdges.length || 1);
    const criticalityScore = Math.min(100, inDegree * 15 + avgWeight * 5);

    // SPOF: something is SPOF if >1 high-weight dependents and has no parallel alternative
    const highWeightDeps = inEdges.filter(e => e.weight >= 8);
    const isSpof = highWeightDeps.length >= 2;

    const dependents = inEdges.map(e => getEntity(e.from_id)?.name || e.from_id);

    results.push({
      entity_id: entity.id,
      entity_name: entity.name,
      in_degree: inDegree,
      out_degree: outEdges.length,
      is_spof: isSpof,
      criticality_score: criticalityScore,
      dependents,
    });
  }

  return results.sort((a, b) => b.criticality_score - a.criticality_score);
}

export function findHighestRiskDependency(): CriticalPathResult | null {
  const paths = findCriticalPaths();
  return paths[0] || null;
}
