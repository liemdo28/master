# Semantic Workflow Routing Proof (Blocker #2)

Date: 2026-06-28 · Layer: `mi-core/server/src/workflow-intelligence/` · Test: `node mi-core/tests/semantic-workflow-routing-test.mjs` → **21/21 PASS** · Evidence: `evidence/workflow-intelligence/raw-sushi-revenue-10.json`

## What changed
PR #25 blocker #2 was "workflow orchestration exists, but **semantic routing + OSS-worker selection are pending**." This adds a semantic workflow brain (11 modules):

| Module | Responsibility |
|---|---|
| `semantic-objective-classifier.ts` | weighted concept lexicons → ranked domain + confidence |
| `business-intent-parser.ts` | action / entity / metric / magnitude / direction / intent type |
| `division-router.ts` | route by **classified concept** (not raw keyword) |
| `oss-worker-selector.ts` | bridge each step to a Part A1 OSS worker (health + fallback) |
| `human-agent-selector.ts` | accountable owner per division |
| `duplicate-task-resolver.ts` | reuse the proven coordination dedup detector |
| `dependency-planner.ts` | topological order + cycle check |
| `approval-policy-selector.ts` | auto / standard / production-token gate |
| `evidence-plan-builder.ts` | required evidence per step |
| `semantic-workflow-orchestrator.ts` | one objective → full intelligent plan |
| `index.ts` | public surface |

## Runtime scenario: "Increase Raw Sushi online revenue 10%"
Produced end-to-end (evidence JSON attached):

```
objective         → "Increase Raw Sushi online revenue 10%"
business intent   → action=increase, entity=raw sushi, metric=revenue, magnitude=10%, type=growth
classification    → primary domain revenue/marketing (confidence scored)
division routes   → revenue→finance, marketing→marketing, marketing→marketing, creative→creative, revenue→finance
OSS workers       → one governed worker per step (PostHog/Metabase/ComfyUI/... via A1; status CONFIGURED_NOT_INSTALLED, fallback in-engine)
tasks             → WF-01..WF-05 with chained dependencies
duplicate check   → injected duplicate detected + avoided (1 merged)
dependency graph  → topological order, no cycle, baseline before action
approval policy   → analysis steps auto; "Launch …" step → production_token (Phase 2D+)
evidence plan     → per-step required evidence type
executive report  → stepCount, humanApprovals, ossWorkersSelected, topDomain
learning hook     → outcome feeds Phase 12 (agent-os/12)
```

## Proven (21/21)
intent detected ✅ · semantic division route ✅ · **OSS workers selected per step** ✅ · duplicate avoided ✅ · dependency graph (ordered, acyclic) ✅ · approval policy selected (launch is production-gated) ✅ · evidence plan ✅ · executive report ✅ · Phase 12 learning hook ✅

## Honest scope
- Semantic routing is concept-lexicon scored (deterministic), a real upgrade over raw-keyword routing — **not** an LLM. The governed NLP/agent OSS (LangGraph etc.) is the optional substrate via Part A1.
- OSS-worker selection is **real** (runs through the A1 runtime layer), but workers are `CONFIGURED_NOT_INSTALLED` here, so steps execute on the in-engine fallback — honestly reported per step.
- The "Launch" step is correctly **not** auto-run: it requires a Phase 2D+ production token (safety invariant upheld).

**Verdict: WORKFLOW_INTELLIGENCE = semantic routing + OSS-worker selection NOW REAL (21/21). Blocker #2 mechanism closed; full autonomy still gated by human approval by design.**
