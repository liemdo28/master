# Source Indexer — Specification

> **Status:** P0 — Phase 1  
> **Version:** 1.0  
> **Last Updated:** 2026-06-01  
> **Owner:** Agent OS  

---

## 1. Purpose

The Source Indexer continuously scans `E:\Project\Master` and builds structured metadata about every project, module, file, repository, dependency, and owner — stored in a SQLite database and exported as JSON/Markdown reports.

---

## 2. Scope

### 2.1 What It Scans

Every top-level directory under `E:\Project\Master` that is a project (has source code, package.json, .git, or similar markers).

### 2.2 What It Collects

For every project:

| Field | Source | Example |
|-------|--------|---------|
| Project Name | Directory name | `Bakudan` |
| Path | Filesystem | `E:\Project\Master\Bakudan` |
| Git Remote | `.git/config` | `github.com/company/bakudan` |
| Branch | `git branch` | `main` |
| Language | File extensions | `TypeScript` |
| Framework | package.json / config | `Next.js` |
| Size | Disk usage | `45 MB` |
| File Count | File scan | `342` |
| Dependencies | package.json / imports | `react, next` |
| Owner | PROJECT_DNA.md / git | `Engineering` |
| Status | PROJECT_DNA.md / health | `Active` |

---

## 3. Database Schema

### 3.1 Storage

File: `master-indexer/db/master-index.db` (SQLite)

### 3.2 Tables

```sql
-- Core project registry
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    git_remote TEXT,
    default_branch TEXT,
    primary_language TEXT,
    primary_framework TEXT,
    size_bytes INTEGER,
    file_count INTEGER,
    owner TEXT,
    status TEXT DEFAULT 'unknown',
    criticality TEXT DEFAULT 'P3',
    last_indexed_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Modules within projects
CREATE TABLE modules (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    language TEXT,
    framework TEXT,
    file_count INTEGER,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- File inventory (summary level, not every file)
CREATE TABLE files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    module_id TEXT,
    relative_path TEXT NOT NULL,
    extension TEXT,
    size_bytes INTEGER,
    last_modified TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (module_id) REFERENCES modules(id)
);

-- Git repositories
CREATE TABLE repositories (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    remote_url TEXT,
    default_branch TEXT,
    current_branch TEXT,
    last_commit_hash TEXT,
    last_commit_date TEXT,
    last_commit_author TEXT,
    is_dirty INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Inter-project and external dependencies
CREATE TABLE dependencies (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    dependency_name TEXT NOT NULL,
    dependency_type TEXT NOT NULL,  -- 'internal', 'npm', 'pip', 'nuget', 'go'
    version TEXT,
    is_dev INTEGER DEFAULT 0,
    target_project_id TEXT,  -- if internal dependency
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (target_project_id) REFERENCES projects(id)
);

-- Project owners
CREATE TABLE owners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    projects_count INTEGER DEFAULT 0
);

-- Framework usage
CREATE TABLE frameworks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT,
    project_id TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Language breakdown
CREATE TABLE languages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    language TEXT NOT NULL,
    file_count INTEGER,
    total_lines INTEGER,
    percentage REAL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

---

## 4. Scanner Logic

### 4.1 Discovery Phase

```
1. List all top-level directories in E:\Project\Master
2. Skip: _archive, _cleanup*, .git, node_modules, .wrangler
3. For each directory:
   a. Check if it's a project (has .git, package.json, src/, etc.)
   b. If multi-project (like Bakudan/), recurse one level
   c. Register as project
```

### 4.2 Analysis Phase

For each discovered project:

```
1. Git Analysis:
   - Read .git/config for remote
   - Get current branch
   - Get last commit info
   - Check dirty status

2. Language Analysis:
   - Count files by extension
   - Calculate percentages
   - Identify primary language

3. Framework Detection:
   - Read package.json (Node.js)
   - Read requirements.txt / pyproject.toml (Python)
   - Read go.mod (Go)
   - Read *.csproj (C#)
   - Detect: React, Next.js, Express, Playwright, etc.

4. Dependency Extraction:
   - Parse package.json dependencies
   - Identify internal cross-references
   - Map to other projects in Master

5. Size Calculation:
   - Total disk usage (excluding node_modules, .git)
   - File count
   - Line count (optional)

6. Owner Detection:
   - Read PROJECT_DNA.md if exists
   - Fall back to git log primary author
   - Fall back to 'unknown'
```

### 4.3 Storage Phase

```
1. Upsert all data into master-index.db
2. Update last_indexed_at timestamp
3. Generate output files
```

---

## 5. Output Files

### 5.1 MASTER_INDEX.json

```json
{
  "indexed_at": "2026-06-01T19:00:00+07:00",
  "total_projects": 15,
  "total_files": 4521,
  "total_size_mb": 892,
  "projects": [
    {
      "name": "agent-os",
      "path": "E:\\Project\\Master\\agent-os",
      "language": "TypeScript",
      "framework": "Node.js",
      "git_remote": "...",
      "branch": "main",
      "file_count": 156,
      "size_mb": 45,
      "owner": "Engineering",
      "status": "Active",
      "criticality": "P0",
      "dependencies": ["agent-coding"],
      "modules": ["agent-control", "agent-worker", "CEO_CHAT_UI", "shared"]
    }
  ]
}
```

### 5.2 MASTER_PROJECTS.md

```markdown
# Master Projects Index

> Generated: 2026-06-01 19:00 ICT
> Total Projects: 15

| # | Project | Language | Framework | Status | Owner | Criticality |
|---|---------|----------|-----------|--------|-------|-------------|
| 1 | agent-os | TypeScript | Node.js | Active | Engineering | P0 |
| 2 | Bakudan | TypeScript | Next.js | Active | Engineering | P1 |
| ... |
```

### 5.3 MASTER_DEPENDENCIES.md

```markdown
# Master Dependencies Map

> Generated: 2026-06-01 19:00 ICT

## Internal Dependencies

| Project | Depends On | Type |
|---------|-----------|------|
| agent-os | agent-coding | hard |
| Bakudan/dashboard | agent-os | soft |
| ...

## External Dependencies (Top 20)

| Package | Used By | Version(s) |
|---------|---------|------------|
| react | 5 projects | 18.x, 19.x |
| typescript | 8 projects | 5.x |
| ...
```

---

## 6. Execution

### 6.1 Manual Run

```powershell
cd E:\Project\Master\master-indexer
node indexer.js
```

### 6.2 Scheduled Run

Can be triggered by:
- Agent OS task scheduler
- Manual CLI invocation
- Git hook (post-commit)

### 6.3 Incremental Mode

After first full scan, subsequent runs only re-index projects with:
- Modified files (mtime check)
- New git commits
- Changed package.json

---

## 7. Integration Points

| Consumer | What It Reads |
|----------|---------------|
| Knowledge Graph | projects, dependencies, modules |
| Health Engine | project status, file counts, git health |
| CEO Chat | project summaries, dependency queries |
| QA Platform | project list for audit scope |
| Project DNA Engine | base data for DNA generation |
| Master Journal | index events (project added/removed/changed) |

---

## 8. Error Handling

| Scenario | Action |
|----------|--------|
| Directory not accessible | Skip, log warning |
| No .git directory | Index without git data |
| Corrupt package.json | Skip dependency extraction, log error |
| Database locked | Retry 3 times with backoff |
| Scan timeout (>5 min per project) | Skip, log timeout |

---

## 9. Performance Targets

| Metric | Target |
|--------|--------|
| Full scan (15 projects) | < 60 seconds |
| Incremental scan | < 10 seconds |
| Database size | < 50 MB |
| Output generation | < 5 seconds |
