/**
 * DEV5 — Phase M2: Intent Graph
 * 
 * Builds a directed graph of intents with dependency resolution.
 * Nodes: intent, entity, domain, risk, approval_required, status
 * Edges: sequential, parallel, requires_approval, depends_on
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type NodeStatus = 'pending' | 'ready' | 'running' | 'done' | 'failed' | 'blocked' | 'skipped';
export type EdgeType = 'sequential' | 'parallel' | 'requires_approval' | 'depends_on';
export type RiskLevel = 'safe' | 'moderate' | 'dangerous';

export interface IntentNode {
  id: string;
  workflow_id: string;
  intent_type: string;
  entity?: string;
  domain: string;
  risk: RiskLevel;
  approval_required: boolean;
  status: NodeStatus;
  clause_index: number;
  result?: string;
}

export interface IntentEdge {
  from: string;
  to: string;
  type: EdgeType;
}

export interface IntentGraph {
  id: string;
  parent_workflow_id: string;
  nodes: IntentNode[];
  edges: IntentEdge[];
  created_at: string;
  updated_at: string;
}

// ── Risk Classification ───────────────────────────────────────────────────

const DANGEROUS_DOMAINS = ['deployment', 'bug_fix', 'finance_qb'];
const MODERATE_DOMAINS = ['seo_content', 'website_marketing', 'social_media', 'email_comms'];

function classifyRisk(domain: string, approvalRequired: boolean): RiskLevel {
  if (DANGEROUS_DOMAINS.includes(domain)) return 'dangerous';
  if (MODERATE_DOMAINS.includes(domain)) return 'moderate';
  return 'safe';
}

// ── Dependency Rules ──────────────────────────────────────────────────────

/**
 * Known dependency relationships between task types.
 * If A depends_on B, then A cannot start until B is done.
 */
const DEPENDENCY_RULES: Array<{ domain_a: string; domain_b: string; relation: 'depends_on' | 'parallel' }> = [
  // Email/website publishing depends on content being ready
  { domain_a: 'email_comms', domain_b: 'seo_content', relation: 'depends_on' },
  { domain_a: 'email_comms', domain_b: 'dashboard_monitoring', relation: 'depends_on' },
  { domain_a: 'website_marketing', domain_b: 'seo_content', relation: 'depends_on' },
  // Dashboard and QB can run in parallel
  { domain_a: 'dashboard_monitoring', domain_b: 'finance_qb', relation: 'parallel' },
  // Campaign depends on content
  { domain_a: 'campaign', domain_b: 'seo_content', relation: 'depends_on' },
  { domain_a: 'campaign', domain_b: 'social_media', relation: 'depends_on' },
];

function detectEdge(from: IntentNode, to: IntentNode): EdgeType | null {
  // Never create edge to self
  if (from.id === to.id) return null;

  for (const rule of DEPENDENCY_RULES) {
    if (from.domain === rule.domain_a && to.domain === rule.domain_b) {
      return rule.relation === 'depends_on' ? 'depends_on' : 'parallel';
    }
  }

  // Default: sequential by clause order
  if (from.clause_index < to.clause_index) return 'sequential';
  if (from.clause_index > to.clause_index) return 'sequential';

  return null;
}

// ── Graph Builder ─────────────────────────────────────────────────────────

let _graphStore: Map<string, IntentGraph> = new Map();

export function buildIntentGraph(
  parentWorkflowId: string,
  children: Array<{
    workflow_id: string;
    clause_index: number;
    intent: { domain: string; workflow_types: string[]; target_entity?: string; approval_required: boolean; action_verbs: string[] };
    entities: { entity?: string };
    workflow_type: string;
  }>
): IntentGraph {
  const graphId = `GRAPH-${parentWorkflowId}`;
  const now = new Date().toISOString();

  // Build nodes
  const nodes: IntentNode[] = children.map((child, idx) => ({
    id: `NODE-${parentWorkflowId}-${idx}`,
    workflow_id: child.workflow_id,
    intent_type: child.workflow_type,
    entity: child.entities.entity,
    domain: child.intent.domain,
    risk: classifyRisk(child.intent.domain, child.intent.approval_required),
    approval_required: child.intent.approval_required,
    status: 'pending' as NodeStatus,
    clause_index: child.clause_index,
  }));

  // Build edges
  const edges: IntentEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const edgeType = detectEdge(nodes[i], nodes[j]);
      if (edgeType && !edges.find(e => e.from === nodes[i].id && e.to === nodes[j].id)) {
        edges.push({ from: nodes[i].id, to: nodes[j].id, type: edgeType });
      }
    }
  }

  const graph: IntentGraph = {
    id: graphId,
    parent_workflow_id: parentWorkflowId,
    nodes,
    edges,
    created_at: now,
    updated_at: now,
  };

  _graphStore.set(graphId, graph);
  return graph;
}

// ── Graph Queries ─────────────────────────────────────────────────────────

export function getGraph(graphId: string): IntentGraph | null {
  return _graphStore.get(graphId) || null;
}

export function getGraphByParent(parentWorkflowId: string): IntentGraph | null {
  for (const g of _graphStore.values()) {
    if (g.parent_workflow_id === parentWorkflowId) return g;
  }
  return null;
}

export function updateNodeStatus(graphId: string, nodeId: string, status: NodeStatus, result?: string): IntentGraph | null {
  const graph = _graphStore.get(graphId);
  if (!graph) return null;
  const node = graph.nodes.find(n => n.id === nodeId);
  if (!node) return null;
  node.status = status;
  if (result) node.result = result;
  graph.updated_at = new Date().toISOString();
  _graphStore.set(graphId, graph);
  return graph;
}

export function getReadyNodes(graphId: string): IntentNode[] {
  const graph = _graphStore.get(graphId);
  if (!graph) return [];

  return graph.nodes.filter(node => {
    if (node.status !== 'pending') return false;

    // Check if all dependencies are satisfied
    const incomingEdges = graph.edges.filter(e => e.to === node.id && e.type === 'depends_on');
    for (const edge of incomingEdges) {
      const sourceNode = graph.nodes.find(n => n.id === edge.from);
      if (sourceNode && sourceNode.status !== 'done' && sourceNode.status !== 'skipped') {
        return false; // dependency not satisfied
      }
    }
    return true;
  });
}

export function getParallelNodes(graphId: string): IntentNode[][] {
  const graph = _graphStore.get(graphId);
  if (!graph) return [];

  // Group nodes that can run in parallel (connected by 'parallel' edges)
  const parallelGroups: IntentNode[][] = [];
  const visited = new Set<string>();

  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue;

    const group: IntentNode[] = [node];
    visited.add(node.id);

    for (const edge of graph.edges) {
      if (edge.type === 'parallel') {
        if (edge.from === node.id) {
          const target = graph.nodes.find(n => n.id === edge.to);
          if (target && !visited.has(target.id)) {
            group.push(target);
            visited.add(target.id);
          }
        }
        if (edge.to === node.id) {
          const source = graph.nodes.find(n => n.id === edge.from);
          if (source && !visited.has(source.id)) {
            group.push(source);
            visited.add(source.id);
          }
        }
      }
    }

    parallelGroups.push(group);
  }

  return parallelGroups;
}

export function getGraphStats(graphId: string): {
  total_nodes: number;
  done: number;
  running: number;
  pending: number;
  failed: number;
  blocked: number;
} | null {
  const graph = _graphStore.get(graphId);
  if (!graph) return null;
  return {
    total_nodes: graph.nodes.length,
    done: graph.nodes.filter(n => n.status === 'done').length,
    running: graph.nodes.filter(n => n.status === 'running').length,
    pending: graph.nodes.filter(n => n.status === 'pending').length,
    failed: graph.nodes.filter(n => n.status === 'failed').length,
    blocked: graph.nodes.filter(n => n.status === 'blocked').length,
  };
}

export function getAllGraphs(): IntentGraph[] {
  return Array.from(_graphStore.values());
}

export function resetGraphs(): void {
  _graphStore.clear();
}
