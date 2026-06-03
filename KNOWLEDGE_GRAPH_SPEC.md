# Knowledge Graph — Specification

> **Status:** P0 — Phase 4  
> **Version:** 1.0  
> **Last Updated:** 2026-06-01  
> **Owner:** Agent OS  

---

## 1. Purpose

The Knowledge Graph transforms `E:\Project\Master` from a filesystem into an **operational knowledge graph** — a queryable web of relationships between projects, modules, files, tasks, decisions, bugs, fixes, and artifacts. Agent OS queries the graph to answer questions without reading source code.

---

## 2. Graph Model

### 2.1 Node Types

| Node Type | Description | Examples |
|-----------|-------------|---------|
| `company` | Top-level company node | Master |
| `department` | Organizational unit | Engineering, Operations, Finance |
| `project` | Software project | Dashboard, Payroll, Agent Core |
| `module` | Project sub-component | API module, Auth module |
| `file` | Source file | src/index.ts |
| `task` | Work item | BUILD-123, QA-456 |
| `decision` | Architectural decision | DEC-789 |
| `bug` | Bug record | BUG-421 |
| `fix` | Fix record | FIX-421 |
| `artifact` | Build/QA artifact | build.log, report.html |
| `snapshot` | System snapshot | snap_20260601 |
| `worker` | Agent worker | Worker-1, Worker-2 |

### 2.2 Edge Types (Relationships)

| From | Relationship | To | Description |
|------|-------------|-----|-------------|
| project | owns | module | Project contains module |
| project | depends_on | project | Internal dependency |
| project | uses | framework | Technology dependency |
| project | owned_by | owner | Owner assignment |
| module | contains | file | Module contains files |
| task | belongs_to | project | Task tied to project |
| task | caused | bug | Task introduced bug |
| bug | fixed_by | fix | Fix resolves bug |
| bug | blocked | task | Bug blocks task |
| decision | affects | project | Decision impacts project |
| artifact | produced_by | task | Artifact from task |
| snapshot | captures | project | Snapshot of project |
| worker | runs | task | Worker executes task |

---

## 3. Graph Database

### 3.1 Storage

File: `knowledge-engine/graph.db` (JSON-based graph, upgradeable to Neo4j)

### 3.2 Schema

```json
{
  "nodes": {
    "project:{id}": {
      "type": "project",
      "name": "Dashboard",
      "department": "engineering",
      "owner": "Frontend Lead",
      "criticality": "P1",
      "status": "active",
      "qa_score": 92,
      "health_score": 91,
      "project_dna_path": "Dashboard/PROJECT_DNA.md",
      "created_at": "2025-01-01",
      "updated_at": "2026-06-01"
    }
  },
  "edges": [
    {
      "id": "edge_001",
      "from": "project:dashboard",
      "to": "project:agent-os",
      "type": "depends_on",
      "weight": 1.0,
      "created_at": "2025-01-15"
    }
  ]
}
```

### 3.3 Index Tables (for fast queries)

```sql
-- Node lookup by type and name
CREATE TABLE node_index (
  node_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  project_id TEXT,
  created_at TEXT
);

-- Edge lookup by type
CREATE TABLE edge_index (
  edge_id TEXT PRIMARY KEY,
  from_node TEXT NOT NULL,
  to_node TEXT NOT NULL,
  type TEXT NOT NULL,
  weight REAL DEFAULT 1.0
);

-- Full-text search index
CREATE VIRTUAL TABLE search_index USING fts5(node_id, name, description, content);
```

---

## 4. Core Queries

### 4.1 Dependency Analysis

```
Query: What projects depend on Agent Core?
```

```json
{
  "query": "projects_depending_on:agent-core",
  "answer": {
    "project": "Agent Core",
    "dependents": [
      { "name": "Dashboard", "type": "hard", "impact": "critical" },
      { "name": "Payroll", "type": "hard", "impact": "critical" },
      { "name": "Review Auto", "type": "hard", "impact": "critical" },
      { "name": "QA Platform", "type": "hard", "impact": "high" },
      { "name": "Agent Worker", "type": "hard", "impact": "high" }
    ],
    "total_impact": 5,
    "severity": "critical",
    "recommendation": "Agent Core is a single point of failure"
  }
}
```

### 4.2 Root Cause Analysis

```
Query: What caused Payroll bug #421?
```

```json
{
  "query": "bug_cause:421",
  "answer": {
    "bug_id": "bug_421",
    "title": "Timezone offset causes wrong pay calculation",
    "root_cause": "Session timestamps stored without timezone normalization",
    "contributing_factors": [
      "No timezone validation in input pipeline",
      "Missing regression tests for timezone handling"
    ],
    "related_decisions": [
      { "id": "dec_101", "title": "Use local time for sessions" }
    ],
    "first_occurrence": "2026-05-10",
    "fix_status": "pending"
  }
}
```

### 4.3 File → Project Resolution

```
Query: Which files belong to Dashboard release governance?
```

```json
{
  "query": "files_under_governance:dashboard",
  "answer": {
    "project": "Dashboard",
    "files": [
      "src/components/**/*.tsx",
      "src/hooks/**/*.ts",
      "src/pages/**/*.tsx",
      "api/**/*.ts"
    ],
    "total_files": 156,
    "governance_rules": [
      "Requires 2 reviewer approvals",
      "Must pass smoke tests",
      "Security scan required"
    ],
    "owners": ["Frontend Lead", "Backend Lead"]
  }
}
```

### 4.4 Failure Pattern Detection

```
Query: Which projects have repeated failures?
```

```json
{
  "query": "repeated_failures",
  "answer": {
    "projects": [
      {
        "name": "Payroll",
        "failure_count": 5,
        "failure_types": ["timezone", "calculation", "rounding"],
        "pattern": "Date/time handling appears consistently problematic",
        "recommendation": "Schedule comprehensive datetime architecture review"
      },
      {
        "name": "Dashboard",
        "failure_count": 3,
        "failure_types": ["auth", "timeout"],
        "pattern": "Session management issues",
        "recommendation": "Review auth module implementation"
      }
    ]
  }
}
```

---

## 5. Graph Builder

### 5.1 Build Pipeline

```
1. SOURCE INDEXER → projects, dependencies, modules
         │
         ▼
2. PROJECT DNA ENGINE → project metadata, risks, bugs
         │
         ▼
3. MASTER JOURNAL → events, decisions, incidents
         │
         ▼
4. GRAPH BUILDER → nodes + edges
         │
         ▼
5. SEARCH INDEX → full-text search
```

### 5.2 Build Triggers

| Trigger | Action |
|---------|--------|
| New project indexed | Add project node, link to department |
| Dependency added | Add depends_on edge |
| Bug recorded | Add bug node, link to project |
| Fix applied | Add fix node, link to bug |
| Decision made | Add decision node, link to projects |
| Incident recorded | Add incident node, link affected projects |

---

## 6. Query Engine

### 6.1 Query Types

| Query | Description |
|-------|-------------|
| `find_node(type, name)` | Find node by type and name |
| `find_dependents(project)` | All projects depending on target |
| `find_dependencies(project)` | All projects target depends on |
| `find_impact(project)` | Recursive impact analysis |
| `find_bugs(project)` | All bugs for a project |
| `find_root_cause(bug)` | Trace bug to decision/factor |
| `find_failures(pattern)` | Projects with repeated failures |
| `find_files(project)` | All files under project governance |
| `find_related(entity, type)` | Related entities by type |
| `search(text)` | Full-text search across graph |

### 6.2 Query API

```
POST /api/graph/query
```

```json
{
  "query": "find_dependents",
  "params": {
    "project": "agent-core"
  }
}
```

```
GET /api/graph/path?from={node1}&to={node2}
```

```
POST /api/graph/search
```

```json
{
  "query": "timezone bug"
}
```

---

## 7. Impact Analysis

### 7.1 Impact Score Calculation

```
Impact(project) = sum of Impact(dependent) for all dependents + 1
```

### 7.2 Severity Levels

| Score | Severity | Action |
|-------|----------|--------|
| > 5 | Critical | Immediate attention required |
| 3-5 | High | Monitor closely |
| 1-2 | Medium | Standard process |
| 0 | Low | No dependents |

### 7.3 Failure Cascade

```
If Agent Core fails:
  ├── Dashboard        → DEAD (critical)
  ├── Payroll         → DEAD (critical)
  ├── Review Auto     → DEAD (critical)
  ├── QA Platform     → DEGRADED (high)
  └── Agent Worker   → DEGRADED (high)

Total Cascade: 5 projects
Severity: CRITICAL
```

---

## 8. Integration Points

| System | Integration |
|--------|-------------|
| Source Indexer | Provides project/module data |
| Master Journal | Reads events to build edges |
| Project DNA | Reads project metadata |
| Health Engine | Writes health scores as node attributes |
| CEO Chat | Answers natural language questions |
| QA Platform | Links bugs, fixes, and decisions |
| Review Board | Reads decisions and their impact |

---

## 9. Performance Targets

| Metric | Target |
|--------|--------|
| Query response (< 100 nodes) | < 50ms |
| Full graph build | < 5 seconds |
| Incremental update | < 500ms |
| Search response | < 100ms |
| Graph size limit | 100,000 nodes |
