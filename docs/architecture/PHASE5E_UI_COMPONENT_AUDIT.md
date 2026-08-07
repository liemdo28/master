# Phase 5E — UI component audit

## What exists today

| Candidate | Location | Stack | Verdict |
|---|---|---|---|
| Static dashboards | `ui/*.html` (`agenview.html`, `liveboard.html`, `mobile.html`, `approval.html`, `brain.html`, `mi-chat.html`, `studio.html`, `ai-ad-studio.html`, `qb-dashboard.html`, `seo-control-center.html`, `doordash-remote.html`, `department-ops.html`, `voice.html`, `index.html`) | Hand-written HTML, inline `<style>` per file, vanilla `fetch()`, no build step, no framework, no shared component or CSS-variable system across files | **IGNORE** for anything outside Personal OS's domain (qb-dashboard, seo-control-center, doordash-remote, department-ops, brain, studio, ai-ad-studio — separate business subsystems). **DEPRECATE (soft)** for `agenview.html`/`liveboard.html`/`mobile.html`/`approval.html` — conceptually overlapping (CEO dashboard, live ops, mobile, approvals) but not adaptable: no TypeScript, no component reuse, no test infrastructure, no shared design system. Left running unmodified under their own paths; Command Center does not link to or replace them. |
| `client/src/` | `client/src/components/MiChatCrossDevice/` | 2 orphaned `.tsx`/`.ts` fragments, no `package.json`, no build config anywhere under `client/` | **IGNORE** — not a buildable app, dead scaffolding from an abandoned prior attempt. |
| `remote/remote-auth.ts` + `routes/remote.ts` | `server/src/remote/` | PIN login → persisted session token (`sessions.json`, survives restart), device tracking, IP allowlist (`ipGuard`), failed-login lockout, audit log (`audit_log.json`) | **KEEP** — this is the auth model Command Center adopts (see below). No changes to this module. |
| `routes/auth.ts`'s `requireAuth` | `server/src/routes/auth.ts` | PIN → in-memory `Set<token>` (lost on every restart), plus an explicit `LOCALHOST_BYPASS` and an `x-api-key` bypass | **IGNORE** for Command Center's own auth — §22 of the directive explicitly requires "localhost does not bypass auth" and a persisted session mechanism; this one does neither. Existing consumers (`/api/approval`, `/api/actions`, etc.) are untouched. |
| `requireTaskRuntimeAuth` | `server/src/index.ts` (local function) | Raw `x-api-key` string equality, no session, no expiry | **IGNORE** for Command Center's own auth (see "Auth bridge" below) — a raw API key must never ship in browser JS. Existing consumers (`/api/operating/*`, `/api/task-runtime/*`, `/api/personal/*`, `/api/coding/*`, `/api/knowledge-documents/*`, `/api/intelligence/*`) are untouched. |
| Any React/Vite/Next app | — | — | **Does not exist.** No `package.json` anywhere references `react`, `vite`, or `next` outside `node_modules`. |
| Design system / component library | — | — | **Does not exist.** No shared Tailwind/MUI/Ant config; only a Tabler Icons CDN webfont referenced by two static pages. |
| Charts / tables / virtualization | — | — | **Does not exist** as a reusable library; a few pages hand-roll simple bar/line SVGs inline. |
| WebSocket/SSE | `server/src/index.ts` (`ws` on `/ws`) | Used by the existing static dashboards for live push | **ADAPT** — reuse the existing `/ws` WebSocket endpoint for Command Center's live updates (§21) rather than adding a second real-time transport. |

## Conclusion

**No existing frontend qualifies as "an existing one that can be safely adapted"** at the scope this directive requires (13 typed, tested, keyboard-navigable screens with a command palette, evidence drawers, and virtualized lists). Every existing UI artifact is either out-of-domain (other business subsystems), unbuildable (dead scaffolding), or architecturally unable to support TypeScript/component reuse/tests (static HTML with inline styles and no shared modules).

**Decision: build one new canonical frontend**, `command-center/` (sibling to `server/`, `ui/`, `client/`), using React + TypeScript + Vite + Tailwind CSS + TanStack Query (server state) + TanStack Table/Virtual (large lists) + React Router + Vitest (component tests) + Playwright (E2E). This is additive — nothing under `ui/`, `client/`, or any other existing frontend artifact is modified, moved, or deleted. `agenview.html`/`liveboard.html`/`mobile.html`/`approval.html` continue running exactly as before at their existing paths.

## Auth bridge (the one backend addition, and why it's necessary)

Every screen this phase requires reads from routes gated by `requireTaskRuntimeAuth` (`/api/operating/*`, `/api/task-runtime/*`, `/api/personal/*`, `/api/coding/*`, `/api/knowledge-documents/*`, `/api/intelligence/*`) — a raw `MI_CORE_API_KEY` string comparison. Shipping that key into browser-delivered JavaScript would expose the same credential used for direct backend automation to anyone who opens dev tools; §22 of the directive explicitly forbids this ("no token stored in localStorage if avoidable", "prefer secure session/bootstrap mechanism already used by repo").

The repo already has exactly the right mechanism for this — `remote-auth.ts`'s PIN-login-to-persisted-session-token flow — but it is only wired to `/api/remote/*`. This is the "UI blocker that proves a missing read contract" the directive's preamble allows for: the fix is **not** a redesign, it is mounting the *existing, unmodified* routers a second time under `/api/command-center/*`, gated by `requireRemoteAuth` instead of `requireTaskRuntimeAuth`:

```ts
app.use('/api/command-center/operating', operatingJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, operatingRouter);
app.use('/api/command-center/personal', personalOsJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, personalOsRouter);
app.use('/api/command-center/task-runtime', taskRuntimeJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, taskRuntimeRouter);
app.use('/api/command-center/coding', codingJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, codingRouter);
app.use('/api/command-center/knowledge-documents', knowledgeDocumentsJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, knowledgeDocumentsRouter);
app.use('/api/command-center/intelligence', intelligenceJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, intelligenceRouter);
app.use('/api/command-center/projects', express.json({ limit: '2mb' }), rateLimiter, applyIpGuard, requireRemoteAuth, projectsRouter); // Project Registry (routes/projects.ts) — was previously behind routes/auth.ts's weaker requireAuth (in-memory sessions + localhost bypass)
```

Zero business logic is duplicated — the exact same router/handler code runs; only the auth middleware differs. No existing mount, route, or handler is changed, renamed, or removed. `/api/remote/login` (already public, already returns a Bearer session token) becomes the Command Center's login endpoint unchanged.

## Static asset serving

`server/src/index.ts` already serves `ui/` at `/` via `express.static`. Command Center's production build is served the same way, additively, at its own path: `app.use('/command-center', express.static(path.resolve(__dirname, '../../command-center/dist')))` — no existing static mount is touched, no reverse proxy or second server is introduced (§35).
