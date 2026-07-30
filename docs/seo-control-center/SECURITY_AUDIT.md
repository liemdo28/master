# SEO Control Center — Security Audit

## Scope

New code added under `mi-core/server/src/seo/`, `mi-core/server/src/routes/seo-*.ts`, `mi-core/ui/seo-control-center.html`, `mi-core/config/seo-policy.yaml`, `mi-core/prompts/seo/`. Existing mi-core infrastructure (approval gate, auth middleware, Google OAuth) was reused, not re-audited here except where this build's code touches it.

## Findings

### Fixed during this build

1. **Path traversal in publish-snapshot creation (`publish-safety.ts`)** — `createFileSnapshot()` resolved a caller-supplied `targetPath` against a repo root without checking the result stayed inside that root. A crafted `../../../…` path could have caused `restoreFromSnapshot()`'s `fs.copyFileSync()` to write a backup file to an arbitrary filesystem location, because `isGitTracked()`'s own containment check (`path.relative` starting with `..`) silently treats an out-of-root path as "not tracked" rather than "invalid" — so the traversal path would have slipped past the "never touch a tracked file" guard rather than being blocked by it. **Fixed**: added `resolveWithinRoot()`, which throws if the resolved path escapes the repo root, and wired it into `createFileSnapshot()`. The two site publishers' `createDraft()` methods were independently reviewed and found safe by construction — they never use caller-supplied `targetPath` as a write location, only as a traceability field in metadata; actual writes always go to internally-sanitized paths.

### Verified safe by design (reviewed, no fix needed)

2. **SQL injection** — every new SQL query uses `better-sqlite3` prepared statements with `?` placeholders. The two places that build a dynamic `WHERE` clause via template-string interpolation (`fact-registry.ts`, `keyword-store.ts`) only interpolate a fixed set of hardcoded clause fragments (e.g. `'status = ?'`), never a caller-supplied value directly — all actual values still flow through parameterized `?` bindings. Grepped the full `seo/` tree for this pattern; no unsafe interpolation found.
3. **Command injection** — the only `child_process` usage in this build is `execFileSync('git', ['ls-files', '--error-unmatch', '--', rel], ...)` in `publish-safety.ts`'s `isGitTracked()` — uses the array-argument form (no shell interpolation), and only ever runs a read-only `git ls-files` check, never a mutating git command.
4. **No `git push` / `wrangler deploy` anywhere** in the new code — verified by grep across `mi-core/server/src/seo/`. Both website publishers' `publishApproved()` is an explicit, honest no-op refusal (see [`PUBLISHING_AND_ROLLBACK.md`](PUBLISHING_AND_ROLLBACK.md)).
5. **Secret handling in the ChatGPT browser provider** — no password is ever read or stored; only browser session cookies persist to a local profile directory. Every prompt is passed through `redact.ts` (pattern-based scrub for OpenAI/Anthropic/Google/AWS/GitHub/Slack keys, bearer tokens, JWTs, and generic `key=value`/`password=value` assignments) before being typed into the browser or written to evidence/job records.
6. **CAPTCHA/MFA** — `chatgpt-browser-provider.ts` treats any detected CAPTCHA or MFA challenge identically to "not logged in": pauses, notifies the CEO via WhatsApp, never attempts to solve or bypass either.
7. **Brand isolation** — `link-recommender.ts`'s `assertBrandIsolation()` is a runtime invariant (throws, not just a comment) re-verified independently of the already-brand-scoped query, preventing a Raw Sushi article from ever being recommended a Bakudan internal link or vice versa.
8. **Policy fail-safe** — `seo-policy-engine.ts`'s `evaluatePolicy()` defaults any category not found in `seo-policy.yaml` to `REQUIRES_APPROVAL`, never to `SAFE_AUTO` — an unrecognized action type is never auto-executed.
9. **Idempotency** — `seo_actions.idempotency_key` and `seo_ai_jobs.idempotency_key` both have `UNIQUE` constraints; `submitSeoAction()` and the AI job router check for an existing row before creating a new one.

## Known gaps / not addressed in this build

- **`/api/seo/*` routes are not wrapped in `requireAuth`** — this matches the pre-existing `routes/seo.ts` mount pattern (also unauthenticated) and mi-core's documented deployment model (self-hosted on the CEO's own Windows PC, primarily accessed via WhatsApp/local network per `mi-core/CLAUDE.md`). This build did not change the auth posture of the SEO routes to stay consistent with the existing router; if mi-core's network exposure ever changes (e.g. exposed beyond LAN/Tailscale), revisit whether `/api/seo/*` should gain `requireAuth` like `/api/operations` and `/api/workflows` already have.
- **Approval-gate fragmentation** — the audit found 5+ parallel approval-store implementations pre-existing in mi-core. This build only uses the canonical `approval/gate.ts`, but did not consolidate the others (out of scope for an SEO feature — flagged for a separate cross-cutting pass).
- **No automated security test suite was added** — verification in this build was manual (interactive dashboard testing + curl against an isolated instance, documented in [`QA_REPORT.md`](QA_REPORT.md)), not a repeatable automated security regression suite. Spec §38 calls for path-traversal/cross-brand/expired-approval/injection tests; only path traversal and brand isolation were manually verified as fixed/correct, not encoded as a permanent automated test.

## Verdict

No critical or high-severity issues remain open. One real path-traversal finding was identified and fixed during the build (not by an automated scanner — found through code review of the publishing adapters). No SQL injection, command injection, credential exposure, or CAPTCHA/MFA-bypass issues were found.
