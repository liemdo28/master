# SEO Config Path Consolidation

**Status:** Fixed 2026-07-13
**Scope:** `brands.json` / `locations.json` duplication between mi-core and the standalone SEO orchestrator

## The problem

Two independent codebases each read their own copy of brand/location config:

1. **mi-core's Express server** (`mi-core/server/src/seo/brand-config.ts`, the live
   SEO Control Center on port 4001) reads:
   - `${MI_CORE_ROOT}/SEO/shared/config/brands.json`
   - `${MI_CORE_ROOT}/SEO/shared/config/locations.json`

   With production's `mi-core/ecosystem.config.js` setting
   `MI_CORE_ROOT=D:/Project/Master/mi-core`, these resolve to:
   - `D:\Project\Master\mi-core\SEO\shared\config\brands.json`
   - `D:\Project\Master\mi-core\SEO\shared\config\locations.json`

2. **The older, standalone multi-agent SEO orchestrator** at repo root
   (`D:\Project\Master\SEO\` — a *different* codebase, not mi-core's Express
   server; its own processes live in `SEO/seo-analytics-agent/`,
   `SEO/seo-content-agent/`, etc. and import config via
   `SEO/shared/config/index.js`, and `SEO/shared/base/validate-brand-config.js`
   validates it directly) reads its own copy at:
   - `D:\Project\Master\SEO\shared\config\brands.json`
   - `D:\Project\Master\SEO\shared\config\locations.json`

Both copies were manually edited during a prior session to fix a schema bug
and add missing Raw Sushi location data (Stockton + Modesto). There was no
mechanism keeping them in sync and no test that would catch divergence — so
the two copies could (and did) drift apart with no warning.

## Which copy is canonical, and why

**`mi-core/SEO/shared/config/` is canonical.** Evidence, read directly from
both files before making this call:

| | mi-core copy (canonical) | root copy (legacy) |
|---|---|---|
| Brands | 3 (`bakudan`, `raw_sushi`, `test_brand_3`) | 2 (missing `test_brand_3`) |
| Connector detail | Full objects: `gsc_site_url`, `ga4_property_id`, `measurement_id`, `gbp_account_id`, `last_success_at`, `last_error` | Bare `{ "status": "..." }`, no live IDs |
| Real GSC site URL | `sc-domain:bakudanramen.com`, `sc-domain:rawsushibar.com` | absent |
| Real GA4 IDs | `properties/543110659` / `G-3GZ2RYDR6M`, `properties/532604616` / `G-WNHH66NT41` | absent |
| GBP status | `quota_limited` (reflects a real, observed API quota error on 2026-06-26) | generic `missing_credentials` |
| Bakudan locations (Bandera / Stone Oak / The Rim) | `status: "active"`, real category tags | `status: "needs_location_config"`, address/phone/GBP-place-id are literal `PLACEHOLDER_*` strings |
| Raw Sushi locations (Stockton / Modesto) | Real addresses, phones, order URLs | Same real data (this part had already been hand-copied forward) |
| `version` / `updated_at` fields | Present, versioned | Absent |

The mi-core copy is what the actual running server (port 4001, the CEO's
live SEO Control Center / dashboard) reads today, and it is materially more
complete and more current. The root copy still has three Bakudan locations
in placeholder/unconfigured state and is missing `test_brand_3` entirely.
There is no scenario where the root copy has data the mi-core copy lacks —
confirming mi-core's copy should be the single source of truth.

## Mechanism chosen: sync script, not a filesystem symlink/junction

The task's preferred option was a real Windows symlink or junction from the
root copy to the canonical copy. This was tested and evaluated:

- **Directory junction (`mklink /J`)** is not viable at the directory level:
  `SEO/shared/config/` (root) also contains `index.js`, `keywords.json`,
  `pages.json`, `directories.json` — files the standalone orchestrator's
  agents (`seo-analytics-agent`, `seo-content-agent`, etc., via
  `require('../shared/config')`) depend on that have **no equivalent** in
  the mi-core copy. Turning the whole directory into a junction would either
  delete those files or require moving them elsewhere — out of scope and
  against the hard constraint not to delete either copy's directory.
  Windows junctions only work on directories, not individual files, so a
  file-level junction for just `brands.json`/`locations.json` isn't possible
  either (`mklink /J` requires a directory target).

- **Per-file symlink** (`mklink` / `fs.symlinkSync(..., 'file')`) *was*
  successfully created and verified working, without elevation, in this
  environment (`fs.lstatSync(...).isSymbolicLink() === true`, confirmed via
  `dir` showing `<SYMLINK>`). However, this repo has:

  ```
  $ git config --get core.symlinks
  false
  ```

  With `core.symlinks=false`, Git does not materialize real filesystem
  symlinks on checkout — it writes a **plain text file containing the link
  target path string** instead. Any future `git checkout`, `git reset`, or
  `git stash` touching these paths in this environment would silently
  replace the working symlink with a text file like
  `D:\Project\Master\mi-core\SEO\shared\config\brands.json`, which is not
  valid JSON — corrupting the file the moment any consumer tried to
  `JSON.parse()` it. Changing `core.symlinks` was not an option (git config
  changes are off-limits for this fix). This makes a committed symlink
  **not reliable** in this repo, even though it works today on this
  machine's live filesystem.

**Chosen mechanism: `SEO/shared/config/sync-from-canonical.js`** — a small,
dependency-free Node script that:

- Reads canonical `${MI_CORE_ROOT}/SEO/shared/config/{brands,locations}.json`
  (respecting `MI_CORE_ROOT`, same env var `brand-config.ts` already uses).
- Validates the canonical content is parseable JSON before propagating it
  (never mirrors a half-written/corrupt canonical file).
- Copies it over the root mirror copy only if content differs (idempotent,
  no unnecessary writes/timestamp churn).
- Is both a CLI (`node sync-from-canonical.js`) and a requirable module
  (`module.exports = syncFromCanonical`) for programmatic use.

It is wired into `SEO/shared/base/validate-brand-config.js`, which now runs
the sync **before** validating, so a stale/hand-edited root copy is
auto-corrected rather than silently validated as outdated data. Any run of
the existing validator (`node SEO/shared/base/validate-brand-config.js`)
therefore keeps the mirror honest as a side effect.

## Compatibility: legacy code keeps working

- `mi-core/server/src/seo/brand-config.ts` is unchanged in its exported
  function signatures. It still reads the canonical path first
  (`${MI_CORE_ROOT}/SEO/shared/config/`) — that priority is **not**
  inverted. Two additive-only changes were made:
  1. A one-time console warning if `MI_CORE_ROOT` is unset, so a future
     ad-hoc/test run doesn't silently fall back to a hardcoded default path
     without anyone noticing (production's `ecosystem.config.js` already
     sets `MI_CORE_ROOT` explicitly, so this doesn't affect production).
  2. A documented, best-effort legacy fallback: if the canonical
     `brands.json`/`locations.json` is ever missing, the module falls back
     to reading the root (`D:/Project/Master/SEO/shared/config/`) mirror
     instead of silently loading zero brands/locations. This should rarely
     if ever trigger in steady state, since the mirror is kept in sync by
     `sync-from-canonical.js`.
- The standalone orchestrator (`SEO/seo-analytics-agent/`,
  `SEO/seo-content-agent/`, etc.) continues to import
  `SEO/shared/config/index.js` exactly as before — that file's location and
  exports (`locations`, `keywords`, `pages`, `directories`,
  `resolveSharedDbPath`, etc.) are untouched. Its `locations.json` now
  reflects canonical data because the underlying file it reads is kept in
  sync by `sync-from-canonical.js`, not because `index.js` itself changed.
- `SEO/shared/base/validate-brand-config.js` still reads
  `SEO/shared/config/{brands,locations}.json` at the same paths as before —
  only a pre-sync step was added at the top of the file.

## Runtime data path check (`.local-agent-global/seo/`)

Per the task, verified whether all SEO Control Center runtime data (SQLite
DB, evidence, ChatGPT browser profile) resolves consistently to one path
root, via `grep -rn "MI_DATA_DIR\|GLOBAL_DIR\|DATA_ROOT" mi-core/server/src/seo/`:

| File | Env var checked | Fallback default |
|---|---|---|
| `seo-db.ts` | `MI_DATA_DIR` | `D:/Project/Master/.local-agent-global` |
| `gbp-connector.ts` | `GLOBAL_DIR` | `D:/Project/Master/.local-agent-global` |
| `ga4-connector.ts` | `GLOBAL_DIR` | `D:/Project/Master/.local-agent-global` |
| `google-search-console-connector.ts` | `GLOBAL_DIR` | `D:/Project/Master/.local-agent-global` |
| `local/gbp-posts.ts` | `GLOBAL_DIR` | `D:/Project/Master/.local-agent-global` |
| `ai-providers/chatgpt-browser-provider.ts` | `MI_DATA_DIR` | `D:/Project/Master/.local-agent-global` |

**Finding:** these modules check **two different env var names**
(`MI_DATA_DIR` vs `GLOBAL_DIR`) for what is conceptually the same data
root, though every hardcoded fallback resolves to the identical path
(`D:/Project/Master/.local-agent-global`), and production's
`mi-core/ecosystem.config.js` sets **both** `GLOBAL_DIR` and `MI_DATA_DIR`
to that same value. So there is **no live divergence today** — but the
inconsistency is latent: if a future deployment (or a `.env` change) sets
one of these two var names without the other, `seo-db.ts` and
`chatgpt-browser-provider.ts` (which check `MI_DATA_DIR`) would silently
diverge from `gbp-connector.ts` / `ga4-connector.ts` /
`google-search-console-connector.ts` / `gbp-posts.ts` (which check
`GLOBAL_DIR`) — DB and Google-token/profile paths would resolve to
different directories. This is flagged as a finding per the task's
instructions, not fixed here: `seo-db.ts` is explicitly out of scope
(owned by a migration-system change that just landed), and fixing the
connector files would mean touching multiple files outside this task's
narrow scope (`brand-config.ts` + `__config_tests__/` only). A future,
scoped change should standardize all of these on a single env var name.

## Unrelated finding: validator's connector-status enum

Running `validate-brand-config.js` against the now-canonical (post-sync)
data surfaced a pre-existing, unrelated gap: its `requiredConnectors` status
allow-list (`ready | needs_config | missing_credentials | blocked | error |
not_applicable`) does not include `quota_limited`, which is a real status
now present in the canonical `brands.json` (reflecting an actual observed
Google Business Profile API quota error). This produces two `ERROR
invalid_connector_status` entries for `bakudan` and `raw_sushi`. This is a
validator enum gap, not a config-duplication problem, and is out of scope
for this fix — flagged here for whoever owns `validate-brand-config.js`
next.

## How to run the consistency test

```bash
cd D:\Project\Master
node mi-core/server/src/seo/__config_tests__/config-consistency.mjs
```

It loads both `brands.json` and both `locations.json` copies and asserts:
- same set of `brand_id`s in both copies
- same `status` per brand
- same set of `(brand_id, location_id)` pairs in both copies
- same `status` per location
- (informational) byte-identity of both files

Exits `0` on success, `1` with a diff-style failure list on divergence. If
it ever fails, the fix is:

```bash
node D:\Project\Master\SEO\shared\config\sync-from-canonical.js
```

which re-syncs the legacy mirror from the canonical mi-core copy. This is
also run automatically (silently, only logging on change/error) at the top
of `SEO/shared/base/validate-brand-config.js` every time that validator
runs.

## Files touched by this fix

- `SEO/shared/config/sync-from-canonical.js` — new sync script
- `SEO/shared/config/brands.json` — content synced from canonical (root/legacy mirror)
- `SEO/shared/config/locations.json` — content synced from canonical (root/legacy mirror)
- `SEO/shared/base/validate-brand-config.js` — added pre-sync step
- `mi-core/server/src/seo/brand-config.ts` — additive diagnostic warning + documented legacy fallback (no exported signature changes)
- `mi-core/server/src/seo/__config_tests__/config-consistency.mjs` — new automated consistency test
- `docs/seo-control-center/SEO_PATH_CONSOLIDATION.md` — this document

Neither `mi-core/SEO/shared/config/` nor `SEO/shared/config/` directories
were deleted — the root copy's *files* now derive their content from the
canonical copy via the sync script rather than being hand-maintained.
