# Phase 6D Closure — DONE / FROZEN

Date: 2026-08-12

**Phase 6D is merged, deployed, production-verified, and now FROZEN.** The
`source/dist/manifest provenance mismatch` reported in the original closure attempt
(2026-08-11) has been root-caused, fixed, merged, deployed, and proven live. This
document supersedes the earlier BLOCKED closure report.

## Root cause and remediation

Full technical detail: [`docs/architecture/PHASE6D_PROVENANCE_HOTFIX.md`](../architecture/PHASE6D_PROVENANCE_HOTFIX.md).

Summary: the live authority-control-plane scanner resolved its source root from
`process.cwd()`/`__dirname`, which in production pointed at the physical Git checkout —
a directory shared with an unrelated, disjoint, uncommitted workstream. `server/dist`
was correct and matched the reviewed PR exactly, but `/api/authority/status` and
`/api/authority/manifest` silently reported stale, pre-Phase-6D counts because the
scanner statically re-parsed `src/index.ts` from that unrelated checkout.

Fix: a deploy-owned, immutable, checksum-verified source snapshot
(`server/src/authority-control-plane/source-provenance.ts`), referenced by the
existing `MI_DEPLOYED_SOURCE_ROOT`/`MI_DEPLOYED_SOURCE_SHA` markers (no new competing
deployment marker). The scanner now fails closed on any invalid/missing/mismatched/
tampered snapshot rather than ever silently falling back to dirty checkout source.
Dev/test behavior is provably unchanged when `MI_DEPLOYED_SOURCE_ROOT` is unset.

## Hotfix release provenance

- Hotfix branch: `codex/hotfix-authority-source-provenance`, based at
  `af50e33c5db91b901551729406fca730c6c3f235` (the original Phase 6D merge/deployed SHA).
- Hotfix PR: [#88](https://github.com/liemdo28/master/pull/88).
- Hotfix PR gates: Repository scans PASS, GitGuardian Security Checks PASS, Server
  build and tests PASS (full `test:ci`, Phase 5A–5I acceptance, Agentic Coding,
  Command Center unit/security/E2E, and the new Phase 6A–6D authority/evidence gate
  chain including the new 10-scenario `test:authority-source-provenance` regression
  suite — all PASS, zero regressions).
- Hotfix PR merge SHA / final functional master SHA:
  `77939a3d0cb0cb00cc373a33157b25a639c644c5`.
- Clean-master verification at that SHA (fresh worktree, `npm ci`, `tsc --noEmit`
  server + command-center, `npm run build` root): all clean.
- Deploy-owned source snapshot built from that exact worktree:
  `D:\mi-core-deployed-source\77939a3d0cb0cb00cc373a33157b25a639c644c5\`,
  `fileCount: 731`,
  `treeChecksum: 5e4ab0d154a3725dc6798bf5f8306a567a2c61ffc47d4966a48a6ac03f161ecb`.
- Predeploy backup: `D:\mi-core-production-backups\phase6d-hotfix-predeploy-20260812-084546`
  (personal-os.db/projects.db/tasks.db read-only online backups, all integrity `ok`,
  0 FK violations, personal-os.db schema v10; pre-hotfix `.env` and deployed-source
  markers; pre-hotfix `authority-manifest.json`; pre-hotfix `server/dist` and
  `command-center/dist`; checksum manifest; `ROLLBACK.md`).
- Production deploy: `server/dist` and `command-center/dist` copied from the clean
  `77939a3d` worktree; `.env` updated to
  `MI_DEPLOYED_SOURCE_SHA=77939a3d0cb0cb00cc373a33157b25a639c644c5` and
  `MI_DEPLOYED_SOURCE_ROOT=D:\mi-core-deployed-source\77939a3d0cb0cb00cc373a33157b25a639c644c5`;
  only `mi-core` restarted (restart count 1, new PID; every other PM2 process —
  `mi-accounting`, `mi-ai-service`, `mi-ceo-observer`, `mi-n8n`, `mi-node-agent`,
  `mi-whatsapp-gateway`, `qb-ops-agent` — untouched, 0 restarts, same PID/uptime).
- The production Git checkout (`D:\Project\Mi-core-system\Master\mi-core`, still on
  its own unrelated branch `codex/phase10-2-reality-closure`, HEAD `1db12eb3`, 3499
  modified/untracked files) was never read, written, reset, stashed, or checked out
  at any point in this hotfix.

## Live provenance proof

- `GET /api/health`: 200, `server: ok`, `python_ai_service: ok` (`ollama: down` is a
  pre-existing, unrelated condition, unaffected by this deploy).
- `GET /api/authority/status` (authenticated): 200,
  `{"total":1055,"readOnly":661,"mutations":394,"canonical":671,"adapters":158,"quarantined":155,"forbidden":0,"internalTest":71,"unknownMutations":0,"legacyMutations":190,"adaptedLegacy":4,"quarantinedLegacy":186,"disabledDeadLegacy":0,"unresolvedLegacyMutations":0}` —
  byte-identical to the manifest generated at the reviewed hotfix SHA
  (`npm run authority:manifest` at `77939a3d`), and now correctly reflects Phase 6D's
  5 evidence routes, which the pre-hotfix manifest could not see.
- `GET /api/authority/manifest` (authenticated): 200, confirms
  `http:GET:/api/evidence`, `http:GET:/api/evidence/:id`,
  `http:GET:/api/evidence/conflicts`, `http:GET:/api/evidence/digest/:date`,
  `http:GET:/api/evidence/health` are now present in the live manifest for the first
  time since Phase 6D's original deploy.
- `unknownMutations: 0`, `unresolvedLegacyMutations: 0` — authority boundary intact.

## Phase 6D live re-acceptance (against real production data, all read-only)

- `GET /api/evidence` (authenticated): 200, real records across all 6 in-scope source
  systems (Controlled Actions, Governance, Delegation, Knowledge, Orchestration, Task
  Runtime). Every visible record's `redactionClass` is `OPERATOR_SAFE` — zero
  `SENSITIVE`/`SECRET_NEVER_RENDER` leakage confirmed across the full response.
- `GET /api/evidence/conflicts`: 200, `{"conflicts":[]}` (no open conflicts today).
- `GET /api/evidence/digest/2026-08-12`: 200, well-formed real counts (306 denials,
  306 blocked items, 0 open conflicts, 1 health degradation, 0 stale evidence).
- `GET /api/evidence/health`: 200, all dimensions reporting.
- `personal-os.db` post-restart: `integrity: ok`, 0 FK violations, schema v10
  (unchanged — this hotfix never touches any `.db` file or schema).
- `mi-core` post-restart error log scan (500 lines): 0 matches for uncaught
  exception, unhandled rejection, SQLite lock, migration failure, route collision,
  authority startup refusal, unresolved/unknown mutation, duplicate/unauthorized/
  automatic execution, Gmail SEND, calendar notification dispatch, or secret/token
  leakage.

## Authority boundary (unchanged from Phase 6C, now correctly visible)

Canonical Controlled Actions external action boundary remains:

- `GMAIL_CREATE_DRAFT`.
- `CALENDAR_EVENT_PROPOSAL`.
- `CALENDAR_CREATE_EVENT`.

Gmail SEND remains absent from governed execution. No new mutation authority, no
schema change, no new external action type was introduced by either the original
Phase 6D evidence contract or this provenance hotfix.

## What this means for the program

Per the governing Sequential Master Program directive: the `source/dist/manifest
provenance mismatch` stop condition is resolved and proven live. Phase 6D is now:

- Merged (original evidence contract: PR #86; provenance hotfix: PR #88).
- Deployed (functional SHA `77939a3d0cb0cb00cc373a33157b25a639c644c5`).
- Production-verified (live acceptance above).
- Documented (this closure, superseding the earlier BLOCKED report).
- **FROZEN.**

The Sequential Master Program resumes at **Phase 6E — Knowledge Quality & Scale**.
