# Phase M — Company Knowledge Graph

## Overview

Knowledge Graph biến E:\Project\Master từ thư mục source thành **hệ điều hành tri thức doanh nghiệp**.

---

## Knowledge Graph Structure

```
Company
 │
 ├── Department
 │   ├── Engineering
 │   ├── Operations
 │   ├── Finance
 │   ├── Marketing
 │   └── Sales
 │
 ├── Project
 │   ├── Agent Core
 │   ├── Dashboard
 │   ├── Payroll
 │   └── ...
 │
 ├── Module
 │   ├── API Module
 │   ├── Auth Module
 │   ├── Database Module
 │   └── ...
 │
 ├── File
 │   └── (source files)
 │
 ├── Task
 │   └── (all tasks ever run)
 │
 ├── Decision
 │   └── (architectural decisions)
 │
 ├── Bug
 │   └── (known bugs)
 │
 ├── Fix
 │   └── (applied fixes)
 │
 ├── Artifact
 │   └── (task outputs)
 │
 └── Snapshot
     └── (system snapshots)
```

---

## Graph Queries

Agent có thể trả lời:

```json
// Query: "Dashboard là gì?"
{
  "query": "Dashboard là gì?",
  "answer": {
    "project": "Dashboard",
    "purpose": "Task management UI",
    "owner": "Engineering",
    "status": "Active",
    "qa_score": 92,
    "last_release": "v2.3.0"
  }
}

// Query: "Payroll phụ thuộc gì?"
{
  "query": "Payroll dependencies",
  "answer": {
    "project": "Payroll",
    "depends_on": ["Agent Core", "API"],
    "dependents": [],
    "impact_score": 3
  }
}

// Query: "Project nào dùng Agent Core?"
{
  "query": "Projects using Agent Core",
  "answer": {
    "agent_core_dependents": ["Dashboard", "Payroll", "Review Auto", "QA Platform", "Agent Worker"],
    "total": 5,
    "impact": "If Agent Core fails, 5 projects affected"
  }
}
```

---

## Knowledge Graph Database

```sql
-- Departments
CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT,
  criticality TEXT,
  created_at TEXT
);

-- Projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department_id TEXT,
  owner TEXT,
  purpose TEXT,
  business_criticality TEXT,  -- P0, P1, P2, P3
  qa_score REAL,
  status TEXT,
  project_dna_path TEXT
);

-- Modules
CREATE TABLE modules (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT NOT NULL,
  owner TEXT,
  language TEXT,
  framework TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Dependencies
CREATE TABLE dependencies (
  id TEXT PRIMARY KEY,
  from_project TEXT,
  to_project TEXT,
  type TEXT,  -- hard, soft, optional
  FOREIGN KEY (from_project) REFERENCES projects(id),
  FOREIGN KEY (to_project) REFERENCES projects(id)
);

-- Bugs
CREATE TABLE bugs (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  title TEXT,
  severity TEXT,
  status TEXT,
  root_cause TEXT,
  occurred_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Fixes
CREATE TABLE fixes (
  id TEXT PRIMARY KEY,
  bug_id TEXT,
  description TEXT,
  applied_at TEXT,
  FOREIGN KEY (bug_id) REFERENCES bugs(id)
);

-- Decisions
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  title TEXT,
  decision TEXT,
  rationale TEXT,
  decided_by TEXT,
  decided_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Knowledge Edges
CREATE TABLE knowledge_edges (
  id TEXT PRIMARY KEY,
  from_node TEXT,
  from_type TEXT,
  to_node TEXT,
  to_type TEXT,
  relationship TEXT
);
```

---

## Project DNA

Mỗi project có PROJECT_DNA.md:

```markdown
# PROJECT_DNA.md - Payroll

## Identity
Project: Payroll
Purpose: Employee payroll calculation
Owner: Engineering

## Classification
Business Criticality: P0 (Critical)
QA Level: Enhanced Review

## Dependencies
- Agent Core (hard)
- Google Drive API (soft)
- Database (hard)

## Known Risks
- Timezone handling
- Overtime calculation
- Tax rules

## QA Coverage
- Test Coverage: 92%
- Last Audit: 2026-06-01
- Security Score: 88

## Status
Current: Active
Last Release: v2.1.0
Release Frequency: Monthly

## Knowledge
- Bugs: 5 (3 fixed, 2 known)
- Decisions: 12
- Related Projects: Dashboard, Agent Core

## Health
Score: 88/100
Status: 🟡 WARNING
```

---

## Knowledge Graph API

### Query Endpoint
```
POST /api/knowledge/query
```

### Ask Natural Questions

```json
{
  "question": "Tại sao release engine tồn tại?"
}
```

```json
{
  "answer": {
    "project": "Release Engine",
    "purpose": "Automated release gating",
    "created": "2026-03-15",
    "reason": "To prevent bad releases from reaching production",
    "decisions": ["#145 - Need automated QA gate"],
    "bugs_fixed": 3,
    "related": ["QA Platform", "Approval Engine"]
  }
}
```

---

## Implementation

```typescript
class KnowledgeGraph {
  async build(): Promise<void> {
    // 1. Scan projects
    const projects = await this.scanProjects();
    
    // 2. Extract dependencies
    for (const project of projects) {
      const deps = await this.extractDependencies(project);
      await this.storeDependencies(deps);
    }
    
    // 3. Generate PROJECT_DNA
    for (const project of projects) {
      const dna = await this.generateDNA(project);
      await this.storeDNA(dna);
    }
    
    // 4. Build knowledge edges
    await this.buildEdges();
  }
  
  async query(question: string): Promise<Answer> {
    // 1. Parse question
    const intent = this.parseQuestion(question);
    
    // 2. Find relevant knowledge
    const knowledge = await this.findKnowledge(intent);
    
    // 3. Generate answer
    return this.generateAnswer(knowledge, intent);
  }
  
  async findRelatedProjects(projectName: string): Promise<Project[]> {
    // Find all projects that depend on this one
    const deps = await this.db.query(`
      SELECT from_project FROM dependencies WHERE to_project = ?
    `, [projectName]);
    
    return deps.map(d => this.getProject(d.from_project));
  }
  
  async findImpact(projectName: string): Promise<ImpactAnalysis> {
    // Recursive dependency analysis
    const impacted = new Set<string>();
    
    const traverse = (name: string) => {
      const deps = this.db.query(`
        SELECT from_project FROM dependencies WHERE to_project = ?
      `, [name]);
      
      for (const dep of deps) {
        if (!impacted.has(dep.from_project)) {
          impacted.add(dep.from_project);
          traverse(dep.from_project);
        }
      }
    };
    
    traverse(projectName);
    
    return {
      project: projectName,
      impacted_projects: Array.from(impacted),
      total_impact: impacted.size,
      severity: impacted.size > 3 ? 'critical' : impacted.size > 1 ? 'high' : 'medium'
    };
  }
}
```

---

## CEO Questions

Knowledge Graph trả lời:

```txt
Q: Project nào nguy hiểm nhất?
A: Agent Core (5 projects depend on it)

Q: Tại sao Dashboard QA score giảm?
A: 2 new bugs in auth module, test coverage dropped 5%

Q: Có bug nào lặp lại 3 lần không?
A: Timezone bug occurred in Dashboard, Payroll, Review Auto

Q: Project nào chưa được QA?
A: Marketing Site (last audit: 45 days ago)

Q: Nếu Agent Core chết thì sao?
A: 5 projects affected (Dashboard, Payroll, Review Auto, QA Platform, Agent Worker)

Q: Top 10 rủi ro?
A: 1. Agent Core (P0), 2. Payroll (P0), 3. Auth (P0)...
```
