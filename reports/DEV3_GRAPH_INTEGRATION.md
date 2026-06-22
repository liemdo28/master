# Dev3 Graph Integration
**Phase 14.7 — Advisory Context Layer**
**Status: PRODUCTION — Non-Breaking**

---

## Integration Principle

The Graph Intelligence layer is **advisory-only**. It enriches the CEO's decision context without modifying any existing Dev3 contract.

**Protected contracts (untouched):**
- `/api/execution-package` request/response schema
- Dev3 Role Engine (`role-engine.ts`)
- Dev3 Skill Engine (`dynamic-skill-selector.ts` — except the trust score integration from Phase 12, which was a separate phase)
- Dev3 Approval Engine (`gate.ts`)

---

## Integration Point: `graph-execution-context.ts`

```typescript
// Advisory — called by CEO-facing layers only, never by execution engine
export function buildGraphContext(targetProject?: string): GraphExecutionContext
```

### Output Shape

```typescript
interface GraphExecutionContext {
  project_id: string | null;
  project_name: string | null;
  ownership: OwnershipInfo | null;
  dependencies: DependencyTree | null;
  impact: ImpactAnalysis | null;
  risk_chain: {
    blast_radius: number;
    overall_risk_score: number;
    ceo_alert_required: boolean;
    remediation_steps: string[];
  } | null;
  advisory: string[];     // human-readable notes for CEO
}
```

### Advisory Notes Generated

| Condition | Note |
|-----------|------|
| No owner assigned | `⚠️ No owner assigned — escalate to CEO directly` |
| Severity CRITICAL | `🚨 CRITICAL impact — N dependent systems` |
| Severity HIGH | `⚠️ HIGH impact entity` |
| CEO alert required | `📣 CEO alert required (blast radius: N)` |
| Direct project impacts | `🔗 Directly impacts: A, B, C` |

---

## How Dev3 Uses It

The advisory context is available as an opt-in enrichment for the GStack orchestrator response. It is added to the `GStackResponse` as `graph_advisory` — a side-channel that the CEO can read but that does not affect routing, approval, or execution decisions.

```typescript
// In gstack-orchestrator.ts (advisory field only — does not alter verdict/routing)
const graphCtx = buildGraphContext(detectedProject);
return {
  ...pipelineResult,
  graph_advisory: graphCtx.advisory,   // advisory notes only
};
```

**What the integration does NOT do:**
- Does not gate or block execution based on graph data
- Does not modify `verdict`, `approved`, or `ceo_message`
- Does not change skill selection or role assignment
- Does not write to the graph (read-only at runtime)

---

## Boot Sequence

`graph-router.ts` calls `seedGraph()` on import. `seedGraph()` is idempotent — entities already in the DB are updated in-place, so running it twice produces no duplicates.

```
[Mi] Boot
  → index.ts imports graph-router
  → graph-router imports graph-seed
  → seedGraph() runs
  → 17 entities, 28 edges confirmed in graph.db
  → /api/graph/* routes registered
```

---

## File Location

```
mi-core/server/src/graph/
└── graph-execution-context.ts   ← integration boundary
```

Entry in `index.ts`:
```typescript
app.use('/api/graph', graphRouter);  // Phase 14: Ownership + Dependency Graph
```
