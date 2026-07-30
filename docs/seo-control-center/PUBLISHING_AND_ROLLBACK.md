# Publishing and Rollback

## Current state: production publishing is intentionally disabled

Both website publishing adapters (`mi-core/server/src/seo/publishing/bakudan-publisher.ts`, `raw-sushi-publisher.ts`) implement `publishApproved()` as an **honest refusal**, not a stub pretending to work:

```
production_deploy requires the site CI/deploy pipeline to be hardened first —
see INITIAL_AUDIT.md open questions; this adapter intentionally does not push
to production
```

This is deliberate. The Phase 0 audit found:
- **Bakudan**: `.github/workflows/deploy.yml` SCPs straight to production on every push to `main`, with no build, no preview environment, and no rollback step.
- **Raw Sushi**: two non-identical copies of the site (root loose HTML files vs. the actually-deployed `public/` directory) and two conflicting `_redirects`/Wrangler configs.

Publishing automation was intentionally **not** wired to actually deploy until a human decides how to harden each site's CI/deploy pipeline. See the open questions in [`INITIAL_AUDIT.md`](INITIAL_AUDIT.md).

## What the adapters do today

1. **`createDraft(contentId, html, targetPath)`** — writes new content to a NEW, untracked path only (e.g. `Bakudan/bakudanramen.com-current/blog-drafts/`). It refuses (throws) if `targetPath` resolves to a git-tracked file — you cannot accidentally overwrite a live page through this path.
2. **`createPreview(draftPath)`** — Bakudan: a basic HTML well-formedness check + copy into `.seo-preview/` (honest, since the site has no real build tooling — its own `package.json` build script is literally `echo No build step required`). Raw Sushi: validates against the site's own existing `public/content/posts/*.md` frontmatter schema.
3. **`createSnapshot(targetPath)`** — backs up the current file (if one exists at that path) to a timestamped path before any future overwrite, and records a `seo_publish_snapshots` row.
4. **`publishApproved(snapshotId)`** — refuses, as described above. Still routes the *attempt* through the approval bridge (`production_deploy` category, REQUIRES_APPROVAL, L3 double-confirm) so the evidence/approval trail is real even though execution is blocked.
5. **`rollback(snapshotId)`** — restores a backup file. This one genuinely works, but only ever touches files the adapter itself created or backed up — it refuses outright (checks `git ls-files`) if the resolved path is git-tracked.

## Turning on real production publishing (future work, not done in this build)

Before `publishApproved()` can be safely implemented for real:
1. Bakudan's `deploy.yml` needs a build/preview stage and a way to gate the SCP step behind an explicit approval (not just "push to main").
2. Raw Sushi's root-vs-`public/` duplicate trees and the two conflicting `_redirects`/Wrangler configs need to be reconciled into one canonical source.
3. Both adapters' `publishApproved()` bodies need to be rewritten to call the (hardened) real deploy mechanism, still gated behind the existing `production_deploy` approval category — the approval/evidence plumbing already in place does not need to change.

This is explicitly **out of scope** for this build per the task's safety constraints (no CI/deploy config edits, no `git push`, no `wrangler deploy` from this codebase).
