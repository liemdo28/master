# Phase 6D Provenance Hotfix — Deploy-Owned Source Snapshot

Date: 2026-08-12
Branch: `codex/hotfix-authority-source-provenance`
Base: `af50e33c5db91b901551729406fca730c6c3f235` (Phase 6D merge, also production's deployed SHA at the time this branch was cut)

## Root cause (confirmed, see `docs/releases/PHASE6D_CLOSURE.md`)

`authority-control-plane/router.ts`'s live `/authority/status` and `/authority/manifest`
handlers, and every other authority-manifest call site in this module, resolved their
source root from `process.cwd()` or `path.resolve(__dirname, '../..')` — i.e. from
whatever physical checkout the compiled server happens to be running from. In
production that checkout is the same directory that a separate, unrelated,
in-progress workstream (`codex/phase10-2-reality-closure`, 3499 modified/untracked
files) uses as its own working tree. The scanner statically re-parses `src/index.ts`
from that location at request time, so the live authority manifest silently reported
stale, pre-Phase-6D route counts even though `server/dist` was correctly built and
deployed from the reviewed, merged source.

This is a `source/dist/manifest provenance mismatch`: the compiled artifact was
correct, but the governance system's own source of truth for "what surfaces exist"
was reading unrelated code.

## Fix: deploy-owned, immutable, checksum-verified source snapshot

New module: `server/src/authority-control-plane/source-provenance.ts`.

- `buildSourceSnapshot(sourceServerRoot, destRoot, deployedSha)` — deploy-time builder.
  Copies `server/src/**` and `server/package.json` from the exact reviewed worktree
  being deployed into an immutable, per-SHA directory (written to a staging path and
  atomically renamed into place, so a reader never observes a partial snapshot).
  Records a `snapshot-manifest.json` with `deployedSha`, `generatedAt`, `fileCount`,
  and a deterministic `treeChecksum` (sha256 over every relative-path→content-hash
  pair, sorted, hashed once more).
- `verifySnapshot(snapshotRoot, expectedSha)` — fails closed on any invalid state:
  missing directory, missing/malformed manifest, `src/index.ts` absent, SHA mismatch
  against the expected deployed SHA, or a recomputed checksum that no longer matches
  the manifest (tampering/incompleteness).
- `resolveAuthorityRepoRoot(fallback)` — the single resolution point now used by every
  authority-scanning call site (`router.ts`, `generate-manifest.ts`, `guard.ts`,
  `legacy-adapter.ts`, `legacy-authority-evaluation.ts`, `phase6a-acceptance.ts`,
  `phase6b-acceptance.ts`). If `MI_DEPLOYED_SOURCE_ROOT` is unset, it returns
  `fallback` unchanged — this is the explicit development/test contract, byte-for-byte
  identical to every call site's behavior before this hotfix. If it is set, the
  snapshot there **must** verify against `MI_DEPLOYED_SOURCE_SHA`; verification
  failure throws rather than ever falling back to the (possibly dirty) `fallback` path.

Reused, not replaced: `MI_DEPLOYED_SOURCE_ROOT` and `MI_DEPLOYED_SOURCE_SHA` are the
same markers this program has used since Phase 6A. `MI_DEPLOYED_SOURCE_ROOT` was
previously written to `.env` but never read by any code; it is now repurposed to point
at the deploy-owned snapshot directory (`D:\mi-core-deployed-source\<sha>\`) instead of
the production Git checkout.

New deploy-time CLI: `server/src/authority-control-plane/build-snapshot-cli.ts`
(`npm run authority:build-snapshot -- --sha=<sha>`), run from the reviewed worktree
being deployed. Idempotent: a re-run for an already-verified SHA is a no-op; an
existing-but-invalid snapshot at that path fails loudly instead of being silently
overwritten.

## Invariant this restores

`scanner source SHA = server/dist functional SHA = authority manifest functional SHA = MI_DEPLOYED_SOURCE_SHA`,
once `.env`'s `MI_DEPLOYED_SOURCE_ROOT` is pointed at a snapshot built from the same
reviewed worktree that produced the deployed `server/dist`.

## Fail-closed behavior (see `__tests__/source-provenance.test.ts`, 10 scenarios)

With `MI_DEPLOYED_SOURCE_ROOT` set, the scanner never silently falls back to dirty
checkout source: missing snapshot, missing/malformed manifest, incomplete snapshot,
wrong SHA, and tampered (checksum-mismatched) content all throw. Dev/test mode
(`MI_DEPLOYED_SOURCE_ROOT` unset) is provably unchanged — verified directly against a
deliberately "dirty" fixture tree missing routes the reviewed snapshot has.

## No authority expansion, no schema change, no external action change

- No new HTTP route, CLI command, or background surface is added by this hotfix
  itself (the small `internalTest` count increase reflects the two new `npm run
  test:*` script entries this hotfix adds, which `discoverNonHttpSurfaces()` already
  classifies as internal test surfaces — the same mechanism used for every prior
  phase's own test scripts).
- No mutation authority is added, removed, or reclassified.
- No database schema migration; no `.db` file is touched.
- No new external action type; Gmail SEND remains unreachable; no financial action
  path exists.
- `assertAuthorityManifest()`'s enforcement logic in `scanner.ts` is untouched.

## Deployment integration

1. Deploy runs `npm run authority:build-snapshot -- --sha=<final hotfix SHA>` from the
   clean reviewed worktree, producing `D:\mi-core-deployed-source\<sha>\`.
2. `server/dist` and `command-center/dist` are copied from the same reviewed worktree,
   exactly as every prior phase's deploy has done.
3. `.env` is updated: `MI_DEPLOYED_SOURCE_ROOT=D:\mi-core-deployed-source\<sha>`,
   `MI_DEPLOYED_SOURCE_SHA=<sha>`.
4. Only `mi-core` is restarted.
5. Live proof: `/api/authority/status` is checked against the exact manifest produced
   by `npm run authority:manifest` at the reviewed SHA.

The production Git checkout at `D:\Project\Mi-core-system\Master\mi-core` (still on its
own unrelated branch) is never read, written, reset, or otherwise touched by this
hotfix or by the scanner once a valid snapshot is configured.
