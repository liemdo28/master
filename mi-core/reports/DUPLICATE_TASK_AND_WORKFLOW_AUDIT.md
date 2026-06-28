# Duplicate Task / Workflow Overlap Audit

Test: `node mi-core/tests/duplicate-task-workflow-audit-test.mjs` → **15/15 PASS**
Engine under test: `mi-core/server/src/executive-coordination/duplicate-detector.ts` (Jaccard token similarity + semantic-synonym boost, threshold ≥ 0.40).

## Scenarios (all six from the directive)

| # | Overlap scenario | Mechanism | Result |
|---|---|---|---|
| 1 | same objective submitted twice | title Jaccard = 1.0 | ✅ duplicate detected |
| 2 | same task created by two agents | Jaccard + semantic (seo/review cluster) | ✅ detected (owner-independent) |
| 3 | same workflow triggered by n8n AND agent-engine | identical title, different source | ✅ detected |
| 4 | same OSS capability selected twice | "Deploy Metabase dashboard" ↔ "Deploy dashboard" (dashboard cluster) | ✅ detected |
| 5 | same connector evidence / report task twice | "Generate revenue report" ↔ "Generate revenue analytics" (report cluster) | ✅ detected |
| 6 | same approval-gated campaign requested twice | identical campaign title | ✅ detected |

## Merge behavior (no task explosion)
- `detectDuplicates` finds exactly **one** pair for a duplicate (not a storm). ✅
- `markDuplicate` sets `duplicateOf = canonical` — the duplicate is **merged, not deleted**; canonical + owner preserved. ✅
- `getDuplicateSummary` counts exactly 1 duplicate and names the canonical. ✅
- Re-running detection after merge yields **0 new pairs** (the detector excludes already-merged tasks → no re-explosion). ✅

## No false-merge of distinct work
- "Run SEO Audit" vs "Pay vendor invoice" → **not** merged. ✅
- "Hire a head chef" vs "Deploy analytics dashboard" → **not** merged. ✅

## Honest scope notes
- This is **task-level** dedup at the coordination layer — where tasks are actually created. It is the correct chokepoint for "no duplicate tasks / overlapping workflows."
- **Cross-source idempotency** (the same approval requested twice, the same connector evidence posted twice) is additionally enforced by *other* layers and is not re-tested here:
  - approvals: Phase 2D / 2D+ tokens are **single-use** (a granted approval can be consumed once — proven in `phase2dplus-hardening-runtime-test.mjs`).
  - evidence: `evidence-registry` records are keyed per task.
- These complementary mechanisms mean "approval requested twice" is blocked at consume-time even if two requests are filed.

**Verdict: NO duplicate-task explosion. Duplicate detection + merge = PROVEN (15/15).**
