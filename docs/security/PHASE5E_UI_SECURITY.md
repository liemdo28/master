# Phase 5E — Command Center UI security

Every invariant below is exercised in `command-center/test/security.test.tsx`
(`npm run test:command-center-security`) and, structurally, in
`command-center/test/screens.test.tsx`.

## Auth model

Login is the existing `remote-auth.ts` PIN → persisted session-token flow
(`POST /api/remote/login`), unmodified. The token is stored in `sessionStorage` — never
`localStorage` — so it is cleared when the tab closes and is never shared across
long-lived browser storage. Every API call attaches it as `Authorization: Bearer
<token>`; the raw `MI_CORE_API_KEY` used by direct backend automation is never sent to,
stored by, or visible from the browser. A 401 from any request immediately locks the
app back to the PIN screen (`setUnauthorizedHandler`) — there is no code path that
renders authenticated content without a valid session.

### The route-shadowing bug found and fixed during this phase

`/api/remote/login`, `/api/auth/login`, and `/api/health` were mounted, in
`server/src/index.ts`, **after** several `app.use('/api', ..., requireTaskRuntimeAuth,
...)` catch-all mounts. Express runs middleware for every request whose path starts
with `/api`, and `requireTaskRuntimeAuth` returns 401 without calling `next()` — so
none of those "intentionally public" routes were ever reachable without already having
the raw API key, making PIN login itself impossible (this predates Phase 5E; it broke
`mobile.html`'s and `liveboard.html`'s own login flows too). Fixed by moving the public
routes — and the new Command Center bridge mounts, which had the identical problem —
before every bare `/api` mount. No auth logic changed, only mount order.

### Auth bridge

`/api/command-center/*` mounts the same routers as the raw-API-key routes a second
time, gated by `requireRemoteAuth` instead. See `PHASE5E_UI_COMPONENT_AUDIT.md` for the
full rationale and exact mount list.

## XSS from external content (Gmail, documents, task/project titles)

React's JSX text-node rendering escapes all content by default; no screen uses
`dangerouslySetInnerHTML`. `lib/sanitize.ts` additionally provides `sanitizeHtml`
(DOMPurify configured to strip **all** tags and attributes — used if any future screen
needs to render a bounded rich-text excerpt) and `safeHref` (rejects
`javascript:`/`data:`/`vbscript:` and any protocol outside `http:`/`https:`/`mailto:`
before a value is ever used as an `href`). Verified against `<img onerror=...>`,
`<script>`, event-handler attributes, and Markdown-shaped injection payloads.

## Secret-bearing backend errors

`api-client.ts`'s `parseErrorBody` only ever surfaces the backend's own already-bounded
`error` string (truncated to 300 characters) — never a raw response body, stack trace,
or provider payload. `ApiError`'s message is never interpolated into `dangerouslySetInnerHTML`
or an `href`.

## Privacy masking (§23)

- Email addresses are masked (`maskEmail`) everywhere a full address isn't the point —
  Inbox's follow-up/search views show `ja•••@example.com`, never the full local part.
- OAuth scopes are shown as a count on the Health screen, never the raw granted-scope
  URLs (an earlier draft of this screen printed the full scope list and was caught and
  fixed during this phase's own manual real-backend testing).
- Document/knowledge screens never render `canonicalPath` — the backend's own citation
  contract (Phase 5D-2) already never includes it; the frontend types mirror that
  omission.
- No screen surfaces raw OAuth tokens, WhatsApp session data, or full absolute
  filesystem paths.

## No mutation control where the backend has no safe verb (§6)

The Approval Center never renders an "approve" button for a `TASK_RUNTIME`-sourced
item, because `POST /api/task-runtime/tasks/:id/approve` does not exist — approving a
Task Runtime task would require a Controlled Actions phase to define what "approve"
actually transitions and guards. The UI states this explicitly rather than inventing a
control that calls the wrong endpoint or silently does nothing.

## Calendar/Gmail mutation controls are structurally absent

`CalendarPage.tsx` and `InboxPage.tsx` contain no create/update/delete/RSVP/send/reply/
draft/archive/label control — not disabled, not hidden behind a flag, simply never
written. Verified by a security test that renders both screens and asserts no button
with any of those accessible names exists anywhere in the DOM.

## No external-write capability is exposed anywhere in the UI

Command palette commands (§19) are limited to navigation and calls to the same
idempotent generate/refresh endpoints every screen already uses — no command sends,
deploys, executes, merges, publishes, or deletes external data, because no such
function exists in `CommandPalette.tsx` for a command to call.
