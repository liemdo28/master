# Phase 8B — Canonical Owner Map

Final canonical-owner map after Phase 8B's legacy retirement work. Extends Phase 7G's own canonical owner map (`PHASE7G_PROGRAM_AUDIT.md`) — unchanged except for the one retirement below. Structurally regression-locked by `server/src/__tests__/phase8b-legacy-retirement.test.ts`, which re-derives this table live from `authority-manifest.json` on every run and fails if any of the 13 required domains loses its canonical owner or gains a duplicate/UNREGISTERED mutation-capable owner.

## What changed in Phase 8B

One retirement only: the legacy 49-route `/api/jarvis` HTTP router (`server/src/routes/jarvis.ts`) was deleted and its mount removed from `index.ts`. It had no canonical-owner role of its own — every domain it superficially touched (Jarvis conversation, knowledge, approval-adjacent text) was already owned by the canonical Phase 7C Jarvis Gateway, not by this router. Its removal is therefore a pure dead-surface reduction, not a re-ownership: no domain's canonical owner changes as a result.

One registry gap was closed as a byproduct of building this table: `/api/evidence` (and `/api/command-center/evidence`) had zero authority registry rule and fell through to the scanner's generic UNREGISTERED default despite being a real, mounted, canonical, GET-only route (`server/src/evidence/router.ts`). A new `evidence-read` rule was added to `authority-control-plane/registry.ts` resolving it to `EvidenceService` — see inventory §12 note and the Evidence row below.

## Canonical owner per required domain

| Domain | Canonical owner | Representative route pattern | Evidence |
|---|---|---|---|
| Jarvis (conversation) | `JarvisGateway` | `/api/jarvis/*` (request/session/voice) | `jarvis-gateway/gateway.ts` — canonical since Phase 7C |
| Knowledge | `KnowledgeDocumentService` | `/api/knowledge/*` | Phase 5D2/6E |
| Tasks | `Task Runtime` | `/api/task-runtime/tasks` | Phase 5A/5H |
| Projects | `Project Registry` | `/api/project-registry/*` | Phase 5A |
| Planning | `Daily Operating Loop` | `/api/daily-operating/*` | Phase 5D3 |
| Simulation | `AutomationSimulationService` | `/api/automation-simulation/*` | Phase 6F |
| Controlled Actions | `ControlledActionService` | `/api/(command-center/)?actions*` | Phase 5F/5G |
| Approval | `ControlledActionService` | `/api/(command-center/)?actions*` | Phase 5F/5G — legacy `jarvis/approval-conversation.ts` and `execution/approval-orchestrator.ts` remain non-authoritative, hard-contained (Phase 7A.1/7A.2, inventory §2) |
| Health | `Health Truth Model` / `Public health/auth bootstrap` | `/api/health*` | Phase 7B |
| Evidence | `EvidenceService` | `/api/(command-center/)?evidence*` | Phase 6D — registry gap closed this phase |
| Voice | `JarvisGateway` | `/api/jarvis/voice/*` | Phase 7F |
| Coding | `Coding Engine control plane` | `/api/coding/*` | Phase 5-series |
| Session | `JarvisGateway` | session state via Gateway | Phase 7D |

No domain has more than one canonical (mutation-capable, non-`ADAPT_SAFE`) owner. `unknownMutations=0`, `unresolvedLegacyMutations=0` across the full 1064-surface manifest.

## Non-authoritative / contained duplicates (unchanged from Phase 7G, re-verified this phase)

- `jarvis/approval-conversation.ts`, `jarvis/autonomous-task-runner.ts` — hard-blocked since Phase 7A.1/7A.2; zero live execution reachability re-confirmed this phase (`test:phase7a-authority-containment`, `phase7g-legacy-authority-scan`).
- `execution/` (18-file "DEV5 Execution Engine") — reachable via `/api/chat` and WhatsApp, but proven to have zero real external-execution capability (exhaustive negative grep for shell/network/mail primitives; inventory §2). `KEEP_FOR_MIGRATION`, not a canonical owner of anything.
- `gstack/`'s own separate `approval-engine.ts` — real execution capability (real publish, real WhatsApp send) gated behind its own non-canonical approval gate. Flagged, not remediated this phase (inventory §3) — out of Phase 8B's proven-safe retirement scope.

## Verification

`npm run test:phase8b-legacy-retirement` re-derives this table from live source + the regenerated manifest on every CI run; `npm run authority:manifest -- --check` re-asserts `unknownMutations=0`/`unresolvedLegacyMutations=0` against the current source tree.
