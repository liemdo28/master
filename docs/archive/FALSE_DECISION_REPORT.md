# FALSE DECISION REPORT

**Generated:** 2026-06-16T07:33:00+07:00
**Purpose:** Catalog every class of false/wrong decision Mi produces after reading source
**Verdict:** 5 FALSE DECISION PATTERNS IDENTIFIED — ALL ACTIONABLE

---

## What Is a False Decision?

A **false decision** is when Mi reads the correct source, gets the correct data, but produces the wrong output action. This is NOT a data problem. This is NOT a source selection problem. This is a **reasoning-to-action mapping failure**.

---

## False Decision #1: ACTION CREATION INSTEAD OF STATE CONFIRMATION

### Trigger Input
> "QB Report của chúng anh đã hoàn thành rồi mà"

### What the Source Says
`qb-agent.db` shows the QB report task. The CEO is telling Mi the task is done.

### What Mi Should Do
1. Query task state in `qb-agent.db`
2. If state = completed → confirm to CEO: "OK, em xác nhận QB Report đã xong."
3. If state = in-progress → update to completed, confirm.
4. If CEO is just informing → acknowledge and update dashboard if needed.

### What Mi Actually Does
- Creates an **approval workflow** (APPR-*)
- Sends a full dashboard summary
- Launches a review process

### Why This Is Wrong
The CEO is not asking Mi to *do* something. The CEO is telling Mi that something *is done*. The correct response is acknowledgment, not action. Creating an approval for a completed task is circular and wasteful.

### Classification
| Attribute | Value |
|-----------|-------|
| Type | False Action Creation |
| Severity | HIGH |
| CEO Experience | "I told you it's done, why are you creating more work?" |
| Frequency | Common — occurs on any "done" or "completed" message |

### Required Fix
Add `STATE_CONFIRMATION` to the decision router:
```
IF CEO_intent = task_complete OR status_update
  AND source confirms task_state = completed
  THEN action = ACKNOWLEDGE_ONLY
  ELSE action = UPDATE_STATE + CONFIRM
```

---

## False Decision #2: WORKFLOW LAUNCH INSTEAD OF CONTEXT UPDATE

### Trigger Input
> "Payroll Raw là tuần rồi"

### What the Source Says
The CEO is updating Mi's context — "payroll was last week." This is a factual statement that modifies the timeline for payroll-related queries.

### What Mi Should Do
1. Store the temporal context: `payroll_period = "last_week"`
2. Update conversation memory with this fact.
3. Acknowledge: "OK, em ghi nhận payroll là tuần trước."
4. Use this context in future payroll-related queries.

### What Mi Actually Does
- Starts a **payroll workflow** (a new process)
- Launches a **checklist** for payroll tasks
- Sends a payroll status report

### Why This Is Wrong
The CEO is providing context, not issuing a command. "Payroll là tuần rồi" is information, not a request. Starting a workflow when receiving information is the equivalent of opening a new JIRA ticket when someone tells you "the meeting was yesterday."

### Classification
| Attribute | Value |
|-----------|-------|
| Type | False Workflow Launch |
| Severity | HIGH |
| CEO Experience | "I'm telling you when it happened, not asking you to do payroll again" |
| Frequency | Moderate — occurs on temporal context statements |

### Required Fix
Add `CONTEXT_UPDATE` to the decision router:
```
IF CEO_intent = context_update
  AND content contains temporal/factual correction
  THEN action = STORE_CONTEXT + ACKNOWLEDGE
  NOT: action = start_workflow
```

---

## False Decision #3: FALSE COMPLETION CLAIM WITHOUT EVIDENCE

### Trigger Input
> "Post bài lên Raw"

### What the Source Says
The SEO content pipeline was triggered. The pipeline *claims* it generated images. But no `existsSync()` check was performed on the output files.

### What Mi Should Do
1. Trigger image generation.
2. **Verify** output files exist: `existsSync(featured)`, `existsSync(og)`, `existsSync(social)`.
3. If all 3 exist → send image evidence + request approval.
4. If any missing → report failure, don't claim completion.

### What Mi Actually Does
- Reports "image ready" ✅
- Reports "featured image ready" ✅
- But the image file may **not actually exist on disk**
- Sends text confirmation without sending the actual image

### Why This Is Wrong
Saying "image ready" without verifying the file exists is lying. This is the most dangerous false decision because it erodes CEO trust. When CEO checks and the image isn't there, Mi's credibility drops to zero.

### Classification
| Attribute | Value |
|-----------|-------|
| Type | False Evidence Claim |
| Severity | **CRITICAL** |
| CEO Experience | "You said the image is ready but there's no image!" |
| Frequency | Occurs on every content publishing flow without verification |

### Required Fix
Mandatory evidence gate before any "ready" claim:
```
BEFORE responding "image ready":
  ASSERT existsSync(featured_image_path)
  ASSERT existsSync(og_image_path)
  ASSERT existsSync(social_preview_path)
  IF ANY ASSERTION FAILS:
    RESPOND "Image generation failed — [filename] not found"
    DO NOT claim completion
```

---

## False Decision #4: HALLUCINATED NUMBERS WHEN SOURCE IS STALE

### Trigger Input
> "Raw doanh thu sao rồi"

### What the Source Says
The finance truth layer queries: QuickBooks (stale/degraded) → Accounting (unavailable) → Finance Cache (last update >24h ago). Status = `stale`. The actual current revenue number is unknown.

### What Mi Should Do
1. Query all 3 sources.
2. Report the data WITH its freshness status:
   - "QuickBooks data từ 2 ngày trước: $X. Data chưa sync mới nhất."
   - OR "Data hiện tại không khả dụng. Em cần sync QB."
3. **NEVER** generate a number that isn't in the source.

### What Mi Actually Does
- Reports a revenue number
- The number may be from stale cache or entirely fabricated by the LLM
- No freshness disclaimer included
- CEO believes this is current data

### Why This Is Wrong
A wrong number presented as current truth is worse than no number. The CEO might make business decisions based on fabricated data. The finance truth layer exists specifically to prevent this — but the LLM override bypasses it.

### Classification
| Attribute | Value |
|-----------|-------|
| Type | Hallucinated Financial Data |
| Severity | **CRITICAL** |
| CEO Experience | "That revenue number doesn't match what I see in QB" |
| Frequency | Occurs whenever QB data is stale or connector is degraded |

### Required Fix
Hard gate in response construction:
```
IF finance_truth.status = "stale" OR "unavailable" OR "degraded":
  response = "[actual numbers from cache if any]"
  response += "\n⚠️ Data từ [timestamp], chưa sync mới nhất."
  response += "\nSố liệu hiện tại có thể chưa chính xác."
  DO NOT: let LLM fill in "reasonable" numbers
```

---

## False Decision #5: CONTEXT LOSS ON AMBIGUOUS INPUT

### Trigger Input
> "Hả?" / "Không có hình hả?" / "Cái đó sao rồi?"

### What the Source Says
These are continuation references. "Hả?" = "what?" / "huh?" — asking for clarification or expressing confusion. "Không có hình hả?" = "there's no image?" — referencing the image discussion. "Cái đó sao rồi?" = "what happened with that thing?" — referencing whatever was being discussed.

### What Mi Should Do
1. Load conversation history (last 3-5 messages).
2. Identify the antecedent of the reference.
3. Resolve: "Hả?" → clarify what was just said. "Không có hình hả?" → check image status. "Cái đó sao rồi?" → report status of last topic.
4. Continue the conversation thread.

### What Mi Actually Does
- Interprets ambiguous input as a new intent
- Starts a new workflow
- Sends a dashboard summary (completely unrelated)
- Loses the entire conversation thread

### Why This Is Wrong
Every human conversation involves ambiguous references. "What?" and "how about that thing?" are normal follow-ups. Mi's inability to resolve these means every conversation resets to zero after any ambiguous message. The CEO has to re-explain context every time.

### Classification
| Attribute | Value |
|-----------|-------|
| Type | Context Resolution Failure |
| Severity | HIGH |
| CEO Experience | "I was asking about the thing we were just talking about, not starting over" |
| Frequency | Every conversation with any ambiguity |

### Required Fix
Add `context_resolve` intent and resolution logic:
```
IF intent = ambiguous_followup:
  context = loadConversationHistory(last=5)
  antecedent = resolveReference(ambiguous_input, context)
  IF antecedent found:
    CONTINUE topic from antecedent
  ELSE:
    ASK CEO for clarification: "Em đang nói về cái nào?"
```

---

## False Decision Summary

| # | False Decision Type | Severity | Fix Complexity | Priority |
|---|--------------------|----------|---------------|----|
| 1 | Action creation instead of state confirmation | HIGH | Medium | P1 |
| 2 | Workflow launch instead of context update | HIGH | Medium | P1 |
| 3 | False completion claim without evidence | CRITICAL | Low (add existsSync) | P0 |
| 4 | Hallucinated numbers when source is stale | CRITICAL | Low (add gate) | P0 |
| 5 | Context loss on ambiguous input | HIGH | High (new intent + history) | P1 |

---

## Impact on CEO Trust

```
FALSE DECISION #3 (no image)     → CEO stops trusting "ready" claims
FALSE DECISION #4 (fake numbers) → CEO stops trusting financial reports
FALSE DECISION #1 (extra actions) → CEO feels Mi is creating busywork
FALSE DECISION #2 (wrong workflow) → CEO stops giving contextual info
FALSE DECISION #5 (context loss)  → CEO stops asking follow-up questions

Combined effect: CEO learns to bypass Mi and do things manually
```

This is the existential risk. Every false decision teaches the CEO that Mi is unreliable. Five false decisions in the core interaction patterns mean the CEO will eventually stop using Mi for anything consequential.

---

## Remediation Priority

### Immediate (P0) — This Sprint
1. Add `existsSync()` evidence gate before any "ready" claim
2. Add stale-data gate before any financial number in response
3. Both fixes are under 50 lines of code each

### Short-term (P1) — Next Sprint
4. Add `ACKNOWLEDGE_ONLY` decision path
5. Add `CONTEXT_UPDATE` decision path

### Medium-term (P2) — Architecture Improvement
6. Add `context_resolve` intent with conversation history lookup
7. Add evidence verification middleware to response pipeline
