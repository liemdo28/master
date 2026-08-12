# Phase 6E — Acceptance

Date: 2026-08-12

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

## Deployment provenance

Functional deployed SHA, hotfix-invariant compliance
(`MI_DEPLOYED_SOURCE_SHA = snapshot SHA = scanned source SHA = manifest SHA =
server/dist SHA`), and production acceptance results are recorded in the final Phase
6E closure document after merge and deploy — this document is written at PR-open time
and will be superseded by that closure record, matching the Phase 6D precedent.

## Phase 6E frozen status

**Not yet — PR open, pending review/CI/merge/deploy/production acceptance.** This
document will be superseded by a final closure record once all of §46–§51 of the
governing directive are complete.
