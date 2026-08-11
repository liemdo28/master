# Phase 6D Closure — BLOCKED (program-level stop condition)

Date: 2026-08-11

**Phase 6D is merged, deployed, and its own new functionality is verified working
correctly against live production data. Phase 6D closure/freeze is BLOCKED, and the
Phase 6D→6G Sequential Master Program is STOPPED, by a genuine
`source/dist/manifest provenance mismatch` — a program-level stop condition named
explicitly, verbatim, in the governing directive.**

## What is done

- PR #86 merged: `af50e33c5db91b901551729406fca730c6c3f235`.
- Independent review performed against the PR diff (not a re-read of the implementation
  summary) found and fixed three real issues before merge: a redaction-cap enforcement
  gap in `conflicts()`/`digest()`, a free-text heuristic in denial-counting that
  contradicted the phase's own hard rule, and two dead/unused type enum values. See
  the PR review comment and commit `a63d0d6a` for detail.
- Clean-master worktree verification (`/d/mi-core-phase6d-postmerge` at
  `af50e33c...`): `npm ci`, `npm run build`, `npx tsc --noEmit` (server), `tsc -b`
  (command-center) — all clean.
- `phase6d:acceptance` (444-scenario evaluation + 7 fixture scenarios), `phase6a:acceptance`,
  `phase6c:acceptance` — all PASS at the merged head.
- Predeploy backup: `D:\mi-core-production-backups\phase6d-predeploy-20260811-223834`
  (personal-os.db, projects.db, tasks.db read-only online backups; .env; deployed-source
  markers; production git HEAD note; authority-manifest.json snapshot; server/dist and
  command-center/dist snapshots; checksum manifest; db-integrity.json — all integrity
  `ok`, 0 FK violations, schema v10).
- Deployed exact reviewed artifacts: `server/dist` and `command-center/dist` copied from
  the clean `af50e33c` worktree into the production root; `MI_DEPLOYED_SOURCE_SHA`
  updated to `af50e33c5db91b901551729406fca730c6c3f235`; only `mi-core` restarted (new
  PID, restart count 17; every other PM2 process untouched — same PID/uptime as before).
- Production functional verification, all against **real production data**, all
  read-only:
  - `/api/health`: 200, server/python_ai_service/ollama all `ok`.
  - `/api/evidence` (authenticated): 200, real records from Controlled Actions,
    Governance, Delegation, Knowledge, Task Runtime — e.g. 1 real pending approval,
    2 real failed knowledge-ingestion jobs, 2 real quota-exhausted delegations.
    Confirmed `redactionClass` values present in the response are exclusively
    `OPERATOR_SAFE`/`PUBLIC_SAFE` — no `SENSITIVE`/`SECRET_NEVER_RENDER` leakage.
  - `/api/evidence/conflicts`: 200, `{"conflicts":[]}` (no real open conflicts today).
  - `/api/evidence/digest/2026-08-11`: 200, well-formed real counts.
  - `/command-center/` and its built JS bundle: 200.
  - `personal-os.db` live integrity: `ok`, 0 FK violations, schema v10 (unchanged —
    Phase 6D introduces no migration).
  - `mi-core` post-restart error log: no new errors after the restart timestamp. One
    pre-existing, unrelated alert ("Evidence DB DOWN") found in the log predates this
    deploy by ~6 hours and refers to `company-os/evidence-store.ts`'s `evidence.db` —
    an explicitly out-of-scope, unrelated subsystem per
    `docs/architecture/PHASE6D_EVIDENCE_AUDIT.md`'s scope decision, not Phase 6D's new
    `server/src/evidence/` module.

## The blocker

`GET /api/authority/status` and `GET /api/authority/manifest` — the Phase 6A canonical
authority manifest, used throughout this whole program as the authority-boundary
source of truth — returned counts **identical to the pre-Phase-6D (Phase 6C) baseline**
(`total: 1039, readOnly: 645, mutations: 394, canonical: 661, internalTest: 65, ...`),
even though Phase 6D's 5 new read-only GET routes are demonstrably deployed and working
(see the functional verification above). The manifest does not know they exist.

Root cause, traced and confirmed:

- `authority-control-plane/router.ts`'s live `/authority/status` and `/authority/manifest`
  handlers call `generateAuthorityManifest(serverRoot())`, where
  `serverRoot() = path.resolve(__dirname, '../..')` — resolved from the **running
  compiled file's location** (`server/dist/authority-control-plane/router.js`), which
  resolves to `D:\Project\Mi-core-system\Master\mi-core\server`.
- `generateAuthorityManifest()` → `discoverMountedRoutes()` then **parses the
  TypeScript source file** at `<that path>/src/index.ts` — not the compiled `dist`,
  and not any dedicated "reviewed source" snapshot — to statically discover which
  routes exist.
- The production root `D:\Project\Mi-core-system\Master\mi-core` is the same physical
  checkout the governing directive's Environment Note warns is running an **unrelated,
  disjoint, in-progress workstream**: currently on branch `codex/phase10-2-reality-closure`
  (HEAD `1db12eb3`), with **3499 modified/untracked files** relative to that branch's
  own history. Verified directly: `server/src/evidence/` does not exist in this
  checkout, and `server/src/index.ts` there contains zero occurrences of
  `evidenceRouter`.
- `.env` defines `MI_DEPLOYED_SOURCE_ROOT=D:\Project\Mi-core-system\Master\mi-core` —
  but this variable is **never actually read** anywhere in `authority-control-plane/*.ts`
  (confirmed by search); every call site defaults to `process.cwd()` or a
  `__dirname`-derived path, both of which land on the same messy checkout. The env var
  is currently documentary only, not wired into the scanner's root resolution.

Net effect: the compiled, deployed, and functionally-verified `dist/` is correct and
matches the reviewed PR exactly (confirmed by an empty `git diff` between the merge
commit and the reviewed PR head, and by every `dist/evidence/*.js` file being present
post-deploy). But the **authority manifest — the governance system's own source of
truth for "what surfaces exist and how are they classified" — is reading stale,
unrelated source and does not reflect this deploy at all.** This is precisely the
`source/dist/manifest provenance mismatch` the governing directive names as a
program-level stop condition, independent of whether this specific instance happens to
be benign (it is: no new mutation surface was silently introduced — the 5 new routes
are all read-only GETs, already correctly enforced by the same
auth/rate-limit/ip-guard chain as every other route). The concern is structural: the
manifest can silently drift from deployed reality, and nothing in the current
architecture detects that drift automatically.

**I did not attempt to fix this by writing into the production checkout.** That
checkout has 3499 modified/untracked files from an unrelated, uncommitted workstream;
overwriting even a single file there (`server/src/index.ts`) without knowing whether
it carries in-progress Phase 10 changes would risk destroying that work, which the
governing safety rules explicitly prohibit doing without investigation and explicit
authorization. I also did not attempt a same-session code fix to the scanner's root
resolution (e.g., wiring in `MI_DEPLOYED_SOURCE_ROOT` to point at a dedicated,
deploy-synced, reviewed-source-only directory) because that is itself a nontrivial
architecture change to Phase 6A's canonical authority tooling and deserves its own
review, not an improvised change during a closure step.

## What this means for the program

Per the governing directive: `PROGRAM STOP CONDITIONS` explicitly lists
`source/dist/manifest provenance mismatch` and instructs `Do not skip to the next
phase` / `STOP THE ENTIRE PROGRAM immediately`. Accordingly:

- Phase 6D is **merged and deployed**, and its own functionality is **production-verified
  and working correctly** — but Phase 6D is **not declared frozen**, because the
  condition "no blocker" is not met.
- **Phase 6E is NOT STARTED.** The directive's auto-continue condition ("If Phase 6D is
  fully merged, deployed, production-verified, documented, and frozen with no blocker,
  continue automatically into Phase 6E") is not satisfied.
- No rollback is required: the deployed code is correct, tested, and safe. This is a
  governance-tooling observability gap, not a functional or security defect in what
  shipped.

## Recommended resolution (not performed — needs an explicit decision)

One of, chosen by the user:

1. **Wire `MI_DEPLOYED_SOURCE_ROOT` into the scanner.** Make
   `authority-control-plane/scanner.ts`/`router.ts` resolve `repoRoot` from
   `process.env.MI_DEPLOYED_SOURCE_ROOT` when set, falling back to the current
   behavior otherwise — then have every future deploy sync a read-only, reviewed
   `server/src` snapshot to a **dedicated, deploy-owned directory** (separate from the
   messy production checkout) and point that env var at it.
2. **Sync `server/src` into the production checkout, carefully.** Requires first
   fully understanding what is safe to touch inside those 3499 modified/untracked
   files — out of scope to improvise here.
3. **Accept the manifest as advisory-only for now** and document the limitation
   explicitly in Phase 6A's own docs, with an explicit acknowledgment that manifest
   counts may lag actual deployed surfaces until (1) or (2) is done.

No production rollback needed either way — this only affects observability accuracy
in `/api/authority/status`, not the actual deployed governance behavior.
