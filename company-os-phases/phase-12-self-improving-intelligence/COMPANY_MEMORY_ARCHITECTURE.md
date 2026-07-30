# COMPANY_MEMORY_ARCHITECTURE.md — Self-Improving Company Intelligence

**Generated:** 2026-06-27
**Purpose:** Mi learns from evidence, outcomes, failures, approvals, and decisions
**Status:** FOUNDATION COMPLETE

---

## Memory Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MI COMPANY MEMORY                         │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   OUTCOME   │  │  FAILURE    │  │  APPROVAL   │         │
│  │   MEMORY    │  │   MEMORY    │  │   MEMORY    │         │
│  │             │  │             │  │             │         │
│  │ successes   │  │ errors      │  │ human       │         │
│  │ patterns     │  │ root causes │  │ decisions   │         │
│  │ ROI achieved │  │ cascading   │  │ corrections │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                │
│         └────────────────┼────────────────┘                │
│                          ▼                                   │
│              ┌───────────────────────┐                      │
│              │    DECISION REPLAY     │                      │
│              │       ENGINE          │                      │
│              │  Case-based reasoning  │                      │
│              └───────────┬───────────┘                      │
│                          ▼                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │RECOMMENDATION│  │  ROOT CAUSE │  │   PLAYBOOK  │         │
│  │   ENGINE     │  │   ENGINE    │  │   ENGINE    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│              ┌───────────────────────┐                      │
│              │  LEARNING SCORECARD   │                      │
│              │  Tracks improvement   │                      │
│              └───────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Memory Stores

### 1. Outcome Memory

Stores all successful outcomes with full evidence chains.

```
Schema:
  outcome_id: UUID
  objective: string
  actions_taken: list[ActionRecord]
  result: enum(SUCCESS, PARTIAL, FAILED)
  evidence: list[EvidenceRef]
  timestamp: datetime
  duration_ms: int
  worker_type: enum(HUMAN, AI_AGENT, OSS)
  worker_id: string
  roi_achieved: float
  tags: list[string]
```

### 2. Failure Memory

Stores all failures with root cause analysis.

```
Schema:
  failure_id: UUID
  symptom: string
  error_type: enum(TIMEOUT, AUTH, DATA, NETWORK, POLICY, UNKNOWN)
  affected_systems: list[string]
  root_cause: string
  cascade_path: list[string]
  resolution: string
  timestamp: datetime
  resolved_at: datetime
  prevention_tags: list[string]
```

### 3. Approval Memory

Stores human decisions and corrections for learning patterns.

```
Schema:
  approval_id: UUID
  action_draft: ActionRecord
  requested_by: enum(MI, AI_AGENT, OSS)
  approver: HumanID
  decision: enum(APPROVED, REJECTED, MODIFIED, DELEGATED)
  correction: string  # What human changed
  reasoning: string  # Why human made this decision
  timestamp: datetime
  context_window: string
```

---

## Memory Storage Path

```
mi-core/memory/
  outcomes/
    {year}/
      {month}/
        OUTCOME-{uuid}.json
  failures/
    {year}/
      {month}/
        FAILURE-{uuid}.json
  approvals/
    {year}/
      {month}/
        APPROVAL-{uuid}.json
  replays/
    REPLAY_CASES.json
  scorecard/
    LEARNING_SCORE.json
```

---

## Cross-Memory Correlation Engine

### Failure → Outcome Linking
```
When a failure is resolved:
  1. Find similar past failures (symptom + error_type)
  2. Find associated outcomes that used same worker
  3. Correlate root cause → resolution pattern
  4. Tag prevention rule
```

### Approval → Outcome Linking
```
When an approval leads to positive outcome:
  1. Store correction pattern as preferred behavior
  2. Learn when human overrides improve results
  3. Build human preference profile
```

---

## Next Actions

1. Integrate outcome-memory with execution engine
2. Connect failure-memory to root-cause-engine
3. Build approval-memory into HITL Phase 14
