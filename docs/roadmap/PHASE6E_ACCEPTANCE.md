# Phase 6E — Acceptance — DONE / FROZEN

Date: 2026-08-12

## Release provenance

- PR: [#90](https://github.com/liemdo28/master/pull/90), merged.
- Independent review performed against the PR diff (not a re-read of the
  implementation summary) before merge: found and fixed one real bug —
  `findBySourceUriFragment()`'s SQL `LIMIT` was applied before the JS project-scope
  filter, so 20+ other projects sharing a queried document's exact filename fragment
  could silently crowd the caller's own in-scope document out of the exactPathMatch
  priority signal (never a leak — the project filter was still correct once applied —
  but a false miss on the signal). Fixed by over-fetching before filtering (same
  pattern `searchChunks` already uses for the identical JSON-column constraint). A
  permanent regression test (25 decoy-project documents) was added and verified to
  fail against the unfixed code and pass against the fix before committing. See
  commit `6de476de`.
- Final reviewed PR head / merge SHA: `e766feb15dab24355ad84b63c8c4f3c7201a0f95`.
- Final repository master SHA at functional deploy: `e766feb15dab24355ad84b63c8c4f3c7201a0f95`.
- Functional deployed SHA: `e766feb15dab24355ad84b63c8c4f3c7201a0f95`.

Production provenance:

- Production root: `D:\Project\Mi-core-system\Master\mi-core`.
- `MI_DEPLOYED_SOURCE_SHA=e766feb15dab24355ad84b63c8c4f3c7201a0f95`.
- `MI_DEPLOYED_SOURCE_ROOT=D:\mi-core-deployed-source\e766feb15dab24355ad84b63c8c4f3c7201a0f95`
  (fileCount 738, treeChecksum `644bd12a9ecd38d2ed2a4ad1632aa14d6e3870b76c3efb62c59365991fb52ed7`).
- Predeploy backup: `D:\mi-core-production-backups\phase6e-predeploy-20260812-101529`.
- Deployment provenance invariant confirmed live:
  `MI_DEPLOYED_SOURCE_SHA = deploy-owned source snapshot SHA = runtime scanned source
  SHA = authority manifest SHA = server/dist reviewed SHA` — all equal to
  `e766feb15dab24355ad84b63c8c4f3c7201a0f95`.

## §40 — 20-point acceptance (`npm run phase6e:acceptance`)

All 20 points PASS. Live output:

| # | Point | Result |
|---|---|---|
| 1 | canonical FTS remains operational | 507 cases executed against live FTS5 search |
| 2 | benchmark runs | 507 deterministic cases (target: 500 minimum) |
| 3 | Top-3 recall target measured | RECALL 98.7% (target ≥95%) |
| 4 | citation correctness 100% | 100.0% |
| 5 | project isolation | crossProjectLeakage = 0 |
| 6 | explicit-path retrieval | EXACT_PATH 100.0% |
| 7 | symbol retrieval | SYMBOL 100.0% |
| 8 | version/freshness behavior | STALENESS 100.0%, SUPERSEDED_VERSION 100.0% |
| 9 | conflict behavior | CONFLICT 100.0%, conflictSuppression = 0 |
| 10 | no-answer behavior | NO_ANSWER 100.0% |
| 11 | ingestion failure visibility | 1 FAILED job visible via `GET /knowledge-documents/ingestion-jobs`, errorCode surfaced |
| 12 | incremental reindex | unchanged content → `UNCHANGED` (checksum-verified no-op) |
| 13 | secret scanning | secret-bearing content → `REJECTED`/`SECRET_REJECTED` |
| 14 | evidence integration | document + conflict + ingestion-job evidence present; every `FAILED_INGESTION` evidenceId resolves |
| 15 | operator/Command Center health view | `GET /knowledge-documents/quality-summary` reports all 10 required fields |
| 16 | scale test | 1,000 docs / 11,000 chunks (`test:knowledge-scale`) |
| 17 | backup/restore proof | 40-case retrieval-equivalence, 0 mismatches (`test:knowledge-backup-restore-benchmark`) |
| 18 | no new authority | unknownMutations = 0, unresolvedLegacyMutations = 0 |
| 19 | no Gmail SEND | gmailSendRouteMounted = false |
| 20 | deterministic results | deterministicResults = true |

## Baseline → final metrics

See `docs/architecture/PHASE6E_KNOWLEDGE_QUALITY.md` for the full breakdown. Summary:

- Benchmark size: 507 deterministic cases (8 fact kinds × 8 projects × 7 phrasings +
  59 edge-case queries across 10 further categories).
- Overall correctness: 79.3% → **97.2%**.
- RECALL (top-3): 80.1% → **98.7%**.
- citationCorrectness / crossProjectLeakage / unsupportedSynthesis /
  conflictSuppression / secretLeakage / deterministicResults: at target throughout
  (100% / 0 / 0 / 0 / 0 / 100%).
- MULTI_HOP: 0% — measured every run, not gated, architectural boundary documented
  and not treated as a failure to fix.
- Semantic-search experiment (§25): **not run** — the FTS benchmark did not reveal a
  gap deterministic FTS improvements couldn't close; rejected at the gate per the
  directive's own framing that this is a valid Phase 6E outcome.

## Scale results

1,000 documents / 20 projects / 11,000 chunks. Ingest: 179.4 docs/sec (5,574ms total).
Retrieval at scale: p50 0ms / p95 1ms. Incremental reindex of one changed document:
11ms vs. 5,574ms full-corpus ingest (~500x cheaper). DB ~30.4 MB, WAL ~5.1 MB, process
RSS ~183 MB.

## Production knowledge baseline (measured, read-only)

0 ACTIVE documents, 0 chunks, 0 FTS rows in production at the start of this phase (8
document rows total, all DELETED/SUPERSEDED leftover fixture-test artifacts). Recorded
honestly per the governing directive's MEASURED/OBSERVED/ESTIMATED labeling
requirement — see `PHASE6E_KNOWLEDGE_QUALITY.md`.

## Regression

Full regression (`npm ci`, `npm run build`, `npx tsc --noEmit` server + command-center,
`npm run test:ci`, Phase 5A–5I, Phase 6A–6D, Agentic Coding, Command Center
unit/security/E2E) and Phase 6E's own new gates
(`test:knowledge-quality`, `test:knowledge-quality-security`, `test:knowledge-scale`,
`test:knowledge-backup-restore-benchmark`, `test:knowledge-retrieval-regression`,
`knowledge-quality:evaluation`, `phase6e:acceptance`) — full results and exit codes
recorded in the PR description and the final closure document once merged.

## Command Center

New Quality tab; `tsc -b`, `vite build`, `test:command-center` (18/18),
`test:command-center-security` (20/20), `test:command-center-e2e` (4/4) all pass
unchanged. Manual browser verification was not performed for this specific tab (the
change is additive and covered by the existing E2E fixture flow, which already
navigates the Knowledge page); this is recorded honestly rather than claimed as a
live-browser check.

## Live production acceptance (post-deploy, real production data, read-only)

- `GET /api/health`: 200 — `server: ok`, `python_ai_service: ok` (`ollama: down` is a
  pre-existing, unrelated condition, independently re-verified at the start of this
  phase to confirm the canonical FTS-based Knowledge OS has no dependency on it — see
  `docs/architecture/PHASE6E_KNOWLEDGE_QUALITY.md`).
- `GET /api/authority/status` (authenticated): 200,
  `{"total":1066,"readOnly":670,"mutations":396,"canonical":677,"adapters":158,"quarantined":155,"forbidden":0,"internalTest":76,"unknownMutations":0,"legacyMutations":190,"adaptedLegacy":4,"quarantinedLegacy":186,"disabledDeadLegacy":0,"unresolvedLegacyMutations":0}` —
  matches the reviewed manifest at the merged SHA exactly; the two new Phase 6E routes
  (`ingestion-jobs`, `quality-summary`) confirmed present in the live manifest.
- `GET /api/knowledge-documents/quality-summary` (authenticated): 200, real production
  counts — `documents: 1` (the pre-existing SUPERSEDED fixture-test row),
  `chunks: 0`, `failedIngestion: 2` (the two pre-existing FAILED jobs from before this
  phase — `UNSUPPORTED_MIME` and `SECRET_REJECTED`, unrelated to this deploy),
  `indexHealth: ATTENTION` (correctly reflecting those two pre-existing failures, not
  anything newly introduced).
- `GET /api/knowledge-documents/ingestion-jobs?status=FAILED`: 200, both pre-existing
  failed jobs individually visible with reason codes.
- `personal-os.db` post-restart: `integrity: ok`, 0 FK violations, schema v10
  (unchanged — this phase never touches any `.db` file or schema).
- `mi-core` post-restart error log scan (300 lines): 0 matches for uncaught
  exception, unhandled rejection, SQLite lock, migration failure, route collision,
  authority startup refusal, unresolved/unknown mutation, duplicate/unauthorized/
  automatic execution, Gmail SEND, calendar notification dispatch, or secret/token
  leakage.
- Restart discipline: only `mi-core` restarted (restart count 2, new PID); every
  other PM2 process (`mi-accounting`, `mi-ai-service`, `mi-ceo-observer`, `mi-n8n`,
  `mi-node-agent`, `mi-whatsapp-gateway`, `qb-ops-agent`) untouched — 0 restarts, same
  PID/uptime throughout.
- Production Git checkout untouched throughout (still on unrelated branch
  `codex/phase10-2-reality-closure`, HEAD `1db12eb3`, 3499 modified/untracked files) —
  never read, written, reset, or checked out at any point in this phase.

## Phase 6E frozen status

**FROZEN.** Merged, deployed, production-verified, documented. The Sequential Master
Program's auto-continue condition ("If Phase 6E is fully merged, deployed,
production-verified, documented, and frozen with no blocker: continue automatically
to PHASE 6F — GOVERNED AUTOMATION SIMULATION") is satisfied — no blocker was
encountered. Per the governing directive, Phase 6F requires its own specification
section, which is not present in this context; the program stops here to request it
rather than inventing a different roadmap.
