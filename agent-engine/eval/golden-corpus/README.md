# Golden Corpus — M1: 50 Hand-Picked Real-World Tasks

**Status:** PENDING
**Owner:** ML Lead + Coding-Core
**Due:** end of Q1 (M1)

## Overview

The golden corpus is a hand-picked set of 50 real-world tasks across 10 languages from 10 open-source projects. These tasks are used for weekly regression testing — they represent problems that matter in production codebases.

## Format

Each task is a directory under `eval/golden-corpus/`:

```
eval/golden-corpus/
  task-001/
    task.yaml          # Structured task definition
    reference/         # Expected solution
    test/              # Test cases
    metadata.json      # Source project, difficulty, tags
  task-002/
    ...
```

## Task YAML Format

```yaml
task_id: task-001
title: "Fix memory leak in HTTP keep-alive handler"
language: typescript
difficulty: medium        # easy | medium | hard
source_project: express
source_project_url: https://github.com/expressjs/express
issue_url: https://github.com/expressjs/express/issues/XXXXX
description: |
  The HTTP keep-alive handler in lib/application.js does not clear
  the timeout when a new request arrives. This causes the connection
  to close prematurely after 5 seconds of inactivity even when
  there are active long-polling requests.
repo_context: |
  The relevant files are:
  - lib/application.js (line 450-510)
  - lib/request.js
acceptance_criteria:
  - "Long-polling connections stay open for >30 seconds"
  - "Non-keep-alive connections close within 5s"
  - "No timeout is left dangling after request completion"
tags:
  - http
  - networking
  - memory-leak
  - typescript
expected_outcome: |
  A patch that adds proper timeout cleanup on the 'request' event
  handler in lib/application.js.
```

## 10 Source Projects

| # | Project | Language | Description |
|---|---------|----------|-------------|
| 1 | express | JavaScript/TypeScript | Web framework |
| 2 | django | Python | Web framework |
| 3 | kubernetes | Go | Container orchestrator |
| 4 | rust | Rust | Systems language |
| 5 | spring-boot | Java | Java framework |
| 6 | rails | Ruby | Web framework |
| 7 | next.js | TypeScript | React framework |
| 8 | numpy | Python | Scientific computing |
| 9 | pulumi | TypeScript/Go | IaC |
| 10 | git | C | Version control |

## 50-Task Distribution

- 10 languages × 5 tasks each
- Difficulty distribution: 15 easy, 25 medium, 10 hard
- Covering: bug fixes, refactors, feature additions, test writing, docs

## Acceptance

```
npm run eval:golden
```

- ≥35 of 50 tasks produce an applyable, test-passing patch
- ≥25 of 50 tasks produce a correct solution
- At least 3 of 5 tasks per language pass

## Weekly Cadence

The golden corpus is run every Friday (Metric Friday). Delta vs baseline is published in `#engineering`.

## How to Add a Task

1. Identify a real issue from one of the 10 source projects
2. Create `eval/golden-corpus/task-NNN/`
3. Write `task.yaml` with structured description
4. Include `reference/` with the actual fix
5. Include `test/` with regression tests
6. Add `metadata.json`
7. Update `eval/golden-corpus/INDEX.json`