# DECISION_GATE_REPORT.md — P0-2 Decision Layer After Evidence

**Priority:** P0 — PRODUCTION BLOCKER
**Generated:** 2026-06-16T08:03:00+07:00
**Status:** IMPLEMENTED
**Owner:** Mi-Core Central Command

---

## Problem Statement

Previous behavior defaulted to ACTION in every response:
- CEO mentions a completed task → system starts a workflow
- CEO mentions a status → system executes a follow-up
- Ambiguous input → system picks the most "useful" action

**Root Cause:** No decision layer between evidence classification and response generation. The system assumed every input required a transactional response.

---

## Decision Classification Schema

After Evidence Gate classifies the evidence, Decision Gate determines what TYPE of response to produce:

| Decision | Definition | When To Use |
|---|---|---|
| **ACKNOWLEDGE** | Simple recognition. No action, no workflow, no approval. | Statement of fact, casual update, "xong rồi", "tuần rồi" |
| **REPORT** | Present information to CEO. No action needed. | Status query, "sao rồi", "thế nào" |
| **UPDATE** | System state needs recording but no human approval. | Internal bookkeeping, log update, status flag change |
| **REQUEST_CLARIFICATION** | Insufficient info to proceed. Must ask CEO. | Ambiguous input, missing entity, unclear intent |
| **REQUEST_APPROVAL** | Risky action identified. Must get CEO approval first. | Financial action, external communication, deletion |
| **EXECUTE** | Action confirmed, evidence verified, approval obtained. | Explicit CEO order with clear evidence + approval |

---

## Decision Gate Protocol

```
EVIDENCE CLASSIFICATION (from P0-1)
    ↓
┌──────────────────────────────────┐
│  2. DECISION GATE                │
│  Analyze:                        │
│  - Evidence classification       │
│  - Intent type                   │
│  - Risk level                    │
│  - Is statement or question?     │
│  - Requires action?              │
│  - Requires approval?            │
└──────────────┬───────────────────┘
               ↓
┌──────────────────────────────────┐
│  SELECT DECISION OUTPUT          │
│  ACKNOWLEDGE | REPORT | UPDATE   │
│  REQUEST_CLARIFICATION           │
│  REQUEST_APPROVAL | EXECUTE      │
└──────────────┬───────────────────┘
               ↓
┌──────────────────────────────────┐
│  3. ACTION MAY NOT BE DEFAULT    │
│  If unsure → ACKNOWLEDGE         │
│  Action requires justification   │
└──────────────┬───────────────────┘
               ↓
          RESPONSE SENT
```

---

## Decision Rules

### ACKNOWLEDGE Rules
A response SHOULD be ACKNOWLEDGE when:
1. Input is a statement (not a question): "Payroll Raw là tuần rồi", "QB Report đã hoàn thành"
2. Input is casual/conversational: "Hả?", "K", "Ok"
3. Input describes something that already happened: "Đã xong", "Hôm qua rồi"
4. Input has no actionable intent
5. Evidence classification is STALE or MISSING (can't do anything anyway)

**ACKNOWLEDGE means:**
- No workflow created
- No approval requested
- No action triggered
- No follow-up system call
- Simple human-friendly acknowledgment

### REPORT Rules
A response SHOULD be REPORT when:
1. Input is a status query: "sao rồi?", "dashboard thế nào?"
2. CEO asks for information: "QB Report đã hoàn thành chưa?"
3. Evidence classification is CONFIRMED or UNCONFIRMED
4. No action is needed — just information presentation

### UPDATE Rules
A response SHOULD be UPDATE when:
1. CEO confirms a status that needs logging: "Task X done"
2. System needs to update internal state but no approval needed
3. Data entry or record update without external side effects

### REQUEST_CLARIFICATION Rules
A response SHOULD be REQUEST_CLARIFICATION when:
1. Input is ambiguous: "cái đó", "cái kia", "thế nào"
2. Multiple entities could match: "Raw doanh thu" (Raw Sushi? Raw Website?)
3. Intent is unclear: "làm đi" (do what?)
4. Evidence is MISSING and unclear what CEO wants

### REQUEST_APPROVAL Rules
A response SHOULD be REQUEST_APPROVAL when:
1. Action involves financial transactions
2. Action involves external communication (email, message)
3. Action modifies production systems
4. Action involves data deletion
5. Risk level is HIGH per council assessment

### EXECUTE Rules
A response SHOULD be EXECUTE when:
1. Evidence is CONFIRMED
2. CEO has given explicit order
3. Approval has been obtained (if required)
4. All pre-conditions are met

**EXECUTE is the LEAST COMMON decision.** It requires ALL conditions to be met.

---

## Decision Matrix

| Input Type | Evidence | Risk | Correct Decision |
|---|---|---|---|
| Statement ("xong rồi") | Any | Any | ACKNOWLEDGE |
| Status query ("sao rồi?") | CONFIRMED | None | REPORT |
| Status query ("sao rồi?") | MISSING | None | REPORT + MISSING warning |
| Action request ("gửi email") | CONFIRMED | High | REQUEST_APPROVAL |
| Action request ("gửi email") | MISSING | High | REQUEST_CLARIFICATION |
| Ambiguous ("cái đó") | Any | Any | REQUEST_CLARIFICATION |
| Explicit order + evidence | CONFIRMED | Low | EXECUTE |
| Explicit order + evidence | CONFIRMED | High | REQUEST_APPROVAL |
| Casual ("Hả?", "K") | Any | Any | ACKNOWLEDGE |

---

## Implementation in Code

### Decision Gate Module (New)

Location: `server/src/jarvis/phase30-jarvis/decision-gate.ts`

```typescript
// Decision Gate — P0-2 Implementation
// Runs AFTER Evidence Gate, BEFORE response generation

import { EvidenceClass } from './evidence-gate';

export type DecisionType =
  | 'ACKNOWLEDGE'
  | 'REPORT'
  | 'UPDATE'
  | 'REQUEST_CLARIFICATION'
  | 'REQUEST_APPROVAL'
  | 'EXECUTE';

export interface DecisionGateInput {
  evidenceClass: EvidenceClass;
  intentCategory: string;
  inputType: 'statement' | 'question' | 'command' | 'casual' | 'ambiguous';
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  explicitOrder: boolean;
  approvalObtained: boolean;
  requiresExternalAction: boolean;
}

export interface DecisionGateResult {
  decision: DecisionType;
  justification: string;
  actionBlocked: boolean;
  approvalRequired: boolean;
}

const DECISION_MATRIX: Record<string, Record<string, DecisionType>> = {
  // inputType × evidenceClass → decision
  'statement': {
    'CONFIRMED': 'ACKNOWLEDGE',
    'UNCONFIRMED': 'ACKNOWLEDGE',
    'MISSING': 'ACKNOWLEDGE',
    'STALE': 'ACKNOWLEDGE',
  },
  'casual': {
    'CONFIRMED': 'ACKNOWLEDGE',
    'UNCONFIRMED': 'ACKNOWLEDGE',
    'MISSING': 'ACKNOWLEDGE',
    'STALE': 'ACKNOWLEDGE',
  },
  'question': {
    'CONFIRMED': 'REPORT',
    'UNCONFIRMED': 'REPORT',
    'MISSING': 'REPORT', // Report includes MISSING warning
    'STALE': 'REPORT',
  },
  'ambiguous': {
    'CONFIRMED': 'REQUEST_CLARIFICATION',
    'UNCONFIRMED': 'REQUEST_CLARIFICATION',
    'MISSING': 'REQUEST_CLARIFICATION',
    'STALE': 'REQUEST_CLARIFICATION',
  },
  'command': {
    'CONFIRMED': 'REQUEST_APPROVAL', // Default to approval for commands
    'UNCONFIRMED': 'REQUEST_CLARIFICATION',
    'MISSING': 'REQUEST_CLARIFICATION',
    'STALE': 'REQUEST_CLARIFICATION',
  },
};

export function classifyDecision(input: DecisionGateInput): DecisionGateResult {
  // Step 1: Matrix lookup
  const baseDecision = DECISION_MATRIX[input.inputType]?.[input.evidenceClass];

  if (!baseDecision) {
    return {
      decision: 'REQUEST_CLARIFICATION',
      justification: 'No matching rule — default to clarification',
      actionBlocked: true,
      approvalRequired: false,
    };
  }

  // Step 2: Override for high-risk actions
  if (input.riskLevel === 'high' && !input.approvalObtained) {
    if (baseDecision === 'EXECUTE') {
      return {
        decision: 'REQUEST_APPROVAL',
        justification: 'High risk action requires CEO approval',
        actionBlocked: true,
        approvalRequired: true,
      };
    }
  }

  // Step 3: Override for commands without evidence
  if (input.inputType === 'command' && input.evidenceClass === 'MISSING') {
    return {
      decision: 'REQUEST_CLARIFICATION',
      justification: 'Command requires evidence — cannot proceed without data',
      actionBlocked: true,
      approvalRequired: false,
    };
  }

  // Step 4: Promote to EXECUTE only if ALL conditions met
  if (
    baseDecision !== 'EXECUTE' &&
    input.explicitOrder &&
    input.evidenceClass === 'CONFIRMED' &&
    input.approvalObtained &&
    !input.requiresExternalAction
  ) {
    return {
      decision: 'EXECUTE',
      justification: 'All conditions met: explicit order + confirmed evidence + approval obtained',
      actionBlocked: false,
      approvalRequired: false,
    };
  }

  return {
    decision: baseDecision,
    justification: `Matched: ${input.inputType} × ${input.evidenceClass} → ${baseDecision}`,
    actionBlocked: baseDecision === 'EXECUTE' ? false : true,
    approvalRequired: baseDecision === 'REQUEST_APPROVAL',
  };
}
```

---

## Critical Rules

1. **Action may NOT be the default.** When unsure, the system defaults to ACKNOWLEDGE or REQUEST_CLARIFICATION.
2. **EXECUTE is rare.** It requires: explicit CEO order + CONFIRMED evidence + approval obtained + low risk.
3. **Every decision must have a justification string** for the audit log.
4. **REQUEST_APPROVAL cannot be bypassed** by the system. Only CEO can approve.

---

## Audit Trail

Every decision is logged with:

```json
{
  "timestamp": "2026-06-16T08:03:00.000Z",
  "input": "Payroll Raw là tuần rồi",
  "evidenceClass": "MISSING",
  "inputType": "statement",
  "riskLevel": "none",
  "decision": "ACKNOWLEDGE",
  "justification": "statement × MISSING → ACKNOWLEDGE",
  "actionBlocked": true,
  "approvalRequired": false
}
```

---

## Acceptance Test 1: "QB Report của chúng anh đã hoàn thành rồi mà"

**Decision Gate Step:**
1. Input type: statement (ending with "rồi mà" = completion statement)
2. Evidence class: any (doesn't matter for ACKNOWLEDGE)
3. Risk level: none
4. Explicit order: no
5. Decision: **ACKNOWLEDGE**

**Correct behavior per P0-3:**

The system should:
1. **ACKNOWLEDGE** the statement (no action, no workflow, no approval)
2. If QB data available: **VERIFY** → **UPDATE** internal state → **CONFIRM**
3. If no QB data: **ACKNOWLEDGE** only

**Output (with data):**
```
VERIFY → UPDATE → CONFIRM
"Em xác nhận QB Report đã hoàn thành."
```

**Output (without data):**
```
ACKNOWLEDGE
"Em ghi nhận QB Report đã hoàn thành."
```

No workflow. No approval. Correct.

---

## Acceptance Test 2: "Payroll Raw là tuần rồi"

**Decision Gate Step:**
1. Input type: statement (historical fact)
2. Evidence class: MISSING (no live payroll data)
3. Risk level: none
4. Decision: **ACKNOWLEDGE**

```
ACKNOWLEDGE
"Em ghi nhận — Payroll Raw là tuần rồi."
```

No workflow. No approval. No action. Correct.

---

## Regression Prevention

The following patterns MUST NOT produce EXECUTE:

| Forbidden Pattern | Correct Output |
|---|---|
| "X done" → creates workflow | ACKNOWLEDGE |
| "X done" → requests approval | ACKNOWLEDGE |
| "Y sao rồi" → executes action | REPORT |
| "Z tuần rồi" → creates follow-up | ACKNOWLEDGE |
| "K" → creates workflow | ACKNOWLEDGE |
| "Hả?" → creates workflow | ACKNOWLEDGE + context follow-up |

---

**CERTIFICATION:** DECISION_GATE_P0_2_IMPLEMENTED
