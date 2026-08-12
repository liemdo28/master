# Phase 6E — Runbook

Date: 2026-08-12

## What changed operationally

- `server/src/personal-os/documents/retrieval.ts`: added `exactPathMatch` ranking
  signal and `explainQuery()`. No behavior change when a query names no path-like
  token (the added signal defaults to 0).
- `server/src/personal-os/documents/store.ts`: added `findBySourceUriFragment()`. Read
  path only, no schema/migration.
- `server/src/personal-os/documents/types.ts`: added `KnowledgePack.unknownReason`
  (additive — every existing consumer that doesn't read this field is unaffected).
- `server/src/personal-os/documents/router.ts`: added
  `GET /knowledge-documents/ingestion-jobs`,
  `GET /knowledge-documents/quality-summary`,
  `POST /knowledge-documents/debug-search`.
- `server/src/evidence/normalize.ts` + `service.ts`: `normalizeIngestionJob()` wired
  into `EvidenceService.list()` — fixes a pre-existing dangling-evidence-id bug in
  `health()`'s `FAILED_INGESTION` dimension.
- `command-center/src/routes/KnowledgePage.tsx`: new "Quality" tab.
- New test/eval/acceptance scripts (all read-only against disposable fixtures, never
  the production DB): `test:knowledge-quality`, `test:knowledge-quality-security`,
  `test:knowledge-scale`, `test:knowledge-backup-restore-benchmark`,
  `test:knowledge-retrieval-regression` (alias to the existing frozen 30-query test),
  `knowledge-quality:evaluation`, `phase6e:acceptance`.

## What did NOT change

No database schema migration. `personal-os.db` remains schema v10. No new mutation
route. No new external action type. No change to Phase 5F/5G/5H/5I, Phase 6A/6B/6C/6D
semantics. No change to the Coding Engine. No OCR. No PDF parser change. No semantic
search / vector DB dependency introduced into production.

## Deployment

Standard dist-file-copy deploy, same pattern as every prior phase:

1. Build from the exact reviewed worktree: `npm run build` (root — builds
   `server/dist` and `command-center/dist`).
2. Predeploy backup per the established convention
   (`D:\mi-core-production-backups\phase6e-predeploy-<timestamp>\`): online
   `better-sqlite3` backups of `personal-os.db`/`projects.db`/`tasks.db`, current
   `.env`/deployed-source markers, current `authority-manifest.json`, current
   `server/dist`/`command-center/dist`, checksum manifest, `ROLLBACK.md`.
3. Copy `server/dist` and `command-center/dist` from the reviewed worktree into
   production.
4. Rebuild the deploy-owned source snapshot for the new functional SHA (the Phase 6D
   hotfix's `npm run authority:build-snapshot -- --sha=<sha>`) and update
   `MI_DEPLOYED_SOURCE_SHA`/`MI_DEPLOYED_SOURCE_ROOT` accordingly — this is now a
   **hard, permanent invariant** for every future deploy, not just this one:
   `MI_DEPLOYED_SOURCE_SHA = deploy-owned source snapshot SHA = runtime scanned source
   SHA = authority manifest SHA = server/dist reviewed SHA`.
5. Restart only `mi-core`. No other PM2 process is touched.
6. Verify: `/api/health` 200; `/api/authority/status` counts match the reviewed
   manifest; `/api/knowledge-documents/quality-summary` 200 (authenticated); a live
   `phase6e:acceptance` re-run is not required in production (it depends on temp
   fixtures, not production data) — the live proof is the health/authority/
   quality-summary checks plus a DB integrity check.

## No live full reindex required

This phase adds retrieval-time logic and read-only observability surfaces only. It
does not change how existing documents are chunked, does not bump `PARSER_VERSION`,
and does not require re-ingesting anything already indexed. Existing STALE-detection
(`refreshStaleness()`) and reindex (`reindex()`) paths are unchanged and continue to
work exactly as before.

## Rollback

Same pattern as every prior phase:

1. Stop only `mi-core`.
2. Restore `server/dist` and `command-center/dist` from the predeploy backup.
3. Restore `.env` deployed-source markers to the pre-Phase-6E values if reverting past
   the deploy-owned-snapshot rebuild in step 4 above.
4. Restore DB files only if a verified DB integrity issue is found (unlikely — this
   phase never migrates schema or writes to any table outside its own read paths).
5. Start `mi-core`.
6. Re-run `/api/health`, `/api/authority/status`, DB integrity checks.

Do not touch the unrelated production Git checkout during rollback, per the Phase 6D
hotfix's own standing rule.

## Known limitations (recorded, not hidden)

- **MULTI_HOP retrieval is not supported.** A query whose answer spans two documents
  returns the single best-matching chunk, not a synthesized combination. This is an
  intentional architectural boundary (see `PHASE6E_KNOWLEDGE_QUALITY.md`'s "Rejected"
  section), not a bug awaiting a fix.
- **Production has 0 ACTIVE knowledge documents at the time of this phase.** Quality
  work here is proven against a purpose-built benchmark, not live traffic, because
  there is no live traffic yet. Operators should not expect the Command Center
  Quality tab to show non-zero counts until real documents are ingested.
- **PDF parsing remains `PARSER_UNAVAILABLE`** where it already was — unchanged, no
  new dependency added, per the governing directive's explicit "keep it honest"
  instruction.
