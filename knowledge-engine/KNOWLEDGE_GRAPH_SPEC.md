# KNOWLEDGE GRAPH SPEC

**Phase 4 of Master Intelligence Layer**

## Purpose

Store and query relationships between all entities in the company: projects, modules, files, tasks, decisions, bugs, fixes, and artifacts. The Knowledge Graph enables the agent to answer complex questions without reading source code.

## Core Relationship Chain

```
Company
 └── Department
      └── Project
           └── Module
                └── File
                     └── Task
                          └── Decision
                               └── Bug
                                    └── Fix
                                         └── Artifact
```

## Node Types

| Node Type | Description | Source |
|-----------|-------------|--------|
| `company` | Root node | Static |
| `department` | Business unit | Manual |
| `project` | Code project | Source Indexer |
| `module` | Sub-component | Source Indexer |
| `file` | Source file | Source Indexer |
| `task` | Work item | Master Journal |
| `decision` | Architectural choice | Master Journal |
| `bug` | Known defect | Master Journal |
| `fix` | Applied correction | Master Journal |
| `artifact` | Output/report | Artifact Registry |
| `person` | Team member | Manual |
| `release` | Version release | Master Journal |
| `risk` | Known risk | Project DNA |

## Edge Types

| Edge | From → To | Description |
|------|-----------|-------------|
| `owns` | person → project | Ownership |
| `contains` | project → module | Composition |
| `has_file` | module → file | Composition |
| `depends_on` | project → project | Dependency |
| `imports` | file → file | Code import |
| `caused_by` | bug → file | Root cause |
| `fixed_by` | bug → fix | Resolution |
| `produced` | task → artifact | Output |
| `decided` | decision → project | Scope |
| `blocked_by` | release → bug | Blocker |
| `tested_by` | project → artifact | QA coverage |
| `related_to` | any → any | General relation |
| `triggered` | event → event | Causation |

## Database Schema

```sql
-- Nodes
CREATE TABLE nodes (
    id TEXT PRIMARY KEY,
    node_type TEXT NOT NULL,
    name TEXT NOT NULL,
    properties TEXT,  -- JSON
    project_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT
);

CREATE INDEX idx_nodes_type ON nodes(node_type);
CREATE INDEX idx_nodes_project ON nodes(project_id);
CREATE INDEX idx_nodes_name ON nodes(name);

-- Edges
CREATE TABLE edges (
    id TEXT PRIMARY KEY,
    from_node TEXT NOT NULL,
    to_node TEXT NOT NULL,
    edge_type TEXT NOT NULL,
    properties TEXT,  -- JSON (weight, confidence, etc.)
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (from_node) REFERENCES nodes(id),
    FOREIGN KEY (to_node) REFERENCES nodes(id)
);

CREATE INDEX idx_edges_from ON edges(from_node);
CREATE INDEX idx_edges_to ON edges(to_node);
CREATE INDEX idx_edges_type ON edges(edge_type);

-- Queries cache
CREATE TABLE query_cache (
    query_hash TEXT PRIMARY KEY,
    query_text TEXT,
    result TEXT,  -- JSON
    cached_at TEXT,
    expires_at TEXT
);
```

## Query Engine

### Natural Language Queries

The Knowledge Graph must answer these without reading source:

| Question | Query Strategy |
|----------|---------------|
| "What projects depend on Agent Core?" | Find all `depends_on` edges pointing to Agent Core |
| "What caused Payroll bug #421?" | Traverse `caused_by` edge from bug node |
| "Which files belong to Dashboard release governance?" | Find files in modules tagged with release-governance |
| "Which projects have repeated failures?" | Count `bug` nodes per project, filter > threshold |
| "If Agent Core fails, what breaks?" | Recursive traversal of `depends_on` edges |
| "Who owns the most critical projects?" | Join `owns` edges with criticality from DNA |
| "What changed in the last 24 hours?" | Time-filtered event nodes |

### Query API

```typescript
interface KnowledgeQuery {
  // Direct queries
  findDependents(projectName: string): Promise<Project[]>;
  findDependencies(projectName: string): Promise<Project[]>;
  findImpact(projectName: string): Promise<ImpactAnalysis>;
  findRootCause(bugId: string): Promise<CausalChain>;
  findRelated(nodeId: string, depth: number): Promise<Node[]>;
  
  // Aggregate queries
  getProjectsByRisk(): Promise<RankedProject[]>;
  getRepeatedFailures(): Promise<FailurePattern[]>;
  getCriticalPath(): Promise<Node[]>;
  getOrphanProjects(): Promise<Project[]>;
  
  // Natural language
  ask(question: string): Promise<Answer>;
}
```

### Impact Analysis

```typescript
interface ImpactAnalysis {
  project: string;
  direct_dependents: string[];
  transitive_dependents: string[];
  total_impact: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affected_departments: string[];
  recommendation: string;
}
```

## Graph Building

### Sources
1. **Source Indexer** → project nodes, module nodes, file nodes, dependency edges
2. **Master Journal** → task nodes, decision nodes, bug nodes, fix nodes, event edges
3. **Project DNA** → risk nodes, ownership edges, criticality properties
4. **Artifact Registry** → artifact nodes, produced edges
5. **QA Platform** → test coverage properties, tested_by edges

### Build Process
```
1. Scan all projects (Source Indexer)
2. Parse all DNA files (Project DNA Engine)
3. Import all journal events (Master Journal)
4. Register all artifacts (Artifact Registry)
5. Build edges from cross-references
6. Calculate derived properties (impact scores, risk scores)
7. Cache common queries
```

## Architecture

```
knowledge-engine/
├── graph.js            # Core graph operations
├── query-engine.js     # Query parsing and execution
├── builder.js          # Graph construction from sources
├── impact-analyzer.js  # Impact and risk analysis
├── nl-parser.js        # Natural language query parser
├── data/
│   └── knowledge.db    # SQLite graph database
├── cache/
│   └── query-cache.db  # Cached query results
└── schemas/
    ├── nodes.schema.json
    └── edges.schema.json
```

## Update Strategy

| Trigger | Action |
|---------|--------|
| New project indexed | Add project node + edges |
| Journal event written | Add event node + edges |
| DNA updated | Update node properties |
| Artifact registered | Add artifact node + edges |
| Dependency changed | Update dependency edges |

## Success Criteria

- [ ] All projects represented as nodes with correct edges
- [ ] Dependency queries return in < 200ms
- [ ] Impact analysis covers transitive dependencies
- [ ] Natural language queries resolve to graph operations
- [ ] Graph stays in sync with Source Indexer (< 5 min lag)
- [ ] CEO can ask relationship questions and get accurate answers
