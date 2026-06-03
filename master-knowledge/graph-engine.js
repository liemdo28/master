'use strict';

const fs = require('fs');
const path = require('path');

const GRAPH_PATH = path.join(__dirname, '../knowledge-engine/KNOWLEDGE_GRAPH.json');

function loadGraph() {
  const raw = fs.readFileSync(GRAPH_PATH, 'utf8');
  return JSON.parse(raw);
}

/**
 * Returns the dependency nodes connected to a project.
 * @param {string} projectName - project_name key (e.g. "agent-agent-coding")
 */
function getProjectDeps(projectName) {
  const graph = loadGraph();
  const projectId = `proj:${projectName}`;

  // Find all "depends_on" edges from this project
  const depEdges = graph.edges.filter(
    (e) => e.from === projectId && e.type === 'depends_on'
  );

  const depNodeIds = new Set(depEdges.map((e) => e.to));
  const depNodes = graph.nodes.filter((n) => depNodeIds.has(n.id));

  if (!graph.nodes.find((n) => n.id === projectId)) {
    return {
      projectName,
      found: false,
      dependencies: [],
      source: GRAPH_PATH,
    };
  }

  return {
    projectName,
    found: true,
    dependencies: depNodes,
    total: depNodes.length,
    source: GRAPH_PATH,
  };
}

/**
 * Returns all edges connected to a node (in or out).
 * @param {string} nodeId - full node id (e.g. "proj:agent-agent-coding")
 */
function findConnections(nodeId) {
  const graph = loadGraph();
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) {
    return { nodeId, found: false, inbound: [], outbound: [], source: GRAPH_PATH };
  }

  const outbound = graph.edges.filter((e) => e.from === nodeId);
  const inbound = graph.edges.filter((e) => e.to === nodeId);

  return {
    nodeId,
    found: true,
    node,
    outbound,
    inbound,
    totalConnections: outbound.length + inbound.length,
    source: GRAPH_PATH,
  };
}

/**
 * Builds the full dependency chain for a project (BFS, follows depends_on edges).
 * @param {string} projectName
 * @param {number} [maxDepth=5]
 */
function getDependencyChain(projectName, maxDepth = 5) {
  const graph = loadGraph();
  const projectId = `proj:${projectName}`;

  if (!graph.nodes.find((n) => n.id === projectId)) {
    return {
      projectName,
      found: false,
      chain: [],
      source: GRAPH_PATH,
    };
  }

  // Build adjacency map for depends_on edges
  const adj = {};
  for (const edge of graph.edges) {
    if (edge.type === 'depends_on') {
      if (!adj[edge.from]) adj[edge.from] = [];
      adj[edge.from].push(edge.to);
    }
  }

  // BFS
  const visited = new Set();
  const chain = [];
  const queue = [{ id: projectId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    if (visited.has(id) || depth > maxDepth) continue;
    visited.add(id);

    const node = graph.nodes.find((n) => n.id === id);
    if (node && id !== projectId) {
      chain.push({ depth, node });
    }

    const neighbors = adj[id] || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        queue.push({ id: neighborId, depth: depth + 1 });
      }
    }
  }

  return {
    projectName,
    found: true,
    chain,
    total: chain.length,
    source: GRAPH_PATH,
  };
}

module.exports = {
  loadGraph,
  getProjectDeps,
  findConnections,
  getDependencyChain,
};
