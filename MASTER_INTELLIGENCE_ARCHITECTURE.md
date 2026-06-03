# MASTER INTELLIGENCE LAYER — ARCHITECTURE

**The Brain of the Company**

---

## Executive Summary

The Master Intelligence Layer transforms `E:\Project\Master` from a folder of projects into an intelligent operating system for the company. It provides answers to operational questions without reading source code, enabling the company to scale from 10 to 100+ projects without losing visibility.

## Old vs New Paradigm

```
OLD                              NEW
─────────────────────────────    ─────────────────────────────
Source Code = Truth              Journal + Knowledge Graph + DNA = Truth
Read files to understand         Query the graph to understand
Memory in people's heads         Memory in the journal
Manual project tracking          Automated health monitoring
Meeting for status               CEO Chat for status
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CEO COMMAND CENTER                             │
│                     (Natural Language Interface)                          │
│                      ceo-chat / CEO_CHAT_UI/                            │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
         ┌───────────────────┼────────────────────┐
         │                   │                    │
         ▼                   ▼                    ▼
┌─────────────────┐  ┌───────────────┐  ┌──────────────────────┐
│   KNOWLEDGE     │  │   HEALTH      │  │     REVIEW           │
│   GRAPH         │  │   ENGINE      │  │     BOARD            │
│ knowledge-engine│  │ health-engine │  │  review-board        │
└────────┬────────┘  └───────┬───────┘  └──────────┬───────────┘
         │                   │                     │
         └───────────────────┼─────────────────────┘
                             │
┌─────────────────┐  ┌───────┴───────┐  ┌──────────────────────┐
│   PROJECT DNA    │  │   MASTER      │  │     ARTIFACT         │
│   ENGINE        │  │   JOURNAL     │  │     REGISTRY        │
│ master-indexer/  │◄─┤master-journal │  │  artifact-registry   │
└────────┬────────┘  └───────┬───────┘  └──────────┬───────────┘
         │                   │                      │
         └───────────────────┼──────────────────────┘
                             │
                    ┌────────┴────────┐
                    │  SOURCE INDEXER │
                    │ master-indexer  │
                    └────────┬────────┘
                             │
         ┌───────────────────┼──────────────────────┐
         │                   │                      │
         ▼                   ▼                      ▼
┌─────────────────┐  ┌───────────────┐  ┌──────────────────────┐
│   AGENT OS      │  │   QA PLATFORM │  │   OTHER PROJECTS     │
│   (existing)    │  │  qa-platform  │  │  Dashboard, Payroll  │
│                 │  │               │  │  Bakudan, etc.       │
└─────────────────┘  └───────────────┘  └──────────────────────┘
```

---

## Layer Responsibilities

### 1. Source Indexer (Phase 1)
**Purpose:** Scan and catalog all projects

- Discovers all projects under `E:\Project\Master`
- Extracts Git metadata (remote, branch, status)
- Analyzes file structure and languages
- Extracts dependencies from package files
- Generates `MASTER_INDEX.json`, `MASTER_PROJECTS.md`, `MASTER_DEPENDENCIES.md`
- Maintains `master-index.db` (SQLite)

**Outputs:**
- `master-index.db` — SQLite database with all project metadata
- `MASTER_INDEX.json` — JSON index of all projects
- `MASTER_PROJECTS.md` — Markdown project table
- `MASTER_DEPENDENCIES.md` — Dependency mapping

### 2. Project DNA Engine (Phase 2)
**Purpose:** Create identity cards for every project

- Generates `PROJECT_DNA.md` for each project
- Captures: purpose, owner, criticality, dependencies, risks, bugs, QA coverage
- Validates DNA completeness
- Scores DNA quality (completeness)

**Rule:** No PROJECT_DNA.md = Project is invisible to the Intelligence Layer

### 3. Master Journal (Phase 3)
**Purpose:** Append-only event store for all company activity

- Records every: task, build, QA run, deploy, git action, approval, rollback
- Modules: events, decisions, bugs, fixes, incidents, snapshots, artifacts, ai-memory
- Provides answers to: what changed, why, who, when

**Rules:**
- No Event = No Change
- No Decision = No Merge
- No Snapshot = No Release

### 4. Knowledge Graph (Phase 4)
**Purpose:** Store and query relationships between all entities

- Nodes: company, department, project, module, file, task, decision, bug, fix, artifact, person, release, risk
- Edges: owns, contains, has_file, depends_on, imports, caused_by, fixed_by, produced, decided, blocked_by, tested_by, related_to, triggered
- Enables queries like "What projects depend on Agent Core?" without reading code

### 5. Artifact Registry (Phase 5)
**Purpose:** Central storage for all engineering outputs

- Stores: build logs, QA reports, videos, screenshots, deploy reports, snapshots, git reports, architecture reports
- Provides: checksums, retention policies, searchable metadata
- Integrates with Master Journal for event tracking

### 6. QA Platform (Phase 6)
**Purpose:** Canonical quality service for all projects

- Engines: audit, test, stress, security, architecture, release-gate
- Tests: Playwright, regression, smoke, stress, audit, walkthrough, release gates
- Consolidated platform replacing scattered QA across projects
- Contracts: every QA run produces artifacts + journal event

### 7. Health Engine (Phase 7)
**Purpose:** Calculate and report company health

- Dimensions: Project Health, QA Health, Release Health, Infrastructure Health
- Formulas: weighted scoring with configurable weights
- Thresholds: Excellent (90-100), Healthy (80-89), Warning (70-79), Critical (50-69), Emergency (0-49)
- Alerts: configurable triggers with notification channels

### 8. CEO Chat (Phase 8)
**Purpose:** Natural language interface for CEO

- Routes: Query → Knowledge Graph, Health → Health Engine, Action → Agent OS/QA, Analysis → QA Platform
- Commands: Vietnamese (primary) and English
- Examples: "Project nào nguy hiểm nhất?", "Công ty có khỏe không?"

### 9. Review Board (Phase 9)
**Purpose:** Centralized approval gate before releases

- Reviewers: Architecture, QA, Security, Operations
- Flow: Engineering → QA Platform → Review Board → Approval Engine → Release
- Rules: All 4 reviewers must approve; any 1 rejection blocks

---

## Data Flow

```
1. SOURCE INDEXER scans E:\Project\Master
         │
         ▼
2. PROJECT DNA generated for each project
         │
         ▼
3. KNOWLEDGE GRAPH built from index + DNA
         │
         ▼
4. MASTER JOURNAL records all events
         │
         ▼
5. ARTIFACT REGISTRY stores all outputs
         │
         ▼
6. QA PLATFORM runs tests, updates health
         │
         ▼
7. HEALTH ENGINE calculates scores
         │
         ▼
8. CEO CHAT queries everything
         │
         ▼
9. REVIEW BOARD gates releases
```

---

## Integration Points

| System | Reads | Writes |
|--------|-------|--------|
| Source Indexer | File system, Git | projects table, modules table, files table |
| Project DNA Engine | Source Indexer | PROJECT_DNA.md files |
| Master Journal | All systems | events, decisions, bugs, fixes, incidents, snapshots, artifacts, ai-memory |
| Knowledge Graph | Source Indexer, Journal, DNA, Artifacts | nodes, edges |
| Artifact Registry | QA Platform, Agent OS | artifacts table, artifact_links |
| QA Platform | All projects | QA reports, videos, screenshots |
| Health Engine | All systems | health reports, alerts |
| CEO Chat | All systems | command events |
| Review Board | QA Platform, Health Engine, Knowledge Graph | review requests, approvals |

---

## Database Architecture

```
E:\Project\Master\
├── master-index.db          # Source Indexer (projects, modules, files, repos, deps, owners)
├── master-journal.db       # Master Journal (events index)
├── knowledge.db            # Knowledge Graph (nodes, edges, cache)
├── artifact-registry.db    # Artifact Registry (artifacts, links)
├── health.db               # Health Engine (historical health data)
└── reviews.db              # Review Board (review requests, approvals)
```

---

## File Structure

```
E:\Project\Master\
├── master-indexer/
│   ├── SOURCE_INDEXER_SPEC.md
│   ├── PROJECT_DNA_SPEC.md
│   ├── indexer.js
│   ├── scanner.js
│   ├── git-analyzer.js
│   ├── dep-parser.js
│   ├── db-manager.js
│   ├── output-generator.js
│   ├── config/
│   └── output/
│
├── master-journal/
│   ├── MASTER_JOURNAL_SPEC.md
│   ├── events/
│   ├── decisions/
│   ├── bugs/
│   ├── fixes/
│   ├── incidents/
│   ├── snapshots/
│   ├── artifacts/
│   ├── ai-memory/
│   └── schemas/
│
├── knowledge-engine/
│   ├── KNOWLEDGE_GRAPH_SPEC.md
│   ├── graph.js
│   ├── query-engine.js
│   ├── builder.js
│   ├── impact-analyzer.js
│   ├── nl-parser.js
│   └── data/
│
├── artifact-registry/
│   ├── ARTIFACT_REGISTRY_SPEC.md
│   ├── registry.js
│   ├── store/
│   └── config/
│
├── qa-platform/
│   ├── QA_PLATFORM_SPEC.md
│   ├── index.js
│   ├── engines/
│   │   ├── audit/
│   │   ├── test/
│   │   ├── stress/
│   │   ├── security/
│   │   ├── architecture/
│   │   └── release-gate/
│   └── artifacts/
│
├── health-engine/
│   ├── HEALTH_ENGINE_SPEC.md
│   ├── index.js
│   ├── calculator.js
│   ├── aggregator.js
│   ├── alert-engine.js
│   ├── trend-analyzer.js
│   ├── data/
│   └── reports/
│
├── ceo-chat/
│   ├── CEO_CHAT_SPEC.md
│   ├── index.js
│   ├── parser.js
│   ├── router.js
│   ├── templates/
│   ├── ui/
│   └── config/
│
├── review-board/
│   ├── REVIEW_BOARD_SPEC.md
│   ├── index.js
│   ├── reviewers/
│   ├── approval-engine.js
│   ├── review-store.js
│   └── config/
│
├── MASTER_INTELLIGENCE_ARCHITECTURE.md
└── IMPLEMENTATION_ROADMAP.md
```

---

## Success Criteria

The Intelligence Layer succeeds when:

| Question | Without Intelligence Layer | With Intelligence Layer |
|----------|---------------------------|-------------------------|
| "What changed?" | Read git logs, attend meetings | Query journal |
| "Why changed?" | Ask developers | Read decision records |
| "Who changed?" | Blame git blame | Query journal |
| "What risk exists?" | Hope someone tells you | Query knowledge graph |
| "What should QA test?" | Manual triage | Query QA platform |
| "How to rollback?" | Search docs | Query journal + artifact registry |
| "Which projects affected?" | Read all code | Query knowledge graph |

**Result:** Company scales from 10 to 100+ projects without losing visibility, traceability, or control.

---

## Dependencies

```
Source Indexer
    │
    ├── Project DNA Engine (reads index)
    ├── Knowledge Graph (reads index)
    └── all other systems (read projects)
    
Project DNA Engine
    │
    ├── Source Indexer (generates initial DNA)
    └── Knowledge Graph (reads DNA)
    
Master Journal
    │
    └── all systems (write events)
    
Knowledge Graph
    │
    ├── Source Indexer (projects, modules, files)
    ├── Master Journal (tasks, decisions, bugs)
    ├── Project DNA (risks, ownership)
    ├── Artifact Registry (artifacts)
    └── QA Platform (test coverage)
    
Artifact Registry
    │
    ├── QA Platform (produces artifacts)
    ├── Agent OS (produces artifacts)
    └── Master Journal (creates events)
    
QA Platform
    │
    ├── all projects (tests them)
    ├── Artifact Registry (stores outputs)
    └── Master Journal (writes events)
    
Health Engine
    │
    ├── all systems (reads data)
    └── Master Journal (writes health events)
    
CEO Chat
    │
    └── all systems (queries them)
    
Review Board
    │
    ├── QA Platform (gets test results)
    ├── Health Engine (checks health)
    ├── Knowledge Graph (validates deps)
    └── Master Journal (creates approval events)
```

---

## Implementation Priority

1. **P0 — Foundation**: Source Indexer + Master Journal
2. **P1 — Intelligence**: Knowledge Graph + Project DNA
3. **P2 — Quality**: QA Platform + Artifact Registry
4. **P3 — Visibility**: Health Engine + CEO Chat
5. **P4 — Control**: Review Board

See `IMPLEMENTATION_ROADMAP.md` for detailed phasing.
