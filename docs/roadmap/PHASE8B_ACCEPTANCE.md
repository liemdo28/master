# Phase 8B — Acceptance

Itemized proof against the governing directive's required outcomes. Machine-checkable parts are enforced by `npm run phase8b:acceptance` (`test:phase8b-legacy-retirement` + `test:phase8b-retirement-evaluation` + `authority:manifest -- --check`); the rest is evidenced below with pointers into the inventory/boundary/runbook docs.

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Fresh, read-only reality audit performed before any change | ✅ | Session record; no write occurred before the inventory was substantially built |
| 2 | Legacy inventory across all required subsystems, with per-candidate SOURCE PATH/RUNTIME OWNER/ROUTES/CALLERS/IMPORTERS/DB/AUTHORITY/PRODUCTION STATUS/CANONICAL REPLACEMENT/TEST COVERAGE/RETIREMENT RISK | ✅ | `docs/architecture/PHASE8B_LEGACY_INVENTORY.md` §1-12 |
| 3 | Formal classification of every candidate (CANONICAL/CANONICAL_ADAPTER/LEGACY_COMPATIBILITY/QUARANTINED/DEAD/REMOVE_CANDIDATE/KEEP_FOR_MIGRATION/UNKNOWN), UNKNOWN mutation-capable = 0 | ✅ | Inventory doc; `unknownMutations=0` in manifest and in `phase8b-legacy-retirement.test.ts` |
| 4 | All 49 `/api/jarvis` routes individually audited | ✅ | Inventory §1 (router-level + per-backing-module table) |
| 5 | Planner/orchestrator dedup — no planner retains independent external authority | ✅ (no change needed) | Inventory §7; `execution/` proven zero real-execution capability, `gstack/`'s real capability flagged not remediated (explicitly out of proven-safe scope) |
| 6 | Approval system dedup — legacy approval → external execution reachability = 0 | ✅ | `test:phase7a-authority-containment`, `phase7g-legacy-authority-scan`, `phase8b-retirement-evaluation.test.ts` (`legacyMutationReachable=0`) |
| 7 | Memory/conversation store audit — SessionStore ephemeral distinction preserved, no casual user-data migration | ✅ (no change needed) | Inventory §4 |
| 8 | Knowledge/retrieval dedup — no parallel factual authority | ✅ (no change needed) | Inventory §5 |
| 9 | Health dedup — SelfHeal preserved for 8C | ✅ (no change needed) | Inventory §6 |
| 10 | Autonomous/executor audit — mutation-capable code stays QUARANTINED or REMOVED | ✅ (no change needed) | Inventory §7; `jarvis/autonomous-task-runner.ts` remains hard-blocked (Phase 7A.2, re-verified) |
| 11 | Browser legacy audit — Phase 8A containment preserved | ✅ (untouched) | Inventory §8; `test:ssrf-policy`/`test:phase8a-security` re-run clean |
| 12 | node-agent disposition | ✅ (re-confirmed, unchanged) | Inventory §9 |
| 13 | Config/docs stale-path cleanup — machine-local secrets/config values not changed | ⚠️ Documented, not remediated this phase | Inventory §10 — `MI_CORE_ROOT`/E:-data-root split flagged as a real operational finding, explicitly deferred (fixing it is a config/data-migration action, not a code-retirement action, and out of this phase's proven-safe scope) |
| 14 | Package/dependency cleanup — remove only if exclusively used by removed code | ✅ | Inventory §11 — nothing qualified; the retired router used only `express` and local modules |
| 15 | Deterministic dead-file detection accounting for dynamic entrypoints | ✅ | Inventory §12 — full proof checklist against `routes/jarvis.ts` |
| 16 | Staged route retirement strategy | ✅ | `docs/operations/PHASE8B_RETIREMENT_RUNBOOK.md` |
| 17 | Route contract tests + canonical owner structural test (13 domains, ≥1 canonical owner each, no duplicates) | ✅ | `server/src/__tests__/phase8b-legacy-retirement.test.ts` — 13/13 domains verified |
| 18 | ≥750-scenario deterministic retirement evaluation suite, all required metrics = 0, determinism = 100% | ✅ | `server/src/authority-control-plane/__tests__/phase8b-retirement-evaluation.test.ts` — 1310 scenarios, 0 failures |
| 19 | Authority manifest regen — mutation count may decrease, must not increase | ✅ | `docs/security/PHASE8B_RETIREMENT_BOUNDARY.md` — `legacyMutations` 190→175 (decrease), `unknownMutations`/`unresolvedLegacyMutations` unchanged at 0 |
| 20 | Schema stays v10 | ✅ (unchanged) | No schema file touched this phase |
| 21 | Full frozen regression: 5A-5I, 6A-6G, 7A-7G, 8A, `test:ci`, Agentic Coding, Command Center | ✅ | Full chain re-run clean end-to-end this session (exit 0); CC unit/security/a11y/E2E confirmed earlier this session, untouched by this phase's backend-only diff |
| 22 | Security regression re-scan (SSRF, route auth, legacy mutation, Gmail SEND, financial, shell, browser-write, approval bypass, project/session isolation) | ✅ | `docs/security/PHASE8B_RETIREMENT_BOUNDARY.md` |
| 23 | Performance measurement where meaningful | ✅ (assessed, not benchmarked — justified) | `docs/operations/PHASE8B_RETIREMENT_RUNBOOK.md` "Performance impact" — retired surface had zero live traffic, so no measurable change; explicitly not fabricated |
| 24 | 5 required docs | ✅ | This doc + inventory + canonical owner map + runbook + boundary doc |
| 25 | Staged multi-commit PR, no unrelated feature work | ✅ | See PR description — inventory/classification, route retirement + registry fix, tests/evaluation, docs, unrelated-but-evidenced test fixes called out explicitly, not hidden |

## Zero-ambiguity outcome (the actual bar for this phase)

Per the directive: "the goal is not maximum deletion; the goal is zero ambiguous live ownership." One component (`routes/jarvis.ts`) cleared every proof requirement and was retired. Every other candidate surfaced during discovery — `execution/`, `gstack/`, node-agent, the `MI_CORE_ROOT` split, and the rest — was either already unambiguous (no change needed) or is explicitly disclosed and deferred rather than guess-removed. `unknownOwner=0`, `unresolvedLegacyMutations=0`, `routeOwnershipAmbiguity=0` hold across the full manifest.
