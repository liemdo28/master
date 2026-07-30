# SEO Control Center CI Hardening Plan

Status: BLOCKED_PENDING_CEO_APPROVAL

This document is a proposed implementation plan only. No live CI workflow, production website deploy, GBP profile, public post, or live article was changed.

## Bakudan Ramen

| Area | Proposed control |
|---|---|
| Source of truth | Confirm `D:\Project\Master\Bakudan\bakudanramen.com-current` and its GitHub remote/docroot mapping before touching CI. |
| Preview deployment | Add a non-production preview target under a separate DreamHost directory or static preview host. |
| Approval gate | Require CEO approval artifact with content ID, preview URL, diff, rollback ID, and expiration. |
| Build gate | Run the static HTML validation used by `bakudan-publisher.ts`, plus link, metadata, schema, and sitemap checks. |
| Test gate | Run SEO security suite, publisher preview harness, and mobile screenshot smoke before deploy. |
| Snapshot | Store checksums of every target file before publish in `seo_publish_snapshots`. |
| Production deploy | Keep disabled until preview + approval + checks pass. Deploy only from an approved release branch/tag. |
| Post-deploy verification | Fetch live URL, check HTTP 200, canonical, title/meta, schema JSON, internal links, robots/sitemap visibility, and mobile render. |
| Automatic rollback | If post-deploy verification fails, restore snapshot and re-check checksum. |
| Manual rollback | Document one-command rollback by snapshot ID plus DreamHost file restore fallback. |
| Environment separation | Separate preview credentials/path from production credentials/path. |
| Secret handling | Move deploy secrets to GitHub environment secrets with production environment protection; never store in repo. |

## Raw Sushi

| Area | Proposed control |
|---|---|
| Source of truth | Confirm `D:\Project\Master\RawSushi\RawWebsite`, the deployed `public/` path, and whether root HTML copies are legacy. |
| Preview deployment | Generate Markdown frontmatter drafts under a preview content directory, then run the real site render/build against preview only. |
| Approval gate | Require CEO approval after rendered preview, not just raw Markdown frontmatter. |
| Build gate | Run the site build/render pipeline, frontmatter schema validation, link checks, title/meta checks, and generated schema checks. |
| Test gate | Run publisher harness, mobile screenshot smoke, and regression checks for existing `public/content/posts`. |
| Snapshot | Snapshot target Markdown and generated rendered page/checksum before any approved write. |
| Production deploy | Keep blocked until the CI path proves preview and rollback with the deployed `public/` source-of-truth. |
| Post-deploy verification | Fetch rendered live article, verify metadata, schema, links, mobile layout, and indexability. |
| Automatic rollback | Restore previous Markdown/rendered assets if live verification fails. |
| Manual rollback | Provide snapshot ID restore command and Cloudflare/DreamHost manual fallback depending on final hosting truth. |
| Environment separation | Separate preview and production branches, hostnames, deploy tokens, and data directories. |
| Secret handling | Store Google, Cloudflare, hosting, and analytics secrets only in protected environment variables. |

## CEO Approval Required Before Live Change

1. Approve source-of-truth repo and deployment target for each site.
2. Approve adding/modifying CI workflow files.
3. Approve preview hosting destination and credentials.
4. Approve production deploy gate and rollback procedure.
5. Approve first controlled production publish after preview evidence is reviewed.

