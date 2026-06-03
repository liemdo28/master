#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const GRAPH_PATH = path.join(__dirname, "DEPENDENCY_GRAPH.json");

function loadGraph() {
  if (!fs.existsSync(GRAPH_PATH)) throw new Error("DEPENDENCY_GRAPH.json not found. Run build-graph.js first.");
  return JSON.parse(fs.readFileSync(GRAPH_PATH, "utf8"));
}

function findDependents(projectName) {
  const graph = loadGraph();
  const dependents = [];
  for (const node of graph.nodes) {
    const dep = node.internal_deps.find(d => d.name === projectName);
    if (dep) dependents.push({ project: node.id, version: dep.version });
  }
  return { project: projectName, dependents, count: dependents.length };
}

function findDependencies(projectName) {
  const graph = loadGraph();
  const node = graph.nodes.find(n => n.id === projectName);
  if (!node) return { error: "Project not found: " + projectName };
  return { project: projectName, internal: node.internal_deps, external: node.external_deps, total_prod: node.prod_dep_count, total_dev: node.dev_dep_count, impact_score: node.impact_score };
}

function findInternalDependencies() {
  const graph = loadGraph();
  return graph.nodes.filter(n => n.internal_deps.length > 0).map(n => ({ project: n.id, internal_deps: n.internal_deps, count: n.internal_deps.length })).sort((a,b) => b.count - a.count);
}

function findIsolatedProjects() {
  const graph = loadGraph();
  return graph.nodes.filter(n => n.prod_dep_count === 0).map(n => ({ project: n.id, display_name: n.display_name, language: n.language, total_files: n.total_files }));
}

function findSharedDependencies(minCount) {
  minCount = minCount || 2;
  const graph = loadGraph();
  const usage = {};
  for (const node of graph.nodes) {
    for (const dep of node.external_deps) {
      if (!usage[dep.name]) usage[dep.name] = [];
      usage[dep.name].push(node.id);
    }
  }
  return Object.entries(usage).filter(([,users]) => users.length >= minCount).sort((a,b) => b[1].length - a[1].length).map(([name,users]) => ({ package: name, used_by: users, count: users.length }));
}

function findDuplicatePatterns() {
  const graph = loadGraph();
  const profiles = {};
  for (const node of graph.nodes) {
    const key = node.external_deps.map(d => d.name).sort().join(",");
    if (!profiles[key]) profiles[key] = [];
    profiles[key].push(node.id);
  }
  const duplicates = [];
  for (const [deps, projs] of Object.entries(profiles)) {
    if (projs.length > 1 && deps.length > 0) {
      duplicates.push({ projects: projs, shared_deps: deps.split(",").slice(0,10), total_shared: deps.split(",").length, similarity: "exact-match" });
    }
  }
  const nodes = graph.nodes.filter(n => n.external_deps.length > 3);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i+1; j < nodes.length; j++) {
      const a = new Set(nodes[i].external_deps.map(d => d.name));
      const b = new Set(nodes[j].external_deps.map(d => d.name));
      const inter = [...a].filter(x => b.has(x)).length;
      const union = new Set([...a,...b]).size;
      const jac = inter / union;
      if (jac > 0.7 && !duplicates.some(d => d.projects.includes(nodes[i].id) && d.projects.includes(nodes[j].id))) {
        duplicates.push({ projects: [nodes[i].id, nodes[j].id], shared_deps: [...a].filter(x => b.has(x)).slice(0,10), total_shared: inter, similarity: (jac*100).toFixed(1)+"% overlap" });
      }
    }
  }
  return duplicates;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0], param = args[1];
  const cmds = {};
  cmds.dependents = () => console.log(JSON.stringify(findDependents(param),null,2));
  cmds.dependencies = () => console.log(JSON.stringify(findDependencies(param),null,2));
  cmds.internal = () => console.log(JSON.stringify(findInternalDependencies(),null,2));
  cmds.isolated = () => console.log(JSON.stringify(findIsolatedProjects(),null,2));
  cmds.shared = () => console.log(JSON.stringify(findSharedDependencies(parseInt(param)||2),null,2));
  cmds.duplicates = () => console.log(JSON.stringify(findDuplicatePatterns(),null,2));
test