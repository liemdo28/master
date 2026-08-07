# Phase 5E — Command Center runbook

## Accessing it

```
http://<mi-core-host>:4001/command-center/
```

On first visit you'll see the PIN screen. This is the same PIN used by `mobile.html`
and `liveboard.html` (`MI_PIN` in `.env` — set `require_auth`/`pin_hash` via
`.local-agent-global/remote-access/config.json`, same file those pages already use).
Login issues a session token stored in the browser tab's `sessionStorage`; it is lost
on tab close (by design — see `PHASE5E_UI_SECURITY.md`).

## Building and deploying

```
cd command-center
npm ci
npm run build          # produces command-center/dist/
```

Deploy alongside a normal `mi-core` `server/dist` deployment — copy
`command-center/dist/` to the same location on the target machine, sibling to
`server/`. No server restart is strictly required for a frontend-only change (it's
served as a static file), but restart `mi-core` after any `server/src/index.ts` change
(the auth-bridge routes).

## Diagnosing "PIN login doesn't work"

1. Confirm `MI_PIN` (or `MI_PIN_HASH`) is set in `.env` — with neither set,
   `requireRemoteAuth` is a no-op and login always "succeeds" instantly by design
   (matches the existing `mobile.html` behavior).
2. Confirm you're hitting `/api/remote/login`, not `/api/auth/login` — Command Center
   only ever talks to the former.
3. If login used to be broken across the whole app (mobile, liveboard) before this
   phase, see the route-shadowing bug documented in `PHASE5E_UI_SECURITY.md` — confirm
   the fix landed in the deployed `server/dist/index.js`.

## Diagnosing "a screen shows NOT_CONFIGURED but I expect real data"

- Calendar/Inbox: requires a `READY` Google connector (`GET /api/command-center/intelligence/status`).
  Same token file every other Phase 5C consumer uses — `NOT_CONFIGURED` means no token,
  `TOKEN_EXPIRED`/`INSUFFICIENT_SCOPE` mean the token needs re-consent.
- Every other screen honestly reflects whatever the underlying Phase 5A-5D3 store
  returns — an empty state means the underlying data genuinely doesn't exist yet
  (e.g. no goals created, no plan generated for today).

## Diagnosing "an approve button is missing where I expected one"

By design for `TASK_RUNTIME`-sourced approvals — see
`docs/security/PHASE5E_UI_SECURITY.md#no-mutation-control-where-the-backend-has-no-safe-verb-6`.
Knowledge confirmations and conflict resolutions do have working controls.

## Local development

```
cd command-center
npm run dev             # Vite dev server, proxies /api and /ws to localhost:4001
```

Point it at a real running `mi-core` (dev or production-copy) on port 4001, or at an
isolated test backend on another port by editing `vite.config.ts`'s proxy target.

## Restart / persistence

Command Center holds no state of its own — everything it shows lives in the backend's
SQLite databases (Phase 5A-5D3, unchanged by this phase). A browser reload always
re-fetches from the live backend; a `mi-core` restart loses nothing Command Center
depends on, the same restart-recovery guarantee Phase 5D-3 already proved.
