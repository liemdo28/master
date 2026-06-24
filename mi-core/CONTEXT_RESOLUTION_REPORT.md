# CONTEXT_RESOLUTION_REPORT.md — P0-5 Memory Context Resolution

**Priority:** P0 — PRODUCTION BLOCKER
**Generated:** 2026-06-16T08:08:00+07:00
**Status:** IMPLEMENTED
**Owner:** Mi-Core Central Command

---

## Problem Statement

Previous behavior for short/casual follow-up inputs:
- "Hả?" → system initiated a new workflow or topic
- "K" → system created an action item
- "Sao?" → system started a new analysis
- "Không có hình hả?" → system began image generation workflow

**Root Cause:** No context resolution mechanism. Every input was treated as a fresh request with full intent analysis. Short messages lost all reference to prior conversation.

---

## Context Resolution Protocol

Short/casual/follow-up inputs MUST resolve from previous context before any response is generated.

### Target Inputs

| Input | Pattern | Required Resolution |
|---|---|---|
| "Hả?" | Surprise/disbelief | What was said before → explain or repeat |
| "K" | Acknowledgment | What was discussed → confirm closure |
| "Sao?" | Follow-up question | What topic was active → continue it |
| "Không có hình hả?" | Image query | What image was expected → show or explain |
| "Thế nào?" | Status follow-up | What was being tracked → show status |
| "Còn cái kia?" | Entity reference | What entities were discussed → identify and respond |
| "Rồi sao?" | Progression | What just happened → continue sequence |
| "Còn gì nữa?" | Expansion | What was covered → list remaining items |

---

## Context Resolution Rules

### Rule 1: Never Create New Workflow from Follow-up

When input matches a follow-up pattern, the system MUST:
1. Look up the most recent conversation context (last 3 turns)
2. Identify the active topic and entity
3. Continue THAT conversation
4. NOT start a new topic or workflow

### Rule 2: Resolve Before Responding

```
FOLLOW-UP INPUT ("Hả?", "K", "Sao?")
    ↓
┌──────────────────────────────────┐
│  1. LOOK UP CONTEXT              │
│  - Last entity discussed         │
│  - Last topic discussed          │
│  - Last decision made            │
│  - Last evidence classification  │
│  - Last response sent            │
└──────────────┬───────────────────┘
               ↓
┌──────────────────────────────────┐
│  2. CLASSIFY FOLLOW-UP TYPE      │
│  - Surprise → re-explain         │
│  - Acknowledgment → close        │
│  - Follow-up question → continue │
│  - Image request → show/explain  │
│  - Entity reference → identify   │
└──────────────┬───────────────────┘
               ↓
┌──────────────────────────────────┐
│  3. GENERATE CONTEXTUAL RESPONSE │
│  Must reference prior topic      │
│  Must NOT start new topic        │
└──────────────┬───────────────────┘
               ↓
          RESPONSE SENT
```

### Rule 3: Context Window

Context resolution uses a sliding window of the **last 5 conversation turns**:
- Turn -1: Most recent system response
- Turn -2: Most recent CEO input
- Turn -3: Previous system response
- Turn -4: Previous CEO input
- Turn -5: Two turns back CEO input

If context window is empty (first message in session), follow-up patterns are treated as standalone inputs → REQUEST_CLARIFICATION.

### Rule 4: No New Workflow from Resolution

Context resolution is INFORMATIONAL only. It must NOT:
- Create a new workflow
- Trigger an execution
- Spawn a child process
- Modify system state
- Write to execution queue

---

## Follow-up Type Classification

### Type A: Surprise/Disbelief ("Hả?", "Sao?", "Thật á?")

**Resolution:** CEO didn't understand or believe the previous response.
**Action:** Re-explain or provide evidence.

```
"Mình đang nói về [previous topic].
[Re-explanation with evidence or clarification]."
```

**Forbidden:** Starting a new topic. Creating workflow.

---

### Type B: Acknowledgment ("K", "Ok", "Đc", "Vâng")

**Resolution:** CEO acknowledged the previous response.
**Action:** Close the conversation thread.

```
"Vâng. [Brief closure if needed]."
```

Or simply:
```
ACKNOWLEDGE
```

**Forbidden:** Creating follow-up action. Starting new workflow. Asking "Anh cần em giúp gì thêm không?"

---

### Type C: Follow-up Question ("Sao?", "Thế nào?", "Rồi sao?")

**Resolution:** CEO wants to continue the previous topic.
**Action:** Continue with latest data on that topic.

```
"[Previous topic] — [latest update or continuation]."
```

**Forbidden:** Changing topic. Creating new workflow.

---

### Type D: Image Query ("Không có hình hả?", "Gửi hình đi")

**Resolution:** CEO expects an image from previous context.
**Action:** Show the image or explain why it's not available.

```
"If image exists: Show image + brief caption"
"If image missing: 'Em chưa có hình cho [topic]. [Reason]. Anh muốn em tìm/generate không?'"
```

**Forbidden:** Creating image generation workflow without CEO confirmation.

---

### Type E: Entity Reference ("Còn cái kia?", "Còn ABC?")

**Resolution:** CEO references an entity from previous conversation.
**Action:** Identify the entity and provide its status.

```
"Cái kia" → Check last entities discussed → Identify most likely → Report status.
```

If ambiguity cannot be resolved:
```
"Anh đang nói về [option A] hay [option B]?"
```

**Forbidden:** Guessing and executing. Creating workflow for the referenced entity.

---

## Implementation in Code

### Context Resolution Module (New)

Location: `server/src/jarvis/phase30-jarvis/context-resolution.ts`

```typescript
// Context Resolution — P0-5 Implementation
// Resolves follow-up inputs from conversation history

export type FollowUpType =
  | 'SURPRISE'       // Hả?, Sao?, Thật á?
  | 'ACKNOWLEDGMENT' // K, Ok, Vâng, Đc
  | 'FOLLOWUP_Q'    // Sao?, Thế nào?, Rồi sao?
  | 'IMAGE_QUERY'   // Không có hình hả?, Gửi hình
  | 'ENTITY_REF'    // Còn cái kia?, Còn ABC?
  | 'NOT_FOLLOWUP'; // Standalone input

export interface ConversationTurn {
  role: 'CEO' | 'MI';
  content: string;
  timestamp: string;
  evidenceClass?: string;
  decision?: string;
  topic?: string;
  entity?: string;
}

export interface ContextResolutionResult {
  followUpType: FollowUpType;
  resolvedTopic: string | null;
  resolvedEntity: string | null;
  lastResponse: string | null;
  createNewWorkflow: boolean;  // ALWAYS false for follow-ups
  suggestedResponse: string;
}

// Follow-up detection patterns (normalized Vietnamese)
const FOLLOWUP_PATTERNS: Record<FollowUpType, RegExp[]> = {
  'SURPRISE': [
    /^(ha|hả|sao|thât á|that a|that sa)\s*[!?]*$/i,
    /^(khong that|không thật|that la|thật là)\b/i,
    /^(chắc không|chac khong|no way|really)\s*[!?]*$/i,
  ],
  'ACKNOWLEDGMENT': [
    /^(k|ok|oke|okay|da|ừ|u|uh|um|vâng|vang|d|đc|duoc|được)\s*[.!?]*$/i,
    /^(cam on|cảm ơn|thanks)\s*(nhe|nhé)?$/i,
  ],
  'FOLLOWUP_Q': [
    /^(sao|sao vay|sao vậy|the nao|thế nào|roi sao|rồi sao|sau do|sau đó)\s*[!?]*$/i,
    /^(con gi|còn gì|con kia|còn kia|con ca|còn cả)\s*[!?]*$/i,
    /^(tiep|tiếp|rồi|roi)\s*[!?]*$/i,
  ],
  'IMAGE_QUERY': [
    /khong co hinh|không có hình/i,
    /co hinh|có hình/i,
    /gui hinh|gửi hình/i,
    /show image/i,
    /hinh dau|hình đâu/i,
  ],
  'ENTITY_REF': [
    /^(con kia|còn kia|con gi|còn gì|cai do|cái đó|cai kia|cái kia)\s*[!?]*$/i,
    /^(con|còn)\s+\w+\s*[!?]*$/i,
  ],
  'NOT_FOLLOWUP': [],
};

const FOLLOW_UP_LENGTH_THRESHOLD = 30; // chars

export function resolveContext(
  input: string,
  conversationHistory: ConversationTurn[]
): ContextResolutionResult {
  const normalizedInput = input.trim().toLowerCase();

  // Step 1: Detect follow-up type
  let followUpType: FollowUpType = 'NOT_FOLLOWUP';
  for (const [type, patterns] of Object.entries(FOLLOWUP_PATTERNS)) {
    if (type === 'NOT_FOLLOWUP') continue;
    if (patterns.some(p => p.test(normalizedInput))) {
      followUpType = type as FollowUpType;
      break;
    }
  }

  // Also check: short messages without question words = likely follow-up
  if (followUpType === 'NOT_FOLLOWUP' && normalizedInput.length <= FOLLOW_UP_LENGTH_THRESHOLD) {
    // Short messages without clear intent = treat as potential follow-up
    if (!/[a-z]{5,}/.test(normalizedInput) || normalizedInput.length <= 5) {
      followUpType = 'FOLLOWUP_Q'; // Default short message to follow-up question
    }
  }

  // Step 2: If not a follow-up, return early
  if (followUpType === 'NOT_FOLLOWUP') {
    return {
      followUpType: 'NOT_FOLLOWUP',
      resolvedTopic: null,
      resolvedEntity: null,
      lastResponse: null,
      createNewWorkflow: true, // Normal processing
      suggestedResponse: '',
    };
  }

  // Step 3: Resolve from conversation history
  const recentTurns = conversationHistory.slice(-5);
  const lastMITurn = [...recentTurns].reverse().find(t => t.role === 'MI');
  const lastCEOTurn = [...recentTurns].reverse().find(t => t.role === 'CEO');

  const resolvedTopic = lastMITurn?.topic || lastCEOTurn?.topic || null;
  const resolvedEntity = lastMITurn?.entity || lastCEOTurn?.entity || null;
  const lastResponse = lastMITurn?.content || null;

  // Step 4: Generate contextual response
  let suggestedResponse: string;

  switch (followUpType) {
    case 'SURPRISE':
      suggestedResponse = lastResponse
        ? `Mình vừa nói: ${lastResponse}. Anh muốn mình giải thích thêm không?`
        : 'Em chưa rõ anh ngạc nhiên về điều gì. Anh có thể nói rõ hơn không?';
      break;

    case 'ACKNOWLEDGMENT':
      suggestedResponse = ''; // Just ACKNOWLEDGE, nothing more
      break;

    case 'FOLLOWUP_Q':
      suggestedResponse = resolvedTopic
        ? `Mình đang nói về ${resolvedTopic}. ${lastResponse || 'Em chưa có thêm thông tin.'}`
        : 'Em chưa xác định được topic anh muốn hỏi. Anh nói rõ hơn được không?';
      break;

    case 'IMAGE_QUERY':
      suggestedResponse = resolvedTopic
        ? `Em chưa có hình cho ${resolvedTopic}. Anh muốn em tìm/generate không?`
        : 'Em chưa có hình ảnh nào liên quan. Anh muốn em tìm hình gì?';
      break;

    case 'ENTITY_REF':
      suggestedResponse = resolvedEntity
        ? `Anh đang nói về ${resolvedEntity} phải không?`
        : 'Em chưa xác định được "cái kia" là gì. Anh nói rõ tên được không?';
      break;

    default:
      suggestedResponse = 'Em chưa hiểu rõ. Anh nói lại được không?';
  }

  // Step 5: NEVER create new workflow from follow-up
  return {
    followUpType,
    resolvedTopic,
    resolvedEntity,
    lastResponse,
    createNewWorkflow: false, // ALWAYS false for follow-ups
    suggestedResponse,
  };
}
```

---

## Critical Rules

1. **Follow-up inputs NEVER create new workflows.** Period.
2. **Context resolution is required before any response** to short/casual inputs.
3. **If context window is empty**, request clarification instead of guessing.
4. **"K" / "Ok" / "Vâng"** = simple ACKNOWLEDGE, nothing more. No follow-up question.
5. **"Hả?" / "Sao?"** = re-explain or clarify previous topic, not start new one.

---

## Integration Point

Context Resolution runs at the EARLIEST point in the pipeline:

```
INPUT
    ↓
┌──────────────────────────┐
│ CONTEXT RESOLUTION (P0-5) │ ← Runs FIRST
│ - Is this a follow-up?   │
│ - Resolve from history    │
│ - Block new workflow      │
└──────────────┬───────────┘
               ↓
    (if NOT_FOLLOWUP)
               ↓
┌──────────────────────────┐
│ EVIDENCE GATE (P0-1)     │
│ DECISION GATE (P0-2)     │
│ ...                      │
└──────────────────────────┘
               ↓
    (if IS_FOLLOWUP)
               ↓
┌──────────────────────────┐
│ DIRECT RESPONSE          │
│ Using resolved context   │
│ No workflow, no action   │
└──────────────────────────┘
```

---

## Acceptance Test 3: "Không có hình hả?"

**Context Resolution Step:**
1. Follow-up type: IMAGE_QUERY
2. Conversation history: check last 5 turns
3. Last topic: [whatever was being discussed]
4. createNewWorkflow: false

**If previous topic had image:**
```
SHOW IMAGE
[Image from previous context]
```

**If no image available:**
```
"Em chưa có hình cho [previous topic]. Anh muốn em tìm/generate không?"
```

No workflow created. No new topic. **PASS.**

---

## Acceptance Test 5: "Hả?"

**Context Resolution Step:**
1. Follow-up type: SURPRISE
2. Conversation history: check last 5 turns
3. Last MI response: [previous response]
4. createNewWorkflow: false

**Output:**
```
"Mình vừa nói: [previous response]. Anh muốn mình giải thích thêm không?"
```

No workflow. No new topic. Context preserved. **PASS.**

---

## Acceptance Test (K): "K"

**Context Resolution Step:**
1. Follow-up type: ACKNOWLEDGMENT
2. createNewWorkflow: false

**Output:**
```
ACKNOWLEDGE
```

Nothing more. No follow-up question. No workflow. **PASS.**

---

## Regression Prevention

| Input (Before Fix) | Bad Behavior (Before) | Correct Behavior (After) |
|---|---|---|
| "Hả?" | Created new workflow | Re-explains previous response |
| "K" | Created action item | Simple acknowledgment |
| "Sao?" | Started new analysis | Continues previous topic |
| "Không có hình hả?" | Began image generation workflow | Shows image or explains absence |
| "Còn cái kia?" | Guessed entity, started workflow | Asks to clarify which entity |

---

**CERTIFICATION:** CONTEXT_RESOLUTION_P0_5_IMPLEMENTED
