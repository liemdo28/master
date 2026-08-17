# Phase 7G — Production Runbook

Date: 2026-08-17

## Runtime fleet (verified live, Section 1 audit)

| Process | Port | Status | Notes |
|---|---|---|---|
| mi-core | 4001 | online | sole owner of :4001, script `F:\Projects\mi-core\server\dist\index.js` |
| mi-ai-service | 4002 | online | Python AI service, sole owner of :4002 |
| mi-accounting | 8844 | online | read/reporting only — unreachable from Jarvis Gateway/voice (§30) |
| qb-ops-agent | — | online | |
| mi-node-agent | — | online | registered but `REGISTRATION_BLOCKED` per health-truth (pre-existing gap, not fixed this phase) |
| mi-whatsapp-gateway | — | not registered in PM2 | intentionally contained (Phase 7A.3) |
| mi-ceo-observer | — | not registered in PM2 | intentionally disabled |
| pm2-logrotate | — | online | PM2 module |

## Dependency model (canonical — `health-truth/aggregate.ts`)

`CORE`, `DATABASE`, `AUTHORITY` — `REQUIRED_FOR_CORE`. `KNOWLEDGE`,
`LOCAL_MODEL`, `VOICE_INPUT`, `VOICE_OUTPUT` — `OPTIONAL_DEGRADED` (can
push `overall` to `DEGRADED`, never to `UNAVAILABLE`/`BLOCKED`).
`PYTHON_AI`, `GOOGLE_CONNECTORS`, `NODE_AGENT`, `ACCOUNTING`, `QB_AGENT` —
`FEATURE_SCOPED`. `WHATSAPP`, `N8N`, `CEO_OBSERVER` —
`INTENTIONALLY_DISABLED`.

Current live baseline: `overall: DEGRADED` (from `LOCAL_MODEL`/
`VOICE_INPUT`/`VOICE_OUTPUT` — no Ollama/STT/TTS runtime in this
environment); `CORE`/`DATABASE`/`AUTHORITY` all `HEALTHY`. Unchanged from
every prior phase's closure baseline.

## Boot / Windows auto-start (§12) — status: **PARTIAL**, report honestly

Two independent mechanisms exist on this machine; only one currently works:

1. **`pm2-windows-startup` via registry `Run` key → WORKING.**
   `HKCU\...\Run\PM2` runs an invisible VBScript that runs
   `pm2_resurrect.cmd` → `pm2 resurrect`. This restores every process from
   PM2's own saved `dump.pm2`, which correctly references current
   `F:\Projects\mi-core\...` paths for all 5 real processes (verified by
   reading `dump.pm2` directly). This is the mechanism that produced the
   real, documented reboot-survival evidence at
   `WHATSAPP_REBOOT_SURVIVAL_FINAL_EVIDENCE.md` (2026-06-18/19, predates
   the drive migration but the underlying `pm2 resurrect` mechanism is
   drive-path-agnostic since it reads whatever `dump.pm2` currently says).

2. **Windows Startup-folder `Mi-Ultimate.vbs` → BROKEN/STALE, found this
   phase.** It hardcodes `D:\Project\Master\mi-core\start.bat`. That
   entire directory (`D:\Project\Master\mi-core\`) no longer exists — the
   project migrated to `F:\Projects\mi-core` (per
   `codex/hotfix-production-f-drive-runtime`, already reflected in
   `ecosystem.config.js`'s own `__dirname`-relative paths). On next boot
   this script will fail silently (cmd `/c` on a nonexistent file just
   errors and exits) and contributes nothing — but critically, it also
   does no harm, because mechanism #1 above is independent and sufficient.

**Not fixed this phase.** Per the directive's own instruction ("do not
install random startup software during 7G") and this program's
established restraint about editing files outside the git-tracked repo
without being asked, the stale VBS file was left untouched. Recorded here
as a known, non-blocking operational gap — the boot-recovery *outcome* is
already correct via mechanism #1; only a redundant, already-dead second
path is stale.

## Boot preflight (new, §13-14)

`server/src/operations/boot-preflight.ts` — a read-only port-ownership
check an operator can run before `pm2 start ecosystem.config.js` (not
wired into the server's own `listen()` — that would be a boot-behavior
change out of scope for a certification phase). Detects an occupied port
via a throwaway probe socket; never terminates anything it finds.
Certified in an isolated fixture (`test:phase7g-boot-preflight`, 4/4): a
free port reports available, an occupied port is detected and the process
holding it is left running, `preflightPorts()` fails safely (`ok: false`)
rather than reporting a false all-clear, and the check is live (not
cached) — release the port and it reports available again.

## SelfHeal classification (§17)

`company-os/self-healing-monitor.ts` runs its **own independent**
hardcoded service list (`SERVICES_TO_MONITOR`) — it does **not** consume
`health-truth/aggregate.ts`'s canonical `getSystemHealth()`. This produces
the repetitive alert pattern visible in every prior phase's logs:

| Alert | Canonical state (health-truth) | Classification |
|---|---|---|
| WhatsApp Gateway DOWN | `INTENTIONALLY_DISABLED` (Phase 7A.3) | **MISCONFIGURED_ALERTING** — SelfHeal's static config marks it `critical: true` and alerts on an intentionally-absent PM2 process |
| CEO Observer DOWN | `INTENTIONALLY_DISABLED` | **MISCONFIGURED_ALERTING** — same reasoning, `critical: false` softens but does not eliminate it |
| Ollama AI DOWN | `LOCAL_MODEL: UNAVAILABLE, OPTIONAL_DEGRADED` | **EXPECTED_DEGRADED** — a real, documented infrastructure gap (no Ollama runtime here), correctly never blocking core function per health-truth's own criticality model |

SelfHeal does not gain broad mutation authority (its only mutation is
`pm2 restart <hardcoded-known-service-name>`, unchanged from before this
phase) and does not bypass runtime containment (`pm2 restart
mi-whatsapp-gateway` against a process that no longer exists in PM2's list
fails safely — verified: `pm2 restart <nonexistent>` exits 1). **Not
fixed this phase** — rewiring SelfHeal onto the canonical health model is
real, valuable, in-scope-sounding work, but it is a behavior change to a
live monitoring/alerting system with its own blast radius, better suited
to its own dedicated review cycle than a line-item inside a hardening
phase already this large. Recorded as a known gap, not silently patched.

One additional observation, not fixed for the same reason: the restart
log line (`console.log('[SelfHeal] Restarted ${svc.name} ...')`) is
unconditional — it prints even when the underlying `pm2 restart` call
failed (its own `restartAttempted` boolean isn't checked before the log).
This is a misleading-log issue, not a security or authority issue.

## Provenance chain (§15, re-verified live post-deploy — see closure doc)

`.env` `MI_DEPLOYED_SOURCE_SHA` = deploy-owned snapshot's `deployedSha` =
production's local `server/snapshot-manifest.json` `deployedSha` = the
actual PR merge commit = the authority manifest copied into production =
the live server's own `AUTHORITY: HEALTHY` (no `PROVENANCE_MISMATCH`).

## Windows CRLF manifest false-positive (§16) — FIXED, safely

`generate-manifest.ts --check` now normalizes `\r\n` → `\n` on the
on-disk copy only, before comparing to the freshly-generated (always-LF)
`body` string. This does not weaken real content-drift detection — a
genuine change (e.g. wrong mutation count) still differs after
normalization and still fails. Regression-locked:
`test:phase7g-manifest-crlf` (4/4 — clean baseline passes, CRLF-only
conversion now passes, tampered content still fails with and without
CRLF).

## Performance (§24, isolated e2e fixture — see `e2e/phase7g-performance.cjs`)

| Endpoint | p50 | p95 |
|---|---|---|
| public health | 2653ms | 6345ms |
| detailed health | 2734ms | 2973ms |
| simple Jarvis read | 37ms | 40ms |
| project query | 36ms | 38ms |
| knowledge retrieval | 35ms | 37ms |
| planning | 35ms | 43ms |
| simulation | 62ms | 67ms |
| voice transcript | 34ms | 37ms |
| Operator Workspace load | 41ms | 60ms |
| Evidence Inspector render | 15ms | 17ms |
| startup preflight port check | 1ms | 5ms |

Health endpoints are slow because they run real network probes
(Ollama/Python-AI) with real timeouts — documented, unchanged behavior
since Phase 7B, not a regression.

Concurrency: 10 concurrent reads in 342ms, 25 in 847ms, 50 in 1544ms.

Resource/leak proxy (§25): 200 sequential Gateway requests, first-quartile
avg 32ms vs last-quartile avg 33ms — drift ratio 1.04 (no meaningful
growth). SessionStore bound (`MAX_SESSIONS = 1000`, Phase 7D) verified
live under sustained load: 1500 sessions created,
`test:phase7g-session-bounds` confirms the earliest sessions were evicted
and the store never grew unbounded.

## Known operational gaps (honest, non-blocking)

- Ollama / local model unavailable in this environment (pre-existing,
  every prior phase).
- STT/TTS unavailable in this environment (Phase 7F, unchanged).
- `mi-node-agent` registration gap (pre-existing, not fixed this phase).
- Windows Startup-folder `Mi-Ultimate.vbs` is stale/dead (found this
  phase, documented above — does not block the working `pm2 resurrect`
  path).
- SelfHeal's alert classification is stale relative to health-truth
  (found this phase, documented above — not a security issue, an
  observability quality gap).
