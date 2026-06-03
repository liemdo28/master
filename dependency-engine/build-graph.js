#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const INDEX_PATH = path.join(__dirname, "..", "master-indexer", "output", "MASTER_INDEX.json");
const GRAPH_JSON = path.join(__dirname, "DEPENDENCY_GRAPH.json");
const GRAPH_MD = path.join(__dirname, "DEPENDENCY_GRAPH.md");
const MATRIX_MD = path.join(__dirname, "PROJECT_DEPENDENCY_MATRIX.md");

const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
const projects = index.projects;
const projectNames = new Set(projects.map(p => p.project_name));
const dirNames = {};
projects.forEach(p => { dirNames[path.basename(p.path)] = p.project_name; });
const allInternalNames = new Set([...projectNames, ...Object.keys(dirNames)]);
const dependeeCount = {};

const graph = { generated_at: new Date().toISOString(), total_projects: projects.length, nodes: [], edges: [], stats: {} };

for (const p of projects) {
  const prodDeps = p.dependencies.filter(d => !d.is_dev);
  const internal = prodDeps.filter(d => allInternalNames.has(d.name));
  const external = prodDeps.filter(d => !allInternalNames.has(d.name));
  graph.nodes.push({
    id: p.project_name,
    display_name: p.display_name,
    path: p.path,
    language: p.language_main,
    framework: p.framework,
    criticality: p.criticality,
    status: p.status,
    total_files: p.total_files,
    total_lines: p.total_lines,
    prod_dep_count: prodDeps.length,
    dev_dep_count: p.dependencies.filter(d => d.is_dev).length,
    internal_deps: internal.map(d => ({ name: d.name, version: d.version })),
    external_deps: external.map(d => ({ name: d.name, version: d.version })),
    impact_score: internal.length
  });
  for (const dep of internal) {
    graph.edges.push({ from: p.project_name, to: dep.name, type: "internal", version: dep.version });
    dependeeCount[dep.name] = (dependeeCount[dep.name] || 0) + 1;
  }
}

for (const n of graph.nodes) n.dependents_count = dependeeCount[n.id] || 0;
let maxExt=0,maxInt=0;
for (const n of graph.nodes) {
  if (n.internal_deps.length > maxInt) maxInt = n.internal_deps.length;
  if (n.external_deps.length > maxExt) maxExt = n.external_deps.length;
}
const mostDeps = graph.nodes.reduce((a,b) => a.prod_dep_count > b.prod_dep_count ? a : b);
const mostDepOn = graph.nodes.reduce((a,b) => a.dependents_count > b.dependents_count ? a : b);
graph.stats = {
  total_internal_deps: graph.edges.length,
  total_external_deps: graph.nodes.reduce((s,n) => s + n.external_deps.length, 0),
  max_internal_deps: maxInt,
  max_external_deps: maxExt,
  most_depended_on: mostDepOn.id + " (" + mostDepOn.dependents_count + " dependents)",
  most_dependencies: mostDeps.id + " (" + mostDeps.prod_dep_count + " deps)"
};

fs.writeFileSync(GRAPH_JSON, JSON.stringify(graph, null, 2));
console.log("Wrote: " + GRAPH_JSON);

// Build Markdown
const sorted = [...graph.nodes].sort((a,b) => b.impact_score - a.impact_score);
const usage = {};
for (const n of graph.nodes) for (const d of n.external_deps) { if (!usage[d.name]) usage[d.name]=[]; usage[d.name].push(n.id); }
const shared = Object.entries(usage).filter(([,u]) => u.length > 1).sort((a,b) => b[1].length - a[1].length).slice(0,25);

let md = "# Dependency Graph Report\n\nGenerated: " + graph.generated_at + "\n\n";
md += "## Summary\n\n";
md += "| Metric | Value |\n|--------|-------|\n";
md += "| Projects | " + graph.total_projects + " |\n";
md += "| Internal dep edges | " + graph.stats.total_internal_deps + " |\n";
md += "| External dep entries | " + graph.stats.total_external_deps + " |\n";
md += "| Most depended-on | " + graph.stats.most_depended_on + " |\n";
md += "| Most dependencies | " + graph.stats.most_dependencies + " |\n\n";
md += "## Internal Dependency Edges\n\n";
if (graph.edges.length === 0) { md += "*No internal dependencies detected.*\n\n"; }
else {
  md += "| Consumer | Provider | Version |\n|----------|----------|---------|\n";
  for (const e of graph.edges) md += "| " + e.from + " | " + e.to + " | " + e.version + " |\n";
  md += "\n";
}
md += "## Projects (sorted by impact score)\n\n";
for (const n of sorted) {
  md += "### " + n.id + "\n\n";
  md += "- Path: " + n.path + "\n";
  md += "- Language: " + n.language + "\n";
  md += "- Framework: " + (n.framework || "none") + "\n";
  md += "- Criticality: " + n.criticality + "\n";
  md += "- Impact: " + n.impact_score + " Dependents: " + n.dependents_count + "\n";
  md += "- Prod deps: " + n.prod_dep_count + " Dev deps: " + n.dev_dep_count + "\n\n";
  if (n.internal_deps.length) md += "Internal deps: " + n.internal_deps.map(d=>d.name).join(", ") + "\n\n";
  if (n.external_deps.length) {
    let s = n.external_deps.slice(0,8).map(d=>d.name).join(", ");
    if (n.external_deps.length > 8) s += " (+" + (n.external_deps.length-8) + " more)";
    md += "Top external: " + s + "\n\n";
  }
}
md += "## Shared External Dependencies\n\n";
md += "| Package | Count | Projects |\n|---------|-------|----------|\n";
for (const [pkg,users] of shared) md += "| " + pkg + " | " + users.length + " | " + users.join(", ") + " |\n";
md += "\n";
fs.writeFileSync(GRAPH_MD, md);
console.log("Wrote: " + GRAPH_MD);

// Build Matrix
const intPkgs = [...new Set(graph.edges.map(e => e.to))].sort();
let mx = "# Project Dependency Matrix\n\nGenerated: " + graph.generated_at + "\n\n";
mx += " = consumer, Columns = internal dependency.\n Score = number of internal dependencies.\n\n";
if (intPkgs.length === 0) { mx += "*No internal dependencies found between projects.*\n"; }
else {
  mx += "| Project | Impact | " + intPkgs.join(" | ") + " |\n";
  mx += "|---------|--------|" + intPkgs.map(() => "---").join("|") + "|\n";
  const dm = {};
  for (const e of graph.edges) { if (!dm[e.from]) dm[e.from] = new Set(); dm[e.from].add(e.to); }
  for (const n of sorted) {
    const deps = dm[n.id] || new Set();
    mx += "| " + n.id + " | " + n.impact_score + " |";
    for (const pk of intPkgs) mx += " " + (deps.has(pk) ? "X" : " ") + " |";
    mx += "\n";
  }
  mx += "| Dependents | |";
  for (const pk of intPkgs) mx += " " + (dependeeCount[pk] || 0) + " |";
  mx += "\n";
}
fs.writeFileSync(MATRIX_MD, mx);
console.log("Wrote: " + MATRIX_MD);

console.log("\n=== Summary ===");
console.log("Nodes: " + graph.nodes.length);
console.log("Internal edges: " + graph.edges.length);
console.log("External dep entries: " + graph.stats.total_external_deps);
console.log("Most depended-on: " + graph.stats.most_depended_on);
console.log("Most dependencies: " + graph.stats.most_dependencies);
