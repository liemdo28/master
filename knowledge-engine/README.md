# Knowledge Engine

Knowledge Graph Builder and Query Engine for the Master Intelligence Layer.

## Purpose

Builds and queries a knowledge graph from all Master ecosystem data sources:
- **MASTER_INDEX.json** — 30 projects, files, dependencies, modules
- **PROJECT_DNA** — risk levels, health scores (when available)
- **master-journal/events** — task lifecycle events
- **master-journal/bugs** — bug records

## Quick Start

```bash
# Build the knowledge graph
node build-graph.js

# Query the graph
node query.js find bakudan
node query.js dependents express
node query.js related agent-coding
node query.js stats rawsushi-rawwebsite
node query.js search typescript
node query.js graph-stats
```

## Output Files

| File | Description |
|------|-------------|
| KNOWLEDGE_GRAPH.json | Full graph (nodes + edges) |
| KNOWLEDGE_GRAPH.md | Human-readable project overview |
| KNOWLEDGE_GRAPH_STATS.md | Statistics and metrics |

## Graph Schema

```json
{
  "generated_at": "ISO date",
  "version": "1.0",
  "nodes": [{ "id": "proj:name", "type": "project", "name": "...", "data": {} }],
  "edges": [{ "from": "proj:a", "to": "dep:b", "type": "depends_on", "weight": 1 }],
  "stats": { "total_nodes": N, "total_edges": N }
}
```

## Node Types

| Type | ID Prefix | Description |
|------|-----------|-------------|
| project | proj: | A project from MASTER_INDEX |
| module | mod: | A subdirectory/module within a project |
| dependency | dep: | An npm production dependency |
| event | event: | A journal event (task lifecycle) |
| bug | bug: | A bug record |

## Edge Types

| Type | Description |
|------|-------------|
| contains | Project contains a module |
| depends_on | Project depends on a package |
| shares_dependency | Two projects share a dependency |
| has_event | Project has a journal event |
| has_bug | Project has a bug record |
| risk_flag | Project has elevated risk (from DNA) |

## Query API (require)

```javascript
const { findProject, findDependents, findRelatedProjects, getProjectStats, searchNodes, getGraphStats } = require('./query');

// Find a project
findProject('bakudan');

// Find all projects using a dependency
findDependents('express');

// Find projects related by shared deps
findRelatedProjects('agent-coding');

// Get project stats
getProjectStats('rawsushi-rawwebsite');

// Search across all nodes
searchNodes('typescript');

// Overall graph stats
getGraphStats();
```

## Data Sources

- `master-indexer/output/MASTER_INDEX.json` — primary source
- `project-dna-generator/output/` — risk/health data (optional)
- `master-journal/events/` — JSONL event logs
- `master-journal/bugs/` — bug records (JSON/MD)