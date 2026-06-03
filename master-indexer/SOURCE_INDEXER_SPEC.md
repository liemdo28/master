# SOURCE INDEXER SPEC

**Phase 1 of Master Intelligence Layer**

## Purpose

Continuously scan `E:\Project\Master` and build structured metadata for all projects. This is the foundation that makes the Knowledge Graph, Project DNA, CEO Chat, and Review Board possible.

## Scope

Scanner operates on:
```
E:\Project\Master
├── Agent/
├── agent-coding/
├── agent-os/
├── agentai-agency/
├── Bakudan/
├── Other/
├── QA/
├── RawSushi/
├── reports/
├── storage-audit-report/
├── _archive/
└── [root-level config files]
```

## Data Collection

For every project discovered, collect:

### Project Identity
| Field | Source | Notes |
|-------|--------|-------|
| `project_name` | Folder name | Normalized (lowercase, no spaces) |
| `display_name` | Git remote or folder | Human-readable |
| `path` | Absolute path | |
| `git_remote` | `git remote -v` | URL only, no fetch/push suffix |
| `git_branch` | `git branch --show-current` | Current branch |
| `git_status` | `git status --porcelain` | Clean/modified/behind/ahead |
| `language` | File extension analysis | Top 3 languages by line count |
| `framework` | package.json, pyproject.toml, etc. | Detected framework |
| `owner` | `.owner` file or `OWNER.md` in project | Assigned owner |
| `criticality` | `CRITICALITY.md` | P0/P1/P2/P3 |
| `status` | `STATUS.md` or folder prefix | Active/Archive/Maintenance |

### Size Metrics
| Field | Command | Notes |
|-------|---------|-------|
| `total_files` | `git ls-files \| wc -l` | Tracked files only |
| `total_lines` | `git ls-files \| xargs wc -l` | Total LOC |
| `dir_count` | Directory count | |
| `size_bytes` | `du -sb` | Disk usage |

### Dependencies
| Field | Source | Notes |
|-------|--------|-------|
| `dependencies` | package.json, requirements.txt, pyproject.toml | Direct deps |
| `dev_dependencies` | package.json | Dev-only deps |
| `external_apis` | Config files | External services called |
| `internal_deps` | Cross-project references | Other projects in Master |

## Database Schema

File: `master-index.db` (SQLite)

### Table: projects
```sql
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    project_name TEXT NOT NULL UNIQUE,
    display_name TEXT,
    path TEXT NOT NULL UNIQUE,
    git_remote TEXT,
    git_branch TEXT,
    git_status TEXT DEFAULT 'unknown',
    language_main TEXT,
    language_secondary TEXT,
    framework TEXT,
    owner TEXT,
    criticality TEXT DEFAULT 'P2',
    status TEXT DEFAULT 'active',
    total_files INTEGER DEFAULT 0,
    total_lines INTEGER DEFAULT 0,
    dir_count INTEGER DEFAULT 0,
    size_bytes INTEGER DEFAULT 0,
    last_indexed TEXT,
    last_modified TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### Table: modules
```sql
CREATE TABLE modules (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    module_name TEXT NOT NULL,
    path TEXT NOT NULL,
    language TEXT,
    framework TEXT,
    file_count INTEGER DEFAULT 0,
    line_count INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### Table: files
```sql
CREATE TABLE files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    module_id TEXT,
    relative_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    extension TEXT,
    language TEXT,
    line_count INTEGER DEFAULT 0,
    is_test INTEGER DEFAULT 0,
    is_config INTEGER DEFAULT 0,
    is_source INTEGER DEFAULT 1,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### Table: repositories
```sql
CREATE TABLE repositories (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    remote_url TEXT NOT NULL,
    remote_name TEXT DEFAULT 'origin',
    branch TEXT,
    commit_hash TEXT,
    commit_message TEXT,
    commit_author TEXT,
    commit_date TEXT,
    status TEXT,
    ahead INTEGER DEFAULT 0,
    behind INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### Table: dependencies
```sql
CREATE TABLE dependencies (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    dep_type TEXT NOT NULL,  -- 'npm', 'pip', 'git', 'internal', 'external_api'
    dep_name TEXT NOT NULL,
    dep_version TEXT,
    is_dev INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### Table: owners
```sql
CREATE TABLE owners (
    id TEXT PRIMARY KEY,
    owner_name TEXT NOT NULL UNIQUE,
    email TEXT,
    role TEXT,
    projects_owned TEXT  -- JSON array of project IDs
);
```

### Table: frameworks
```sql
CREATE TABLE frameworks (
    id TEXT PRIMARY KEY,
    framework_name TEXT NOT NULL UNIQUE,
    language TEXT,
    ecosystem TEXT,  -- npm, pip, maven, etc.
    project_count INTEGER DEFAULT 0
);
```

### Table: languages
```sql
CREATE TABLE languages (
    id TEXT PRIMARY KEY,
    language_name TEXT NOT NULL UNIQUE,
    extensions TEXT,  -- JSON array
    project_count INTEGER DEFAULT 0,
    total_lines INTEGER DEFAULT 0
);
```

## Outputs

### MASTER_INDEX.json
```json
{
  "generated_at": "2026-06-01T19:00:00Z",
  "total_projects": 47,
  "total_files": 12847,
  "total_lines": 892451,
  "index_version": "1.0",
  "projects": [
    {
      "project_name": "agent-os",
      "display_name": "Agent OS",
      "path": "E:\\Project\\Master\\agent-os",
      "git_remote": "https://github.com/liemdo28/agent-os.git",
      "git_branch": "main",
      "language_main": "TypeScript",
      "framework": "Node.js",
      "owner": "Engineering",
      "criticality": "P0",
      "status": "active",
      "total_files": 234,
      "total_lines": 45231,
      "dependencies": 12,
      "last_indexed": "2026-06-01T19:00:00Z"
    }
  ]
}
```

### MASTER_PROJECTS.md
Markdown table of all projects with key metadata.

### MASTER_DEPENDENCIES.md
All internal and external dependencies mapped to projects.

## Indexer CLI

```bash
# Full index
node indexer.js --full

# Incremental (changed since last run)
node indexer.js --incremental

# Single project
node indexer.js --project agent-os

# Export outputs
node indexer.js --export json
node indexer.js --export md

# Health check
node indexer.js --health
```

## Architecture

```
master-indexer/
├── indexer.js          # Main entry point
├── scanner.js          # File system scanner
├── git-analyzer.js     # Git metadata extraction
├── dep-parser.js        # Dependency extraction
├── db-manager.js       # SQLite operations
├── output-generator.js # JSON/MD export
├── config/
│   └── scan-rules.json # Include/exclude patterns
├── data/
│   └── master-index.db
└── output/
    ├── MASTER_INDEX.json
    ├── MASTER_PROJECTS.md
    └── MASTER_DEPENDENCIES.md
```

## Scan Rules

### Include Patterns
- `**/*.ts`, `**/*.js`, `**/*.tsx`, `**/*.jsx`
- `**/*.py`, `**/*.java`, `**/*.cs`, `**/*.go`, `**/*.rs`
- `**/*.md`, `**/*.json`, `**/*.yaml`, `**/*.yml`
- `**/*.sql`, `**/*.sh`, `**/*.ps1`, `**/*.bat`

### Exclude Patterns
- `node_modules/`, `.git/`, `dist/`, `build/`, `out/`
- `_archive/`, `*.zip`, `*.log`, `*.tmp`
- `coverage/`, `.nyc_output/`, `.pytest_cache/`

## Update Frequency

- **Full index**: Daily at 6:00 AM
- **Incremental**: Every 15 minutes (via cron/agent)
- **On-demand**: Triggered by git hooks or CEO command

## Success Criteria

- [ ] All projects under `E:\Project\Master` are indexed
- [ ] Database is queryable in < 100ms for standard queries
- [ ] Outputs are valid JSON/Markdown
- [ ] Incremental updates complete in < 5 seconds
- [ ] Git metadata (remote, branch, status) is accurate
