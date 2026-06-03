#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const GRAPH_PATH = path.join(__dirname, 'KNOWLEDGE_GRAPH.json');

function loadGraph() {
  try { return JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8')); }
  catch { throw new Error('KNOWLEDGE_GRAPH.json not found. Run build-graph.js first.'); }
}

function slug(n) { return (n||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

/**
 * Find a project node by name (partial match supported)
 */
function findProject(name) {
  const graph = loadGraph();
  const s = slug(name);
  return graph.nodes.find(n => n.type === 'project' && (slug(n.name) === s || slug(n.name).includes(s) || n.name.toLowerCase().includes(name.toLowerCase())));
}

/**
 * Find all projects that depend on a given dependency (recursive)
 */
function findDependents(name) {
  const graph = loadGraph();
  const s = slug(name);
  // Find the dep node
  const depNode = graph.nodes.find(n => n.type === 'dependency' && (slug(n.name) === s || n.name === name));
  if (!depNode) return { dependency: name, dependents: [] };
  // Find all projects that have depends_on edge to this dep
  const directEdges = graph.edges.filter(e => e.to === depNode.id && e.type === 'depends_on');
  const dependents = directEdges.map(e => {
    const projNode = graph.nodes.find(n => n.id === e.from);
    return projNode ? { id: projNode.id, name: projNode.name, data: projNode.data } : null;
  }).filter(Boolean);
  return { dependency: name, dep_id: depNode.id, dependents };
}

/**
 * Find projects sharing dependencies with a given project
 */
function findRelatedProjects(name) {
  const graph = loadGraph();
  const s = slug(name);
  const projNode = graph.nodes.find(n => n.type === 'project' && (slug(n.name) === s || slug(n.name).includes(s)));
  if (!projNode) return { project: name, related: [] };
  // Get deps of this project
  const myDeps = graph.edges.filter(e => e.from === projNode.id && e.type === 'depends_on').map(e => e.to);
  // Find other projects sharing these deps
  const relatedMap = {};
  for (const depId of myDeps) {
    const others = graph.edges.filter(e => e.to === depId && e.type === 'depends_on' && e.from !== projNode.id);
    for (const o of others) {
      if (!relatedMap[o.from]) relatedMap[o.from] = { id: o.from, shared: 0 };
      relatedMap[o.from].shared++;
    }
  }
  const related = Object.values(relatedMap).sort((a,b) => b.shared - a.shared).map(r => {
    const node = graph.nodes.find(n => n.id === r.id);
    return { id: r.id, name: node ? node.name : r.id, shared_deps: r.shared };
  });
  return { project: projNode.name, related };
}

/**
 * Get project statistics
 */
function getProjectStats(name) {
  const graph = loadGraph();
  const s = slug(name);
  const projNode = graph.nodes.find(n => n.type === 'project' && (slug(n.name) === s || slug(n.name).includes(s)));
  if (!projNode) return null;
  const modules = graph.edges.filter(e => e.from === projNode.id && e.type === 'contains').length;
  const deps = graph.edges.filter(e => e.from === projNode.id && e.type === 'depends_on').length;
  const eventEdges = graph.edges.filter(e => e.from === projNode.id && e.type === 'has_event').length;
  const bugEdges = graph.edges.filter(e => e.from === projNode.id && e.type === 'has_bug').length;
  return {
    name: projNode.name,
    total_files: projNode.data.total_files,
    total_lines: projNode.data.total_lines,
    dependencies: deps,
    modules,
    events: eventEdges,
    bugs: bugEdges,
    language: projNode.data.language,
    framework: projNode.data.framework,
    criticality: projNode.data.criticality,
    status: projNode.data.status,
    dna_risk: projNode.data.dna_risk,
    dna_health: projNode.data.dna_health
  };
}

/**
 * Text search across all graph nodes
 */
function searchNodes(query) {
  const graph = loadGraph();
  const q = query.toLowerCase();
  return graph.nodes.filter(n => {
    if (n.name && n.name.toLowerCase().includes(q)) return true;
    if (n.id && n.id.toLowerCase().includes(q)) return true;
    if (n.data) {
      const vals = Object.values(n.data).map(v => String(v||'').toLowerCase());
      if (vals.some(v => v.includes(q))) return true;
    }
    return false;
  });
}

/**
 * Get overall graph statistics
 */
function getGraphStats() {
  const graph = loadGraph();
  return graph.stats;
}

// Exports
module.exports = { findProject, findDependents, findRelatedProjects, getProjectStats, searchNodes, getGraphStats };

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const param = args.slice(1).join(' ');
  if (!cmd) {
    console.log('Usage: node query.js <command> [param]');
    console.log('Commands: find, dependents, related, stats, search, graph-stats');
    process.exit(0);
  }
  let result;
  switch(cmd) {
    case 'find': result = findProject(param); break;
    case 'dependents': result = findDependents(param); break;
    case 'related': result = findRelatedProjects(param); break;
    case 'stats': result = getProjectStats(param); break;
    case 'search': result = searchNodes(param); break;
    case 'graph-stats': result = getGraphStats(); break;
    default: console.error('Unknown command:', cmd); process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}