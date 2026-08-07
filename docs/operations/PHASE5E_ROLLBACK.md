# Phase 5E — rollback

## The short version

Additive on both sides. The frontend is a brand-new static asset tree served at its own
path (`/command-center`); the only backend change is (a) a route-mount reorder fix and
(b) six new, additive `app.use()` bridge mounts. Nothing existing was removed, renamed,
or altered in behavior.

## Reverting the frontend only

Remove or stop serving `command-center/dist/` — delete the
`app.use('/command-center', express.static(...))` and
`app.get('/command-center/*', ...)` lines from `server/src/index.ts`, or simply leave
the static files undeployed. No database, no other route, and no other static asset
(`ui/*.html`) is affected either way.

## Reverting the backend bridge

Remove the block in `server/src/index.ts` under the `// ── Command Center bridge
(Phase 5E)` comment (six `app.use('/api/command-center/...', ...)` lines). This removes
Command Center's ability to authenticate against the backend; the frontend, if still
deployed, will show 404s for every API call and nothing else — it cannot fall back to
any other credential path, so there is no partial-broken state to worry about.

## Reverting the route-ordering fix

Not recommended — this fix restores the `/api/remote/login`, `/api/auth/login`, and
`/api/health` routes to the reachable, publicly-documented behavior every comment in
`index.ts` already claimed they had (`// /api/remote (has own auth), /api/health,
/api/auth, /api/nodes are public`). Reverting it re-breaks PIN login for `mobile.html`
and `liveboard.html` as well as Command Center. If it must be reverted for some other
reason, move the three-line block (`/api/remote`, `/api/auth`, `/api/health`) back to
its original location after the bare `/api` mounts — no other code depends on its
position.

## What rollback does not undo

Nothing outside `server/src/index.ts` and the new `command-center/` directory. No
database schema changed, no existing route's behavior changed, no existing static
asset changed. Approving a `DailyPlan` through Command Center only ever changed a
status column (Phase 5D-3's own guarantee, unmodified) — there is no external or
Task-Runtime state this phase could have left behind to clean up.

## What was never enabled, and remains never enabled after any rollback

Gmail/Calendar writes, voice, desktop control, autonomous task execution, and
autonomous push/merge/deploy were not implemented in Phase 5E and are unaffected by
rolling any part of it back — there is no flag to flip in either direction, because the
code paths that would perform any of them do not exist in this phase's diff.
