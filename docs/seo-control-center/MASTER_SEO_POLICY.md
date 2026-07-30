# SEO Control Center — Master Policy

Enforced in code by [`seo-policy-engine.ts`](../../mi-core/server/src/seo/seo-policy-engine.ts) reading [`config/seo-policy.yaml`](../../mi-core/config/seo-policy.yaml), and wired into the existing approval gate via [`seo-approval-bridge.ts`](../../mi-core/server/src/seo/seo-approval-bridge.ts). This document is the human-readable rationale; the YAML file is the enforced source of truth.

## Precedence

`BLOCKED > REQUIRES_APPROVAL > AUTO_WITH_NOTIFICATION > SAFE_AUTO`

No confidence score, AI provider output, or automation run may override `BLOCKED`. An action category not found in the policy file fails safe to `REQUIRES_APPROVAL` — it is never auto-executed by default.

## The 25 principles

1. Facts before content — no article ships a claim that isn't a `VERIFIED` row in the Business Fact Registry.
2. Quality before volume — no fixed weekly article quota overrides QA/approval gates.
3. Search intent before word count — length ranges are guidance, not a target to hit mechanically.
4. Local accuracy before broad targeting — location pages must use verified, location-specific facts.
5. Existing-page improvement before creating duplicate pages — the cannibalization guard runs before any new page is created.
6. Business conversion before vanity traffic — content distribution favors menu/location/order intent over informational-only traffic.
7. Evidence required for every action — every mutating SEO action records a `seo_evidence` row before/alongside its result.
8. Preview before production — no publish adapter writes to a live site without a preview step.
9. Approval before risky publication — anything in `REQUIRES_APPROVAL` or `BLOCKED` goes through the approval gate or is rejected outright.
10. Rollback available for every production mutation — publish adapters must create a `seo_publish_snapshots` row before mutating.
11. No fake reviews.
12. No fake claims — claims not backed by a `VERIFIED` fact are blocked at the QA/fact-check step.
13. No black-hat backlinks — backlink evaluation auto-rejects known-bad categories (adult, gambling, PBN, malware, link farms, deindexed pages).
14. No doorway pages — location pages must carry unique, useful content; the cannibalization guard flags near-duplicate location pages.
15. No keyword stuffing.
16. No mass low-quality article generation — default publish cadence starts conservative (see calendar defaults) and is CEO-adjustable, not automation-adjustable.
17. No unauthorized cross-brand linking — the internal link engine rejects a Raw Sushi article linking to Bakudan (or vice versa) unless explicitly approved.
18. No secret exposure to ChatGPT — the ChatGPT browser provider redacts secrets from prompts before submission.
19. No direct production mutation by browser automation without approval — publish adapters always route through the approval bridge for `production_deploy`.
20. Every automation must be idempotent — `seo_actions.idempotency_key` is a unique constraint; duplicate submissions return the prior result instead of re-running.
21. Every failure must stop safely — see error-handling table below.
22. Every published article must pass all required QA gates — structural, SEO, fact, brand, content, publishing.
23. Content must be useful to restaurant customers, not just search engines.
24. Location-specific content must use verified location data — pulled from `seo_business_facts`, not invented.
25. Menu references must be verified against current approved menu data before publication.

## Error handling (fail-safe defaults)

| Condition | Behavior |
|---|---|
| ChatGPT browser session login expired | AI job marked `waiting_for_login`, task state preserved, CEO notified — never silently retried with stale auth |
| Website build fails | Publish blocked, logs saved, content item marked `FAILED`, returned to the content queue |
| QA score below threshold | Publish blocked, returned to the responsible step for correction |
| GBP unavailable | Last successful snapshot used, marked stale — GBP itself is never auto-changed |
| Search Console unavailable | No ranking data is invented; connector marked unavailable |
| Conflicting business facts | Publication stops, enters `FACT_QA`, requires manual resolution |
| Production verification fails after a deploy | Rollback is recommended, success is never claimed without verification |

## Connector status vocabulary

Every connector and every automation run must report one of exactly four states — this project does not report "done" on mocked data:

- `MOCK` — no real credentials, simulated response
- `CONFIGURED` — credentials present, not yet exercised with a real call
- `CONNECTED` — a real call succeeded at least once
- `LIVE_VERIFIED` — the specific claim being made (e.g. "article is indexed") was checked against the real destination just now, not inferred

See [`INITIAL_AUDIT.md`](INITIAL_AUDIT.md) for the current status of each connector under this vocabulary.
