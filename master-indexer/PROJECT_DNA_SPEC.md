# PROJECT DNA SPEC

**Phase 2 of Master Intelligence Layer**

## Purpose

Every project under `E:\Project\Master` must generate a `PROJECT_DNA.md` file that captures its identity, purpose, dependencies, risks, and health in a machine-readable format. This eliminates the need to read source code to understand what a project is and what it does.

## Rule

```
No PROJECT_DNA.md = Project is invisible to the Intelligence Layer
```

## Required Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_name` | string | ✓ | Canonical name |
| `purpose` | string | ✓ | One-line business purpose |
| `business_function` | string | ✓ | Department/function served |
| `owner` | string | ✓ | Responsible person/team |
| `criticality` | enum | ✓ | P0/P1/P2/P3 |
| `dependencies` | list | ✓ | Internal + external deps |
| `known_risks` | list | ✓ | Active risk items |
| `known_bugs` | list | | Open bugs |
| `qa_coverage` | number | ✓ | Percentage 0-100 |
| `release_status` | enum | ✓ | Active/Maintenance/Archive/Blocked |
| `health_score` | number | | Calculated by Health Engine |
| `last_release` | string | | Version or date |
| `release_frequency` | string | | Weekly/Monthly/On-demand |
| `tech_stack` | list | ✓ | Languages, frameworks, databases |
| `deploy_target` | string | | Where it runs |
| `related_projects` | list | | Cross-references |

## Template

```markdown
# PROJECT_DNA.md

## Identity
- **Project**: [name]
- **Purpose**: [one-line description]
- **Business Function**: [Engineering/Operations/Finance/Marketing]
- **Owner**: [person or team]

## Classification
- **Criticality**: [P0/P1/P2/P3]
- **Status**: [Active/Maintenance/Archive/Blocked]
- **Release Frequency**: [Weekly/Monthly/On-demand]

## Tech Stack
- **Language**: [primary language]
- **Framework**: [framework]
- **Database**: [if applicable]
- **Deploy Target**: [where it runs]

## Dependencies
### Internal
- [project-name] (hard/soft)

### External
- [package@version]
- [API endpoint]

## Known Risks
- [risk description] (severity: high/medium/low)

## Known Bugs
- [bug description] (status: open/investigating/fixing)

## QA Coverage
- **Test Coverage**: [percentage]%
- **Last Audit**: [date]
- **Security Score**: [score/100]
- **QA Level**: [Standard/Enhanced/Critical]

## Health
- **Score**: [0-100]
- **Status**: [🟢 PASS / 🟡 WARNING / 🔴 CRITICAL]
- **Trend**: [↑ improving / → stable / ↓ declining]

## Related Projects
- [project-name]: [relationship description]

## History
- **Created**: [date]
- **Last Modified**: [date]
- **Last Release**: [version or date]
- **Total Releases**: [count]
```

## DNA Generation

The Source Indexer generates initial DNA from:
1. Git metadata (name, remote, branch)
2. Package files (dependencies, framework)
3. File analysis (language, size)
4. Existing docs (README, CHANGELOG)

Fields that require human input:
- `purpose` (inferred from README if available)
- `business_function`
- `owner`
- `criticality`
- `known_risks`

## DNA Engine Architecture

```
master-indexer/
└── dna-engine/
    ├── generator.js      # Generate DNA from index data
    ├── validator.js      # Validate DNA completeness
    ├── updater.js        # Update DNA on changes
    ├── templates/
    │   └── PROJECT_DNA.template.md
    └── rules/
        └── criticality-rules.json
```

## Validation Rules

| Rule | Condition | Action |
|------|-----------|--------|
| Missing DNA | No PROJECT_DNA.md | Generate skeleton |
| Stale DNA | Last modified > 30 days | Flag for review |
| Incomplete DNA | Required fields empty | Block release |
| Inconsistent DNA | Dependencies don't match package.json | Alert |
| Orphan DNA | Project folder deleted | Archive DNA |

## DNA Scoring

DNA completeness contributes to project health:

```
DNA Score = (
  Identity fields filled (20%) +
  Dependencies documented (20%) +
  Risks documented (20%) +
  QA coverage recorded (20%) +
  Status current (20%)
)
```

## Integration Points

- **Source Indexer**: Generates initial DNA
- **Knowledge Graph**: Reads DNA for relationship mapping
- **Health Engine**: Uses DNA for health calculation
- **CEO Chat**: Queries DNA for project summaries
- **Review Board**: Validates DNA before release approval
- **QA Platform**: Uses DNA to determine test scope

## Success Criteria

- [ ] Every active project has a PROJECT_DNA.md
- [ ] DNA is machine-parseable (structured markdown)
- [ ] DNA is validated on every git push
- [ ] Stale DNA triggers alerts
- [ ] CEO can query any project's DNA via natural language
