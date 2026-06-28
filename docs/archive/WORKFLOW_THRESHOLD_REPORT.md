# WORKFLOW_THRESHOLD_REPORT.md — P0-6 Workflow Action Threshold

**Priority:** P0 — PRODUCTION BLOCKER
**Generated:** 2026-06-16T08:08:00+07:00
**Status:** IMPLEMENTED
**Owner:** Mi-Core Central Command

---

## Problem Statement

Previous behavior generated workflows automatically for most inputs:
- Any question about status → created monitoring workflow
- Any mention of a task → created tracking workflow
- Any casual update → spawned follow-up workflow
- Ambiguous input → system chose the most "helpful" workflow

**Root Cause:** No threshold requiring justification before workflow creation. The default was "create workflow."

---

## Workflow Action Threshold

Workflow creation now requires ALL THREE conditions to be met:

```
WORKFLOW CREATION = Evidence + Decision + Execution Justification
                    (P0-1)     (P0-2)    (this report)
```

### The Three Requirements

| Requirement | Gate | Description |
|---|---|---|
| **1. Evidence** | P0-1 Evidence Gate | Evidence must be classified as CONFIRMED or UNCONFIRMED (not MISSING) |
| **2. Decision** | P0-2 Decision Gate | Decision must be EXECUTE or REQUEST_APPROVAL (not ACKNOWLEDGE or REPORT) |
| **3. Execution Justification** | P0-6 (this gate) | Written justification explaining WHY a workflow is needed |

### ALL Three Must Be Present

| Evidence | Decision | Justification | Workflow Created? |
|---|---|---|---|
| CONFIRMED | EXECUTE | ✅ Provided | **YES** |
| CONFIRMED | REQUEST_APPROVAL | ✅ Provided | **YES** |
| UNCONFIRMED | EXECUTE | ✅ Provided | **YES** (with qualification) |
| CONFIRMED | ACKNOWLEDGE | Any | **NO** |
| MISSING | Any | Any | **NO** |
| STALE | Any | Any | **NO** |
| Any | REPORT | Any | **NO** |
| Any | REQUEST_CLARIFICATION | Any | **NO** |
| CONFIRMED | EXECUTE | ❌ Not provided | **NO** |

---

## Execution Justification Format

When requesting workflow creation, the system MUST produce a justification object:

```typescript
interface ExecutionJustification {
  whyWorkflowNeeded: string;    // Plain explanation
  whatActionWillBeTaken: string; // Specific action description
  whatHappensWithout: string;   // Consequence of not creating workflow
  reversible: boolean;          // Can this be undone?
  riskLevel: 'low' | 'medium' | 'high';
  ceoBenefit: string;           // How this helps the CEO
}
```

### Justification Examples

**Valid Justification:**
```json
{
  "whyWorkflowNeeded": "CEO requested email to be sent to vendor about pricing",
  "whatActionWillBeTaken": "Draft and send email via Gmail connector",
  "whatHappensWithout": "Vendor doesn't receive pricing update, deal may stall",
  "reversible": true,
  "riskLevel": "medium",
  "ceoBenefit": "Saves CEO 10 minutes of manual email composition"
}
```

**Invalid Justification (rejected):**
```json
{
  "whyWorkflowNeeded": "CEO mentioned 'email' in their message",
  "whatActionWillBeTaken": "Create email draft workflow",
  "whatHappensWithout": "Unknown",
  "reversible": true,
  "riskLevel": "low",
  "ceoBenefit": "System is being helpful"
}
```

The second example is rejected because:
1. CEO mentioned email but didn't REQUEST sending one
2. "Being helpful" is not a valid justification
3. "Unknown" consequence = unclear need

---

## Workflow Threshold Gate Implementation

Location: `server/src/jarvis/phase30-jarvis/workflow-threshold.ts`

```typescript
// Workflow Threshold Gate — P0-6 Implementation
// Prevents automatic workflow creation

import { EvidenceClass } from './evidence-gate';
import { DecisionType } from './decision-gate';

export interface ExecutionJustification {
  whyWorkflowNeeded: string;
  whatActionWillBeTaken: string;
  whatHappensWithout: string;
  reversible: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  ceoBenefit: string;
}

export interface WorkflowThresholdInput {
  evidenceClass: EvidenceClass;
  decisionType: DecisionType;
  justification: ExecutionJustification | null;
  ceoExplicitlyRequested: boolean;
  isFollowUp: boolean;
}

export interface WorkflowThresholdResult {
  workflowAllowed: boolean;
  reason: string;
}

export function evaluateWorkflowThreshold(
  input: WorkflowThresholdInput
): WorkflowThresholdResult {

  // Rule 1: Follow-up inputs NEVER create workflows
  if (input.isFollowUp) {
    return {
      workflowAllowed: false,
      reason: 'Follow-up input — no workflow allowed (P0-5)',
    };
  }

  // Rule 2: MISSING evidence → NO workflow
  if (input.evidenceClass === 'MISSING') {
    return {
      workflowAllowed: false,
      reason: 'Evidence is MISSING — cannot create workflow without data (P0-1)',
    };
  }

  // Rule 3: STALE evidence → NO workflow
  if (input.evidenceClass === 'STALE') {
    return {
      workflowAllowed: false,
      reason: 'Evidence is STALE — cannot create workflow with old data (P0-1)',
    };
  }

  // Rule 4: ACKNOWLEDGE/REPORT decisions → NO workflow
  if (input.decisionType === 'ACKNOWLEDGE' || input.decisionType === 'REPORT') {
    return {
      workflowAllowed: false,
      reason: `Decision is ${input.decisionType} — no action needed (P0-2)`,
    };
  }

  // Rule 5: REQUEST_CLARIFICATION → NO workflow
  if (input.decisionType === 'REQUEST_CLARIFICATION') {
    return {
      workflowAllowed: false,
      reason: 'Decision is REQUEST_CLARIFICATION — need more info first (P0-2)',
    };
  }

  // Rule 6: Must have justification
  if (!input.justification) {
    return {
      workflowAllowed: false,
      reason: 'No execution justification provided — workflow requires justification (P0-6)',
    };
  }

  // Rule 7: Justification must have substance
  if (
    input.justification.whyWorkflowNeeded.length < 10 ||
    input.justification.whatHappensWithout === 'Unknown'
  ) {
    return {
      workflowAllowed: false,
      reason: 'Execution justification is insufficient — must explain why and consequence',
    };
  }

  // Rule 8: CEO must have explicitly requested the action
  if (!input.ceoExplicitlyRequested) {
    return {
      workflowAllowed: false,
      reason: 'CEO has not explicitly requested this action',
    };
  }

  // All conditions met
  return {
    workflowAllowed: true,
    reason: `All conditions met: ${input.evidenceClass} evidence + ${input.decisionType} decision + justified execution`,
  };
}
```

---

## Workflow Creation Audit Log

Every workflow creation attempt MUST be logged:

```json
{
  "timestamp": "2026-06-16T08:08:00.000Z",
  "input": "Gửi email báo giá cho vendor",
  "evidenceClass": "CONFIRMED",
  "decisionType": "REQUEST_APPROVAL",
  "justification": {
    "whyWorkflowNeeded": "CEO requested email to vendor",
    "whatActionWillBeTaken": "Draft and send email via Gmail",
    "whatHappensWithout": "Vendor doesn't receive update",
    "reversible": true,
    "riskLevel": "medium",
    "ceoBenefit": "Saves CEO manual work"
  },
  "workflowAllowed": true,
  "reason": "All conditions met: CONFIRMED + REQUEST_APPROVAL + justified"
}
```

---

## Common Anti-Patterns (Now Blocked)

| Anti-Pattern | Why It's Blocked | Correct Behavior |
|---|---|---|
| "Sao rồi?" → creates monitoring workflow | REPORT decision, not EXECUTE | Report status only |
| "X done" → creates tracking workflow | ACKNOWLEDGE decision | Acknowledge only |
| "Hả?" → creates investigation workflow | Follow-up input | Context resolution |
| "K" → creates completion workflow | ACKNOWLEDGE decision | Simple acknowledgment |
| Status question → creates dashboard workflow | No explicit CEO order | Report information |
| Ambiguous input → creates "explore" workflow | REQUEST_CLARIFICATION | Ask for clarification |
| "Maybe do X" → creates tentative workflow | No explicit order | REQUEST_CLARIFICATION |

---

## Integration Point

Workflow Threshold Gate runs AFTER Decision Gate:

```
Context Resolution (P0-5)
    ↓
Evidence Gate (P0-1)
    ↓
Decision Gate (P0-2)
    ↓
Workflow Threshold (P0-6) ← HERE
    ↓
Execution Justification Check
    ↓
    (if all 3 conditions met)
    ↓
Workflow Created → Execution Queue
    ↓
    (if any condition fails)
    ↓
No Workflow → Simple Response
```

---

## Regression Prevention

The following system behaviors are now **permanently blocked**:

1. **Automatic workflow generation** from any input type
2. **Workflow creation** without explicit CEO order
3. **Workflow creation** with MISSING or STALE evidence
4. **Workflow creation** for ACKNOWLEDGE or REPORT decisions
5. **Workflow creation** without written justification
6. **Workflow creation** from follow-up/casual inputs

---

## Acceptance Criteria

- [ ] Zero automatic workflows created without justification
- [ ] Zero workflows from ACKNOWLEDGE decisions
- [ ] Zero workflows from REPORT decisions
- [ ] Zero workflows with MISSING evidence
- [ ] Zero workflows from follow-up inputs
- [ ] Every workflow creation logged with justification
- [ ] False action rate ≤ 1%
- [ ] False approval rate ≤ 1%

---

**CERTIFICATION:** WORKFLOW_THRESHOLD_P0_6_IMPLEMENTED
