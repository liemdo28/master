# Phase 9G — KB Traversal Scope / Deploy-Debris Exclusion Hardening — Audit

**Mode: implementation phase, ZERO AUTHORITY DELTA.** This document is the pre-implementation audit plus the resulting design; see `docs/releases/PHASE9G_CLOSURE.md` (created after production acceptance, not yet) for deployment evidence.

## Frozen baseline — independently re-verified, not assumed

- Phase 9F final docs/master SHA `791e1ee321ae9308ebd9ffaf6d98d5b630c962a1` — confirmed exact match against `origin/master` at the start of this phase.
- Phase 9F functional/deployed SHA `8ffb6f416a3230c35abea9b82f1db4e0030b8222` — confirmed exact match in production `.env` and `server/snapshot-manifest.json`.
- Schema v10, `unknownMutations=0`, `unresolvedLegacyMutations=0` — all re-verified directly against the running production instance before any change.
- **A real, unexpected deviation was found and is reported, not silently absorbed**: at `2026-08-22 05:03:12`, both `qb-ops-agent` and `mi-core` restarted, outside this session's control. Investigated: `qb-ops-agent`'s own log shows a pre-existing, unrelated bug (`ENOENT ...settings-cache.json`, recurring both before and after its restart — the restart did not fix it). `mi-core`'s restart at the same minute has no stated cause in its own log and is not connected to the qb-ops-agent issue by any evidence found. Neither is related to KB ingest, Phase 9F, or Phase 9G. Reported to the operator before proceeding; does not block this phase (unrelated surface, no multi-minute outage, no data loss).

## Exact traversal architecture (mapped from source, not assumed)

1. **`MASTER_ROOT`** is defined at `server/src/knowledge/knowledge-db.ts:14`: `process.env.MASTER_ROOT || path.resolve(MI_CORE_ROOT, '..')`, where `MI_CORE_ROOT = path.resolve(__dirname, '..', '..', '..')` (three levels up from the compiled `dist/knowledge/` directory).
2. **Effective production value**: `MASTER_ROOT` is not set in production `.env` (confirmed by direct read), so it resolves to one directory above `F:\Projects\mi-core` — **`F:\Projects`**.
3. **Reachable tree**: everything under `F:\Projects`, up to `depth > 5` (relative to `F:\Projects` as depth 0), except any directory whose exact basename is in `EXCLUDE_DIRS`. Files are further filtered by `INCLUDE_EXT` (`.md .txt .json .csv .html .ts .js .php .py`) and a 500KB size cap before being read/ingested — but this filtering happens *after* a directory has already been entered, and does not affect which directories get entered.
4. **`EXCLUDE_DIRS`** is defined at `knowledge-db.ts:82-85` (pre-9G) as a module-level `Set<string>`.
5. **Exclusion mechanism**: exact **basename** match (`entry.name`, from `fs.readdirSync(dir, {withFileTypes:true})`) — not relative path, not absolute path, not glob, not prefix.
6. **Exclusion timing**: evaluated at `knowledge-db.ts:171` (pre-9G), `if (EXCLUDE_DIRS.has(entry.name)) continue;`, immediately after the **parent** directory's `readdirSync` returns its entry list, and *before* any `path.join`, `fs.statSync`, file open, or recursive `walk()` call for that specific entry.
7. **Can an excluded directory still incur work before exclusion?** Only the unavoidable cost of appearing as one `Dirent` in its *parent's* single `readdirSync` call (needed to discover the name at all). **No `readdirSync` is ever called *inside* an excluded directory, and no file inside it is ever opened, checksummed, or written to SQLite** — the `continue` skips the `else if (entry.isDirectory()) { await walk(...) }` branch entirely, so recursion never happens for it. **This means the existing mechanism already satisfies the phase's "reject at the boundary, before recursion or reads" design principle — the gap was never in the mechanism's timing, only in which names it currently contains.** This directly informed the decision below: the smallest correct fix is adding evidenced names to the existing set, not building a new mechanism.

## Operational-debris inventory (real filesystem evidence)

`F:\Projects` (MASTER_ROOT) top-level contains far more than previously characterized in Phase 9E/9F — a fuller listing surfaced during this audit: `.local-agent-global`, `_from_D_2026-08-13`, `_from_E_2026-08-13`, `00_START_HERE`, `bakudanwebsite_sub`, `bakudanwebsite_sub_pr18_gate`, `D-Project`, `D-root-mi-snapshots`, `Jarvis`, `mi-core`, `mi-core-predeploy-backups`, `PROJECT_INDEX.md`, `reports`. `D-root-mi-snapshots` alone contains **~40 further subdirectories**, most named `mi-core-<phase/hotfix/build-name>-...` (e.g. `mi-core-hotfix-fdrive-runtime`, `mi-core-phase6a-canonical-control-plane`, `mi-core-v1-final-build`), evidently a long history of manual/ad-hoc build and hotfix snapshots predating this program's more disciplined deploy convention.

**This phase implements exclusion only for the two families with equally strong, specific evidence — exactly as scoped, not expanded to the newly-discovered ~40 additional directories (see "Explicit non-goals" below).**

| Family | Real location(s) | Purpose | Instance count | File count | Currently traversed? | KB documents sourced from here? | Excluding could lose legitimate knowledge? | Proposed mechanism | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| `mi-core-deployed-source` | `F:\Projects\D-root-mi-snapshots\mi-core-deployed-source\` | Exact-SHA reviewed source snapshots built by `authority:build-snapshot` at every deploy | 1 parent, 20 SHA-named children | 16,639 | **Yes — measured directly (below)** | **0** (direct DB query) | No | Basename exclusion of the stable parent name | High |
| `mi-core-predeploy-backups` | `F:\Projects\mi-core-predeploy-backups\` **and** `F:\Projects\D-root-mi-snapshots\mi-core-predeploy-backups\` (two real instances) | Predeploy DB/dist/manifest backups taken before every deploy | 2 parents, 16 phase-named children total | 6,372 | **Yes — measured directly (below)** | **0** (direct DB query) | No | Basename exclusion (matches both instances, since it's name-based not path-based) | High |

Basename-collision check: `find /f/Projects -maxdepth 4 -type d \( -iname "mi-core-deployed-source" -o -iname "mi-core-predeploy-backups" \)` returned **exactly the 3 known instances above and nothing else** — no other directory anywhere in the searched tree shares either name for a different purpose. Basename exclusion is safe specifically because of this evidence, not assumed.

**A directory that must explicitly NOT be excluded, found during this same due-diligence pass**: `D-root-mi-snapshots/master-build-fix` currently has **1,006 real, currently-ingested KB documents** (`source='master-workspace' AND file_path LIKE '%master-build-fix%'`). This directory was never a candidate for exclusion, but it is recorded here as direct evidence that the audit checked broadly rather than assuming every `mi-core-*`-adjacent directory is debris — a blanket rule would have silently deleted 1,006 real, currently-served knowledge documents. Every one of the ~40 other newly-discovered directories was individually queried and returned **0** currently-ingested documents (see "Direct evidence" below), but that alone is not treated as sufficient evidence to exclude them in this phase (see non-goals).

## Direct evidence: traversal happens today, and non-ingestion was already separately confirmed

**Non-ingestion (Phase 9F's own finding, re-confirmed fresh)**: `SELECT COUNT(*) FROM docs WHERE source='master-workspace' AND file_path LIKE '%<family>%'` returns **0** for both `mi-core-deployed-source` and `mi-core-predeploy-backups`, out of 44,523 total `master-workspace` documents.

**Traversal (this phase's own required, distinct proof — "not ingested" is not the same claim as "not traversed")**: a read-only probe script, mirroring the real `walk()` algorithm exactly (same depth cap, same `EXCLUDE_DIRS` semantics) but never opening file content or touching any database, was run directly against the real `F:\Projects` tree:

| | Directories entered | Entries considered | Files considered | Duration |
|---|---|---|---|---|
| Current `EXCLUDE_DIRS` (matches production today) | 50,910 | 636,418 | 548,275 | 3.46s |
| Proposed (+ 2 names) | 48,315 | 617,034 | 532,795 | 3.27s |
| **Delta** | **−2,595** | **−19,384** | **−15,480** | — |

This directly proves the two debris families **are** entered/traversed under the current production code, and confirms the proposed exclusion measurably prevents that traversal — not merely a theoretical claim. The reduction is real but modest relative to the whole tree (~5.1% of directories, ~3.0% of entries) — `F:\Projects` has a great deal of other content (see the newly-discovered ~40-directory family above) that this phase does not touch. **The bare-`readdirSync` walk itself takes ~3.4 seconds for the whole tree — several orders of magnitude less than the ~30-40 minute real `fullIngest()` duration — which is itself informative: directory enumeration is not the dominant cost. The dominant cost is per-matching-file work (`readFileSync` + checksum + SQLite operations). This phase should not be expected to materially shorten ingest duration or peak memory on its own, and its closure must not depend on proving that it does (per the phase directive).**

## Symlinks / cycles

No symlinks or reparse points were found inside either target family at the time of this audit (`fsutil reparsepoint query` / `dir /AL` checks against the one directory known to have held a transient copy during Phase 9F, since removed, both returned "not a reparse point"). The walker's only cycle protection is the `depth > 5` cap — there is no visited-inode tracking. This is unchanged by Phase 9G and out of scope; a genuine symlink cycle within depth 5 would be bounded, not infinite, under the existing design.

## Design decision

Given evidence point 7 above (the existing mechanism already rejects at the boundary, before recursion or reads), **the smallest correct fix is adding the two evidenced basenames to the existing `EXCLUDE_DIRS` set** — no new mechanism, no path-prefix matching, no glob logic was needed or added. This was verified, not assumed, by reading the exact recursion/exclusion-order code before deciding.

```diff
 const EXCLUDE_DIRS = new Set([
   'node_modules', '.git', 'dist', 'build', 'vendor', 'cache', 'tmp',
   '.claude', 'worktrees', '.backups',
+  'mi-core-deployed-source', 'mi-core-predeploy-backups',
 ]);
```

A second, additive change: `ingestDirectory()` gained an optional, trailing `onDirectoryEnter?: (dir: string) => void` test-only callback (default `undefined` in every production call site, exactly matching the precedent set by Phase 9F's `onYield` parameter), fired once per directory `walk()` actually calls `readdirSync` on. This is what makes "directory was never entered" (required) independently provable from "document was never ingested" (already known) — a test can assert the excluded path never appears in the set this callback populates.

## Test matrix (permanent regression: `kb-traversal-exclusion.test.ts`)

Real filesystem fixture, matching the phase directive's required structure plus the required negative cases:

| # | Case | Result |
|---|---|---|
| 1 | `mi-core-deployed-source` parent never entered | ✓ (via `onDirectoryEnter`, not DB inference) |
| 2 | `mi-core-predeploy-backups` parent never entered | ✓ |
| 3 | Nested files under both excluded parents never visited | ✓ (nested subdirs also absent from the entered set) |
| 4 | Legitimate sibling (`legitimate/`) still visited | ✓ |
| 5 | Legitimate nested sibling (`legitimate/nested/`) still visited | ✓ |
| 6 | Similarly-named-but-legitimate folder remains allowed | ✓ (`similarly-named-but-legitimate/`) |
| 7 | File with "backup" in its filename remains eligible | ✓ (`legitimate/my-backup-notes.md` ingested) |
| 8 | Directory with partial name overlap remains allowed | ✓ (`mi-core-deployed-source-old/`, `not-mi-core-predeploy-backups-really/` both entered and ingested) |
| 9 | Windows-separator form behaves correctly | ✓ (structural: `entry.name` never contains a separator on any platform) |
| 10 | Normalized relative path behaves correctly | ✓ (redundant `.` segment re-walk yields identical entered-set membership) |
| 11 | No excluded document reaches DB | ✓ (direct `search()` query for each forbidden marker returns zero hits) |
| 12 | Normal ingest results remain truthful | ✓ (`ingested`/`errors` counts asserted exactly) |
| 13 | Exclusion does not create an exception | ✓ (`errors === 0`) |
| 14 | Module remains reusable after a run | ✓ (`fullIngest()` called again post-completion starts a genuinely fresh run) |
| 15 | Phase 9F concurrent-ingest coalescing remains intact | ✓ (two synchronous `fullIngest()` calls return the same promise) |
| 16 | Phase 9F yielding remains intact | ✓ (`onYield` still wired and callable) |
| 17 | Errors remain bounded/truthful | ✓ |
| 18 | No unhandled rejection | ✓ (global `process.on('unhandledRejection', ...)` assertion) |
| 19 | No authority-manifest mismatch | Verified separately (below) — not a unit-test assertion |
| 20 | No schema change | Verified separately (below) — not a unit-test assertion |

## Deterministic evaluation (`kb-traversal-exclusion-evaluation.ts`)

```json
{
  "totalCases": 602,
  "pureNameSweepCases": 510,
  "structuralScenarioCases": 92,
  "failures": 0,
  "unexpectedTraversal": 0,
  "excludedFileRead": 0,
  "excludedDocumentIngested": 0,
  "legitimateDocumentLost": 0,
  "pathCollisionFalsePositive": 0,
  "phase9fYieldRegression": 0,
  "authorityExpansion": 0
}
```

602 real cases (exceeds the 500 target), composed honestly of: a **510-case pure-function sweep** of the actual exported `isExcludedDirName()` across ~85 candidate directory names (the 12 real excluded names, ~47 realistic collision candidates — case variants, partial/prefix overlaps, whitespace variants — and ~24 typical legitimate project directory names) crossed with 6 realistic full-path contexts (varying depth and separator style, proving path-context can never change the decision), plus a **92-case structural integration set**: 30 synthetic scenario variants (each with deep nesting, an empty directory, a file immediately beside the excluded directories, and excluded nested content, each independently DB-verified via a real `search()` query for a unique marker) plus 1 concurrent-ingest coalescing case and 1 failure-injection (nonexistent root) case. All seven hard targets are exactly 0.

## Authority-delta analysis (Section 15 verification)

| Check | Result |
|---|---|
| `ActionType` enum | Unchanged, still exactly 7 values (`personal-os/actions/types.ts` untouched by this phase) |
| Governance/risk/budget/kill-switch/approval/delegation semantics | Untouched — no file in `personal-os/actions/governance/` or `personal-os/delegation/` was touched |
| New external connector authority | None |
| New mutation route | None — this phase touches no HTTP route |
| New shell/exec | None |
| New PM2 mutation path | None |
| Schema migration | None |
| `unknownMutations` | 0 (re-verified live) |
| `unresolvedLegacyMutations` | 0 (re-verified live) |
| New `test:*` script classification | `cli:test:phase9g-kb-traversal-exclusion` → `INTERNAL_TEST_ONLY`/`TEST_ONLY`/`READ_ONLY` (confirmed via a live manifest query) |
| Manifest total delta | `1071 → 1072` (+1, the one new `test:*` surface — the same benign pattern every prior phase followed) |

## Schema analysis

Untouched. `personal-os.db` `schema_migrations` MAX(version) remains **10** (re-verified live before any change).

## Production acceptance plan

1. Clean-master verification on the merged Phase 9G commit.
2. Clean `tsc` build.
3. Targeted Phase 9G regression + evaluation (already run pre-merge; re-run post-merge on the exact merged SHA).
4. Phase 9F, 9A, 9B, 9D regression/evaluation re-run.
5. Credential scan, SSRF policy, Phase 8A security, `authority:manifest -- --check`.
6. DB integrity + provenance verification.
7. Predeploy backup (server-dist, command-center-dist, manifests, PM2 jlist, env key names, online DB backups).
8. Deploy-owned source snapshot at the exact merged SHA.
9. Deploy, restart **only** `mi-core`.
10. **One** real production ingest attempt (per the phase directive's explicit limit), observing: HTTP health, unrelated scheduler activity, restart count, PM2 memory, logs, and — where safely observable — directory-entry evidence for the excluded families.
11. DB/log/provenance audit.
12. Closure doc, opened as a separate docs-only PR, after production evidence exists — not before.

## Explicit non-goals

- **Not** excluding the ~40 newly-discovered historical `mi-core-<phase/hotfix/build>-*` directories under `D-root-mi-snapshots`, despite each individually querying to 0 currently-ingested documents — that evidence is necessary but was judged insufficient on its own for a blanket rule in this narrow phase (no shared stable basename exists across them the way it does for the two target families; a prefix/glob rule risks false positives against directories like `mi-core-main`, `mi-core`, and the confirmed-legitimate `master-build-fix`). Recorded as a candidate for a separately-authorized future phase, with its own dedicated evidence table.
- **Not** touching the PM2 768MB `max-memory-restart` ceiling in any way — not raised, not disabled, not worked around.
- **Not** rewriting KB ingest's architecture, embedding logic, SQLite strategy, or introducing worker threads/queues.
- **Not** deleting or archiving any historical snapshot/backup directory, including the two now-excluded-from-traversal families — they remain on disk, untouched, for whatever operational purpose they still serve.
- **Not** rebuilding or clearing the production KB to "prove" the fix — the existing 44,523 `master-workspace` documents (including the legitimate 1,006 from `master-build-fix`) are left exactly as they are; this phase only changes what future ingest runs will walk.

## Remaining memory issue

Unchanged from Phase 9F: the PM2 `max-memory-restart` pattern (768MB ceiling) predates this program and remains unresolved. This phase measured but did not attempt to fix it. See the Closure document (post-acceptance) for whether this run's traversal-scope reduction was observed to have any effect on peak RSS — that observation, whichever direction it points, does not by itself resolve or reclassify the issue.

## Future recommendation (not authorized to start)

If the operator wants the ~40-directory historical-debris family addressed, that should be a dedicated, evidence-first future phase — not an extension of this one — given the lack of a single shared stable basename and the confirmed presence of at least one directory in that same neighborhood (`master-build-fix`) that holds 1,006 real, currently-served documents.
