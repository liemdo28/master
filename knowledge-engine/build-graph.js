#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const MASTER = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(MASTER, 'master-indexer', 'output', 'MASTER_INDEX.json');
const OUT_JSON = path.join(__dirname, 'KNOWLEDGE_GRAPH.json');
const OUT_MD = path.join(__dirname, 'KNOWLEDGE_GRAPH.md');
const OUT_STATS = path.join(__dirname, 'KNOWLEDGE_GRAPH_STATS.md');
const DNA_DIR = path.join(MASTER, 'project-dna-generator', 'output');
const EVENTS_DIR = path.join(MASTER, 'master-journal', 'events');
const BUGS_DIR = path.join(MASTER, 'master-journal', 'bugs');

function readJSON(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
function slug(n) { return (n||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

// Load sources
console.log('[graph] Loading MASTER_INDEX...');
const index = readJSON(INDEX_PATH);
if (!index) { console.error('ERROR: MASTER_INDEX.json not found'); process.exit(1); }

let dnaMap = {};
try { for (const f of fs.readdirSync(DNA_DIR)) { if (f.endsWith('.json')) { const d = readJSON(path.join(DNA_DIR, f)); if (d && d.project) dnaMap[d.project] = d; } } } catch {}
console.log('[graph] DNA records:', Object.keys(dnaMap).length);

let events = [];
try { for (const f of fs.readdirSync(EVENTS_DIR)) { if (f.endsWith('.jsonl')) { const lns = fs.readFileSync(path.join(EVENTS_DIR, f),'utf8').split('\n').filter(Boolean); for (const l of lns) { try { events.push(JSON.parse(l)); } catch {} } } } } catch {}
console.log('[graph] Events:', events.length);

let bugs = [];
try { for (const f of fs.readdirSync(BUGS_DIR)) { if (f.endsWith('.json')) { const b = readJSON(path.join(BUGS_DIR, f)); if (b) bugs.push(b); } else if (f.endsWith('.md')) { const c = fs.readFileSync(path.join(BUGS_DIR, f),'utf8'); const m = c.match(/^#\s+(.+)/m); bugs.push({id:f,title:m?m[1]:f}); } } } catch {}
console.log('[graph] Bugs:', bugs.length);

// Build graph
const nodes = []; const edges = []; const nodeIndex = {};
function addNode(id,type,name,data){if(!nodeIndex[id]){const n={id,type,name,data};nodes.push(n);nodeIndex[id]=n;}return nodeIndex[id];}
function addEdge(from,to,type,weight){edges.push({from,to,type,weight:weight||1});}

// Project + Module nodes
for (const proj of index.projects) {
  const pid = 'proj:' + slug(proj.project_name);
  const prodDeps = (proj.dependencies||[]).filter(d=>!d.is_dev);
  const dna = dnaMap[proj.project_name];
  addNode(pid,'project',proj.project_name,{
    display_name:proj.display_name,path:proj.path,language:proj.language_main,
    language_secondary:proj.language_secondary,framework:proj.framework,
    git_remote:proj.git_remote,git_branch:proj.git_branch,git_status:proj.git_status,
    owner:proj.owner,criticality:proj.criticality,status:proj.status,
    total_files:proj.total_files,total_lines:proj.total_lines,size_bytes:proj.size_bytes,
    dep_count:prodDeps.length,module_count:(proj.modules||[]).length,
    dna_risk:dna?dna.risk_level:null,dna_health:dna?dna.health_score:null
  });
  for (const mod of (proj.modules||[])) {
    const mid='mod:'+slug(proj.project_name)+'/'+slug(mod.name);
    addNode(mid,'module',mod.name,{path:mod.path,language:mod.language,file_count:mod.file_count,project:proj.project_name});
    addEdge(pid,mid,'contains',1);
  }
}

// Dependency edges
const depToProjects = {};
for (const proj of index.projects) {
  const pid = 'proj:' + slug(proj.project_name);
  const prodDeps = (proj.dependencies||[]).filter(d=>!d.is_dev);
  for (const dep of prodDeps) {
    if (!depToProjects[dep.name]) depToProjects[dep.name] = [];
    depToProjects[dep.name].push(pid);
    const did = 'dep:' + slug(dep.name);
    addNode(did,'dependency',dep.name,{version:dep.version,type:dep.type});
    addEdge(pid,did,'depends_on',1);
  }
}

// Shared dependency edges (only top shared deps to avoid explosion)
for (const [dep,projs] of Object.entries(depToProjects)) {
  if (projs.length > 1 && projs.length <= 10) {
    for (let i=0;i<projs.length;i++) {
      for (let j=i+1;j<projs.length;j++) {
        addEdge(projs[i],projs[j],'shares_dependency',1);
      }
    }
  }
}

// Event edges
const projLookup = index.projects.map(p=>({s:slug(p.project_name),path:p.path,id:'proj:'+slug(p.project_name)}));
for (const ev of events) {
  const ep = (ev.project||'').toLowerCase().replace(/\\\\/g,'/');
  const match = projLookup.find(ps => ep.includes(ps.s.replace(/-/g,'/')) || ep.includes(ps.s.replace(/-/g,'\\')) || slug(ev.project||'')===ps.s);
  if (match && ev.taskId) {
    const eid = 'event:' + ev.taskId + '-' + ev.type;
    if (!nodeIndex[eid]) {
      addNode(eid,'event',ev.type,{timestamp:ev.timestamp,taskId:ev.taskId,actor:ev.actor,risk:ev.risk});
      addEdge(match.id,eid,'has_event',1);
    }
  }
}

// Bug edges
for (const bug of bugs) {
  const bid = 'bug:' + (bug.id||Math.random().toString(36).slice(2));
  addNode(bid,'bug',bug.title||bug.id,{severity:bug.severity,status:bug.status,project:bug.project});
  if (bug.project) {
    const match = projLookup.find(ps=>slug(bug.project)===ps.s);
    if (match) addEdge(match.id,bid,'has_bug',2);
  }
}

// Risk edges from DNA
for (const [pn,dna] of Object.entries(dnaMap)) {
  const pid='proj:'+slug(pn);
  if (nodeIndex[pid] && dna.risk_level && dna.risk_level!=='low') {
    addEdge(pid,pid,'risk_flag',dna.risk_level==='high'?3:2);
  }
}

// Output graph JSON
const graph = {
  generated_at: new Date().toISOString(),
  version: '1.0',
  nodes,
  edges,
  stats: {
    total_nodes: nodes.length,
    total_edges: edges.length,
    project_count: nodes.filter(n=>n.type==='project').length,
    module_count: nodes.filter(n=>n.type==='module').length,
    dependency_count: nodes.filter(n=>n.type==='dependency').length,
    event_count: nodes.filter(n=>n.type==='event').length,
    bug_count: nodes.filter(n=>n.type==='bug').length
  }
};

fs.writeFileSync(OUT_JSON, JSON.stringify(graph, null, 2));
console.log('[graph] Written:', OUT_JSON);

// Write human-readable MD
let md = '# Knowledge Graph\n\n';
md += '> Generated: ' + graph.generated_at + '\n\n';
md += '## Summary\n\n';
md += '| Metric | Count |\n|--------|-------|\n';
md += '| Nodes | ' + graph.stats.total_nodes + ' |\n';
md += '| Edges | ' + graph.stats.total_edges + ' |\n';
md += '| Projects | ' + graph.stats.project_count + ' |\n';
md += '| Modules | ' + graph.stats.module_count + ' |\n';
md += '| Dependencies | ' + graph.stats.dependency_count + ' |\n';
md += '| Events | ' + graph.stats.event_count + ' |\n';
md += '| Bugs | ' + graph.stats.bug_count + ' |\n\n';
md += '## Projects\n\n';
for (const proj of index.projects) {
  const prodDeps = (proj.dependencies||[]).filter(d=>!d.is_dev);
  md += '### ' + proj.display_name + '\n';
  md += '- **Language:** ' + proj.language_main + (proj.language_secondary?' / '+proj.language_secondary:'') + '\n';
  md += '- **Framework:** ' + (proj.framework||'none') + '\n';
  md += '- **Files:** ' + proj.total_files + ' | **Lines:** ' + proj.total_lines.toLocaleString() + '\n';
  md += '- **Deps:** ' + prodDeps.length + ' (prod) | **Modules:** ' + (proj.modules||[]).length + '\n';
  md += '- **Status:** ' + proj.status + ' | **Criticality:** ' + proj.criticality + '\n';
  if (proj.git_remote) md += '- **Git:** ' + proj.git_remote + '\n';
  md += '\n';
}
md += '## Top Shared Dependencies\n\n';
const topDeps = Object.entries(depToProjects).sort((a,b)=>b[1].length-a[1].length).slice(0,20);
md += '| Dependency | Used By |\n|------------|---------|\n';
for (const [dep,projs] of topDeps) { md += '| '+dep+' | '+projs.length+' projects |\n'; }
md += '\n';
fs.writeFileSync(OUT_MD, md);
console.log('[graph] Written:', OUT_MD);

// Write stats MD
let stats = '# Knowledge Graph Statistics\n\n';
stats += '> Generated: ' + graph.generated_at + '\n\n';
stats += '## Overview\n\n';
stats += '| Metric | Value |\n|--------|-------|\n';
stats += '| Total Nodes | ' + graph.stats.total_nodes + ' |\n';
stats += '| Total Edges | ' + graph.stats.total_edges + ' |\n';
stats += '| Projects | ' + graph.stats.project_count + ' |\n';
stats += '| Modules | ' + graph.stats.module_count + ' |\n';
stats += '| Dependencies (unique) | ' + graph.stats.dependency_count + ' |\n';
stats += '| Events | ' + graph.stats.event_count + ' |\n';
stats += '| Bugs | ' + graph.stats.bug_count + ' |\n\n';
stats += '## Source Data\n\n';
stats += '- MASTER_INDEX: ' + index.total_projects + ' projects, ' + index.total_files.toLocaleString() + ' files, ' + index.total_lines.toLocaleString() + ' lines\n';
stats += '- DNA records: ' + Object.keys(dnaMap).length + '\n';
stats += '- Journal events: ' + events.length + '\n';
stats += '- Bug records: ' + bugs.length + '\n\n';
stats += '## Edge Types\n\n';
const edgeTypes = {};
for (const e of edges) { edgeTypes[e.type] = (edgeTypes[e.type]||0)+1; }
stats += '| Type | Count |\n|------|-------|\n';
for (const [t,c] of Object.entries(edgeTypes).sort((a,b)=>b[1]-a[1])) { stats += '| '+t+' | '+c+' |\n'; }
stats += '\n## Language Distribution\n\n';
const langs = {};
for (const p of index.projects) { langs[p.language_main]=(langs[p.language_main]||0)+1; }
stats += '| Language | Projects |\n|----------|----------|\n';
for (const [l,c] of Object.entries(langs).sort((a,b)=>b[1]-a[1])) { stats += '| '+l+' | '+c+' |\n'; }
stats += '\n## Largest Projects (by lines)\n\n';
const sorted = [...index.projects].sort((a,b)=>b.total_lines-a.total_lines).slice(0,10);
stats += '| Project | Lines | Files |\n|---------|-------|-------|\n';
for (const p of sorted) { stats += '| '+p.project_name+' | '+p.total_lines.toLocaleString()+' | '+p.total_files.toLocaleString()+' |\n'; }
stats += '\n';
fs.writeFileSync(OUT_STATS, stats);
console.log('[graph] Written:', OUT_STATS);
console.log('[graph] DONE:', JSON.stringify(graph.stats));