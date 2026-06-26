# Engineering Architecture

```text
CEO
 ↓
Mi Executive Office
 ↓
Executive Coordination Division
 ↓
Engineering Division
 ├─ Model Registry
 ├─ Engineering Task Classifier
 ├─ Model Router
 ├─ Engineering Queue
 ├─ Coding Provider Layer
 ├─ Review Engine
 ├─ Test Orchestrator
 ├─ Evidence Engine
 ├─ PR Generator
 ├─ Approval Gate
 ├─ Engineering Dashboard
 └─ Benchmark System
```

## Runtime Flow

Input:

```text
Fix Dashboard Approval Bug
```

Flow:

1. Objective Registry creates `OBJ-*`.
2. Task Registry creates an engineering coordination task.
3. Engineering classifier identifies domain/language/framework/repo/risk/complexity/production impact.
4. Model router selects the coding provider.
5. Engineering queue stores `ET-*`.
6. Provider layer dispatches to a registered provider executor.
7. Review engine scores provider output.
8. Test orchestrator records real test execution state.
9. Evidence engine links provider/test artifacts.
10. PR generator refuses `PR_READY` without real branch, commit, PR, and test evidence.
11. Approval gate blocks sensitive work until approval exists.

## No-Fake-Green Rule

No task can truthfully reach `PR_READY` unless it has:

- branch evidence
- commit evidence
- PR evidence
- test output evidence
