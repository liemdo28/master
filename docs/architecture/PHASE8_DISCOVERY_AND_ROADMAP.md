# Phase 8 — Discovery and Roadmap

Date: 2026-08-17

**DISCOVERY ONLY. No implementation performed. No production mutation performed.**

## Executive Summary

Phase 5/6/7 built a governed, canonical Jarvis architecture: one Gateway,
one session model, one health-truth model, one Controlled Action path,
and a voice modality with zero authority of its own. That architecture is
sound and holds under the adversarial/failure testing Phase 7G performed.

Phase 8 discovery's central finding is **not** about the canonical
architecture — it's about what's still sitting *around* it. A fresh,
line-by-line audit of `index.ts`'s ~80 route mounts found:

1. **The highest-priority finding**: `POST /api/browser/extract` — a
   pre-Phase-5 legacy route — is live, unauthenticated (no `requireAuth`
   at its mount, no auth check in its own handler), and calls a *real*,
   *installed*, *functional* browser-automation library
   (`browser_use` — confirmed installed in this environment) against an
   **arbitrary caller-supplied URL**. The authority manifest's own static
   metadata claims this route is `QUARANTINED`/`LEGACY_QUARANTINED` — but
   reading the actual handler shows only its sibling `POST /write` calls
   `denyAuthorityMutation()`; `/extract` does not, and runs for real. This
   is a manifest-vs-reality drift on a genuinely SSRF-shaped surface, not
   a hypothetical one.
2. A legacy 49-route `/api/jarvis/*` compatibility router (`routes/
   jarvis.ts`) still runs in parallel with the canonical Gateway, its own
   manifest entries explicitly annotated "must not become a second
   canonical owner" — a clear retirement candidate, not a security
   emergency (its one execution-shaped path, `autonomous-task-runner.ts`,
   was already neutralized in Phase 7A.1 and is re-confirmed still
   neutralized here).
3. At least 17 other route mounts (`/api/qb`, `/api/models`, `/api/
   agent-engine`, `/api/data-analyst`, `/api/skills`, `/api/doordash*`,
   `/api/bigdata`, `/api/enterprise`, `/api/voice`, `/api/mi`, and others)
   have no `requireAuth` at their mount line — gated only by the global
   `applyIpGuard` (LAN/Tailscale network boundary), not by any per-request
   identity check. `/api/qb/*` alone exposes real financial data
   (revenue, expenses, invoices, receipts) this way.
4. `mi-node-agent` has never once successfully registered in this
   environment's entire history (`registry.json` doesn't exist on disk) —
   this is very likely vestigial multi-device infrastructure for a vision
   that was never actually used, not a bug worth repairing.
5. Google OAuth is architecturally ready (client ID/secret configured,
   adapter code complete) but has zero refresh token — an environment gap,
   not a code gap. Reconnecting would restore existing capability, add
   nothing new.

**Given these findings, the answer to "what prevents Jarvis from safely
operating with less operator supervision" is: nothing about the canonical
Gateway/Controlled-Action architecture blocks it — Phase 7G proved that
holds under real adversarial testing. What blocks it is operational debt
around the edges: an unauthenticated live SSRF-shaped route, a duplicate
legacy conversational surface, inconsistent route-level auth, and an
unreliable boot/alerting story. None of this is an autonomy-readiness gap
in the canonical systems; all of it is closure work.**

**Recommended direction: NO AUTONOMY EXPANSION. Phase 8A closes the
operational/security debt found here before any future phase considers
expanding what Jarvis is allowed to do on its own.**

## Baseline (verified fresh, read-only, Section 1)

| Check | Result |
|---|---|
| `origin/master` | `ab9ab84814c463b2581a78d09c184d19a3e0220c` (matches directive) |
| Working tree | clean |
| Functional deployed SHA | `ff4b8b8d1de391e3dba8bb8dd6e291762d9d4815` (matches directive, matches `.env`, matches local `snapshot-manifest.json`) |
| `GET /api/health/detail` | `overall: DEGRADED` — `CORE`/`DATABASE`/`AUTHORITY` all `HEALTHY` (matches directive's stated baseline exactly) |
| `GET /api/authority/status` | `mutations: 408, unknownMutations: 0, unresolvedLegacyMutations: 0` (matches exactly) |
| `personal-os.db` / `tasks.db` / `projects.db` | `integrity_check: ok`, 0 FK violations, all three |
| Personal OS schema | `schema_migrations` max version = 10 |
| PM2 fleet | `mi-core`, `mi-ai-service`, `mi-accounting`, `qb-ops-agent`, `mi-node-agent`, `pm2-logrotate` all online, no crash loops |

No mutation performed during this audit — every check above was a
read-only HTTP GET, a read-only SQLite connection, or a `git`
read/status/log command.

## Canonical Architecture (Section 2)

Unchanged from `PHASE7G_PROGRAM_AUDIT.md`, re-verified this phase:

| Responsibility | Canonical owner | Duplicate owners found |
|---|---|---|
| Jarvis Gateway | `jarvis-gateway/gateway.ts` | Legacy `/api/jarvis/*` (`routes/jarvis.ts`) — read-mostly, explicitly marked non-canonical in its own manifest metadata |
| Conversation/session | `jarvis-gateway/session-store.ts` | none |
| Knowledge | `jarvis-gateway/handlers/knowledge-search.ts` over `personal-os/documents/*` | Legacy `/api/jarvis/knowledge/*` (read-only mirror) |
| Tasks | `routes/task-runtime.ts` | Legacy `/api/jarvis/tasks` (read-only mirror) |
| Projects | `routes/projects.ts` | none |
| Goals | `jarvis-gateway/handlers/goal-query.ts` | none |
| Planning | `jarvis-gateway/handlers/planning.ts` | none |
| Simulation | Phase 6F `AutomationSimulationService` | Legacy `/api/jarvis/twin/*` (read/simulate-only mirror) |
| Controlled Actions | `personal-os/actions/service.ts` (`ControlledActionService`) | `approval/gate.ts` (non-authoritative, contained since 7A) |
| Governance/Risk/Policy/Budget/Kill switch | `personal-os/actions/governance/*` | Legacy `jarvis/risk-engine.ts` (read-only advisory, 4 importers, not wired to any real gate) |
| Delegation | `personal-os/delegation/*` | none |
| Evidence | `evidence/*` | none |
| Health | `health-truth/aggregate.ts` | `company-os/self-healing-monitor.ts` runs its **own** hardcoded service list, independent of health-truth (already documented as a known gap in `PHASE7G_PRODUCTION_RUNBOOK.md`) |
| Voice | `jarvis-gateway/voice/voice-gateway.ts` | none live |
| Coding | `coding/workflow.ts` (`CodingWorkflow`) | none |
| Operator Workspace | `command-center/` | Legacy static UIs (`agenview.html`, `liveboard.html`, `mobile.html`) still served, distinct read surfaces, not authority-bearing |
| Deployment provenance | `authority-control-plane/source-provenance.ts` | none |
| Runtime recovery | `pm2-windows-startup` (registry `Run` key → `pm2 resurrect`) | Startup-folder `Mi-Ultimate.vbs` — stale, dead, does not compete for authority (found Phase 7G, re-confirmed here unchanged) |

No responsibility has more than one **authority-bearing** live owner. The
duplicates found are all read-mirrors, non-authoritative gates, or dead
startup paths — consistent with the Phase 7G freeze policy holding.

## Legacy Retirement Map (Section 3)

| Module | Classification | Evidence |
|---|---|---|
| `coo-v4/*` (15 files, 22 HTTP routes) | **QUARANTINED** | All 22 routes `LEGACY_QUARANTINED` in the manifest; `tryGStack()`/`cooExecute()`/`handleCeoSignal()` confirmed never called from any live conversational adapter (re-verified via `test:phase7g-legacy-authority-scan`, still passing) |
| `gstack/*` | **QUARANTINED** | 7+ routes `LEGACY_QUARANTINED`; same containment as above |
| `routes/jarvis.ts` (49 routes) | **ADAPTER** (but flagged in its own metadata: "must not become a second canonical owner") → **REMOVE_CANDIDATE** | Mounted live at `/api/jarvis` with `requireAuth`; 46 routes are read-only mirrors of canonical data; one route (`POST /approvals/:id/approve`) calls `runApprovedTask()`, which is permanently neutralized (see below) |
| `jarvis/autonomous-task-runner.ts` | **QUARANTINED** (safe) → **REMOVE_CANDIDATE** once `routes/jarvis.ts` retires | Both exported functions (`runApprovedTask`, `runL1Task`) hard-return `status: 'blocked'`, `reason: 'QUARANTINED_PHASE_7A1'`; file contains no `child_process` call at all (confirmed by reading the full 63-line file) |
| `jarvis/approval-conversation.ts` | **ADAPTER** → **REMOVE_CANDIDATE** with the above | Backs `routes/jarvis.ts`'s approval-mirror endpoints only; not imported by any canonical Gateway file |
| `jarvis/decision-gate-runtime.ts` | **DEAD** | Zero importers anywhere in the source tree |
| `jarvis/risk-engine.ts`, `jarvis/suggestion-engine.ts`, `jarvis/statement-detector.ts`, `jarvis/ceo-preference-store.ts` | **ADAPTER** (read/advisory only) | 2-4 importers each, all read-only outputs surfaced through `routes/jarvis.ts`'s mirror endpoints; none gate a real mutation |
| `routes/browser-agent.ts` | **QUARANTINED per manifest metadata, but NOT actually quarantined in code for `/extract`** — see Security Debt | `POST /write` correctly calls `denyAuthorityMutation()`; `POST /extract` does not and calls `runBrowserTask()` for real |
| `routes/qb-financial.ts` (9 routes) | **ADAPTER** (read-only) flagged "must not become a second canonical owner" → candidate for either retirement or promotion to a real authenticated canonical read route | Proxies to `qb-ops-agent`'s own financial endpoints; no write capability in this file |

**No `UNKNOWN` mutation surface found.** `unknownMutations=0` held
throughout this audit; every surface touched has manifest metadata (even
where that metadata is stale, as with `/api/browser/extract`).

## Operational Gaps (carried from Phase 7, re-verified)

Unchanged since `PHASE7G_PRODUCTION_RUNBOOK.md`: Ollama unavailable, STT/
TTS unavailable, `mi-node-agent` registration gap, stale
`Mi-Ultimate.vbs`, SelfHeal alerting not aligned to Health Truth. See
dedicated sections below for Phase 8's readiness classification of each.

## Autonomy Readiness Model (Section 4)

| Capability | Classification | Reasoning |
|---|---|---|
| Knowledge (read) | `READ_ONLY_SAFE` | Already fully automated — retrieval + citation, no write path exists |
| Tasks (read) | `READ_ONLY_SAFE` | Same |
| Projects (read) | `READ_ONLY_SAFE` | Same |
| Planning | `PROPOSE_SAFE` | Gateway only ever previews a plan; Phase 7G proved zero execution leakage |
| Simulation | `SIMULATE_SAFE` | Structurally cannot reach `ControlledActionService` (verified live in code, not just by convention) |
| Controlled Actions (Gmail draft, calendar) | `APPROVAL_REQUIRED` | Correct and frozen — must stay this way |
| Coding | `PROPOSE_SAFE` for plan/edit/test; `APPROVAL_REQUIRED` for commit; `NOT_READY` for push/PR/merge/deploy | `CodingWorkflow` has no push/PR/merge/deploy method in code at all — this isn't policy-limited, it's *not implemented* |
| Service recovery (restart) | `NOT_READY` | No governed, idempotent, reversible restart action exists; SelfHeal's own restarts are not canonically gated (see below) |
| Notifications (in-app) | `READ_ONLY_SAFE` | Command Center already surfaces state truthfully |
| Notifications (external — WhatsApp/email) | `PROHIBITED` (unchanged) | WhatsApp gateway intentionally disabled since 7A; no external send capability should be reintroduced without its own directive |
| Voice | `PROPOSE_SAFE` (bounded) | Zero authority beyond chat, proven in Phase 7G's 1558-scenario red team |
| Browser | `NOT_READY` / **currently mis-classified as safer than it is** | `/extract` is live, unauthenticated, and functional against an arbitrary URL — this is the opposite of ready; it needs *containment*, not evaluation for expansion |
| Shell | `PROHIBITED` (unchanged, and already fully neutralized in code) | — |
| Deployment | `PROHIBITED` (unchanged) | — |
| Financial | `PROHIBITED` (unchanged) | Zero money-movement function names anywhere in source; `/api/qb/*` is read-only but under-authenticated |
| External messaging | `PROHIBITED` (unchanged) | — |

## Operator Dependency Analysis (Section 5)

| Operator touchpoint | Classification |
|---|---|
| Controlled Action approval | `ESSENTIAL_HUMAN_CONTROL` — this is the whole point of the architecture |
| Project disambiguation | `AUTOMATABLE_SAFELY` already (Gateway asks a clarifying question rather than guessing — this *is* the safe automation) |
| Google OAuth reconnect | `ESSENTIAL_HUMAN_CONTROL` — token grants belong to a human, always |
| Service restart | `NOT_READY` for automation; `ESSENTIAL_HUMAN_CONTROL` today |
| Incident triage (diagnose) | `AUTOMATABLE_WITH_POLICY` — Jarvis can already read health-truth and explain it; formalizing a "what's wrong and why" proposal is low-risk |
| Ambiguous provider result | `ESSENTIAL_HUMAN_CONTROL` — reconciliation-not-retry is already the correct default (Phase 5F), a human resolves genuine ambiguity |
| Deployment | `ESSENTIAL_HUMAN_CONTROL` (unchanged, frozen) |

## Windows Boot / Startup (Section 6)

Unchanged from Phase 7G's finding, re-verified this phase (read-only):

- Stale script: `C:\Users\...\Startup\Mi-Ultimate.vbs` → points at
  `D:\Project\Master\mi-core\start.bat`, which does not exist (confirmed:
  `D:\Project\Master\mi-core\` doesn't exist at all).
- Working path: `pm2-windows-startup`'s registry `Run` key → invisible
  VBScript → `pm2_resurrect.cmd` → `pm2 resurrect`, reading PM2's own
  `dump.pm2`, which correctly references current `F:\Projects\mi-core\...`
  paths for all 5 real processes (re-confirmed this phase).
- No Scheduled Task exists for mi-core boot (only the registry Run-key
  mechanism above).
- Intentionally-disabled services (`mi-whatsapp-gateway`, `mi-ceo-
  observer`) remain absent from PM2's process list — confirmed still
  true.
- No runtime validation step runs before `pm2 resurrect` restarts
  processes — it blindly replays whatever `dump.pm2` says.

**Recommendation**: safest Phase 8 fix is two small, independent, low-risk
changes — (1) delete or fix the dead `Mi-Ultimate.vbs` (currently harmless
but confusing for any future operator debugging boot behavior), (2)
optionally add a lightweight preflight check (reusing Phase 7G's
`boot-preflight.ts` port-check) that runs *before* `pm2 resurrect`, not
instead of it. Neither requires new authority.

## SelfHeal (Section 7)

Unchanged finding from Phase 7G, re-verified: `company-os/self-healing-
monitor.ts`'s `SERVICES_TO_MONITOR` is a separate hardcoded list, not
wired to `health-truth/aggregate.ts`. It restarts services via `pm2
restart <hardcoded-name>` (bounded, `MAX_AUTO_RESTART`-limited, no new
authority) and its own "Restarted X" log line is unconditional (doesn't
check whether the restart actually succeeded) — a misleading-log issue,
not a security issue.

**Recommendation**: `ALERT_ONLY` today (it does restart, but only
already-PM2-known named services it's always been allowed to restart —
this isn't new authority, just imprecise targeting). Long-term direction:
`RETIRE_LEGACY_LOGIC` in favor of a canonical-health-truth-driven monitor,
but that's a real feature build, not a Phase 8A item.

## Node Agent (Section 8)

- Intended role: let secondary devices (laptop, Mac) join a multi-device
  Mi network via self-registration + heartbeat.
- Current state: `mi-node-agent`'s PM2 process is online, but
  `F:\Projects\mi-core\.local-agent-global\nodes\registry.json` **does
  not exist on disk** — meaning no device, including the primary machine
  itself, has ever successfully completed registration in this
  environment's history.
- Whether canonical systems replaced it: yes, functionally — this is a
  single-machine deployment today; nothing in the canonical Phase 5-7
  architecture depends on node-agent for anything.
- Would fixing it restore dangerous authority: no — it's a
  registration/heartbeat protocol, not an authority path.

**Recommendation**: `RETIRE` (or at minimum `KEEP_BLOCKED` if there's
non-technical reason to preserve the code for a future actual second
device) — there is no evidence this has ever provided real value, and
"fixing" a never-used integration is lower priority than the security
debt found above.

## Local Model / Ollama (Section 9)

- Capabilities affected: `LOCAL_MODEL` health dependency only —
  `OPTIONAL_DEGRADED`, never blocks core function (verified live,
  unchanged since Phase 7B).
- Fallback: yes — `askAi()`'s multi-provider router degrades gracefully;
  Python AI service reports `HEALTHY` independently.
- Necessity: not required for any canonical Phase 5-7 capability to
  function; only local-model-specific features (if any exist) would be
  affected, and none were found gating a canonical path.

**Recommendation**: `DEFER`. Installing/operating a local model adds real
ops burden (GPU/CPU load, update cadence, another service to monitor) for
a capability nothing canonical currently requires.

## Voice Runtime (Section 10)

STT/TTS unavailable, `OPTIONAL_DEGRADED`, proven (Phase 7G, 1558
scenarios) to never expand authority even when present.

**Recommendation**: remains `OPTIONAL_FEATURE`. Nothing found in this
audit changes that — voice adds convenience, not new capability, and the
text path is always the first-class fallback by design (Phase 7F).

## Connector Readiness (Section 11)

`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are configured;
`GOOGLE_REFRESH_TOKEN` is empty. `isConfigured()` → true,
`hasTokens()` → false — this is a **pure environment gap** (missing
token), not an architecture gap (the adapter code is complete and
already governed by `ControlledActionService` for the 3 authorized
action types). Reconnecting (an operator action, not performed here)
would restore exactly the existing, already-governed capability — nothing
new would need to be built. **Gmail SEND remains forbidden regardless of
connection state** — the OAuth scope and the authority boundary are
independent; reconnecting does not imply expanding scope.

## Autonomous Coding Readiness (Section 12)

`coding/workflow.ts`'s `CodingWorkflow` exposes: inspect (read repo/task
context), plan (`planTask()`), edit (real file edits in an isolated
worktree), test (`run()` executes the test suite), and a **local-only**
`commitLocal()`. Grepped the entire file for `git push`, PR-creation
calls, `git merge`, and any deploy-shaped function — **zero matches**.
Push/PR/merge/deploy are not policy-blocked-but-implemented; they are
**not implemented in code at all**. Autonomous merge/deploy remains
prohibited and, as of this audit, would require new code, not just a
policy flag flip.

## Service Recovery Readiness (Section 13)

Jarvis can already: detect an outage (health-truth), diagnose (per-
dependency `reasonCode`/`detail`), and — via the Gateway's `SYSTEM_STATUS`
handler — explain it in plain language. It cannot today propose a
structured, governed "restart service X" action (no such action type
exists in `ControlledActionService`), and SelfHeal's own restarts are a
separate, ungoverned, hardcoded-list mechanism (see Section 7). A future,
narrow, governed service-restart Controlled Action (idempotent, bounded
to a fixed named-service allowlist, requiring approval, with rollback =
"process was already being restarted anyway by PM2's own crash recovery")
**might** be justifiable in a future phase — not recommended for Phase 8A,
and not implemented here.

## Notification Readiness (Section 14)

| Channel | Classification |
|---|---|
| Command Center (in-app) | `IN_APP` — already the primary, safe surface |
| Local desktop/OS notification | not currently implemented |
| WhatsApp | `EXTERNAL` — intentionally disabled since Phase 7A, stays frozen |
| Email | `EXTERNAL` — no send capability exists (Gmail SEND forbidden) |
| Voice (spoken) | `LOCAL` — output only, already redaction-scrubbed (Phase 7F) |

External notification authority remains frozen. No change recommended.

## Proactive / Background Systems (Section 15)

Five independent, currently-running background loops found:
`cron/sync-scheduler` (visibility 30min / knowledge 4hr / DEV2-ops 1hr),
`jarvis/proactive-monitor.ts` (15min), `jarvis/daily-briefing-
scheduler.ts` (07:00/20:00 VN), `operations/burn-in.ts` (hourly +
daily), and `company-os/self-healing-monitor.ts` (60s). All notice/
summarize/prepare-a-report; none execute a governed action directly.
This is real duplication-risk surface — five separate interval timers
with overlapping "notice something and tell the operator" purposes — but
determining genuine overlap (vs. legitimately distinct concerns) needs a
dedicated review, not a discovery-phase guess. Flagged for Phase 8B.

## Memory / Data Simplification (Section 16)

Live inventory (`F:\Projects\mi-core\.local-agent-global\` and
`\data\`): `personal-os.db`, `tasks.db`, `projects.db` (the 3 canonical
stores), plus `ga4-snapshots.db`, `gbp-snapshots.db`, `engineering-
tasks.db`, `knowledge.db`, `qb-agent.db` (5 feature-scoped stores) — 8
total, no unexpected/orphaned `.db` files found. **`CLAUDE.md`'s own
"Data Directories" section is stale**: it documents `graph/graph.db` and
`operational-memory/memory.db` as if still primary — neither directory
exists in the current runtime at all. `personal-os.db` is now the
canonical home for what that older documentation describes. Recommend
updating `CLAUDE.md` in Phase 8B (docs-only, zero risk) so future work
doesn't get misdirected by stale architecture docs.

## Route Simplification (Section 17)

Beyond the legacy retirement map (Section 3), no additional canonical-vs-
legacy route collisions were found. The `/api/command-center/*` and bare
`/api/*` dual-mount pattern (Phase 7C's own convention) is intentional
and consistent, not debt.

## Security Debt (Section 18) — the primary finding of this discovery

**Priority 1 — `POST /api/browser/extract`**: live, unauthenticated
(no `requireAuth` at the `/api/browser` mount, no auth check in the
router file), calls `runBrowserTask({ url, task, provider, headless:
true })` with a fully caller-supplied `url` — classic SSRF shape. The
authority manifest's metadata for this exact route claims
`authorityClass: LEGACY_QUARANTINED`, `status: QUARANTINED` — **this is
inaccurate**; only the sibling `POST /write` route actually calls
`denyAuthorityMutation()`. `browser_use` is confirmed **installed** in
this environment, so this is not a dormant/inert capability. Gated only
by the global `applyIpGuard` (LAN/Tailscale network boundary) — no
per-request identity check at all.

**Priority 2 — `/api/qb/*` (9 GET routes)**: no `requireAuth`, no API-key
check, network-IP-gated only. All GET, no write capability in this file,
but exposes real financial data (revenue, expenses, invoices, receipts)
to any caller who can reach the network boundary.

**Priority 3 — at least 15 other route mounts** (`/api/models`, `/api/
agent-engine`, `/api/integration-agent`, `/api` bare (`operationalKnowledgeRouter`),
`/api/data-analyst`, `/api/skills`, `/api/doordash-agent`, `/api/
doordash`, `/api/bigdata`, `/api/enterprise`, `/api/voice`, `/api/
gstack` (internally quarantined per-route), `/api/models` (second mount),
`/api/mi`, `/api/memory` (second mount, `operationalMemoryRouter`)) lack
`requireAuth` at their mount line. Not individually deep-audited in this
pass — flagged for a full route-by-route Phase 8A sweep.

**No cross-project leakage, no legacy shell-execution path, no live Gmail
SEND, no live financial execution, and no secret exposure were found** —
the canonical Gateway/Controlled-Action/voice architecture's own
boundaries (re-certified in Phase 7G) hold. The debt found here is all in
pre-Phase-5 legacy compatibility surfaces sitting alongside that
architecture, gated by network topology rather than application-level
auth.

## Operational Debt Scorecard (Section 19)

Scale 1 (low) – 5 (high) for User Impact, Security Impact, Frequency,
Recovery Difficulty, Complexity, Risk; 1 (hard) – 5 (easy) for Dependency
Readiness and Rollback Ease.

| Gap | User Impact | Security Impact | Frequency | Recovery Difficulty | Complexity | Risk | Dependency Readiness | Rollback Ease |
|---|---|---|---|---|---|---|---|---|
| `/api/browser/extract` unauthenticated | 2 | **5** | continuous (live route) | 1 (add one auth check) | 1 | **5** | 5 | 5 |
| `/api/qb/*` unauthenticated | 2 | 4 | continuous | 1 | 1 | 4 | 5 | 5 |
| Other 15 unauthenticated mounts | 2 | 3 | continuous | 2 | 2 | 3 | 4 | 4 |
| Legacy `/api/jarvis` router (49 routes) | 1 | 2 | n/a (dormant capability) | 2 | 3 | 2 | 4 | 4 |
| Windows startup (`Mi-Ultimate.vbs`) | 2 | 1 | rare (reboot only) | 1 (already has a working fallback) | 1 | 1 | 5 | 5 |
| SelfHeal stale logic | 2 | 1 | continuous (noisy logs) | 1 | 3 | 1 | 3 | 4 |
| `mi-node-agent` | 1 | 1 | n/a | 1 | 2 | 1 | 5 | 5 |
| Ollama absent | 2 | 1 | continuous | 1 | 3 | 1 | 2 | 4 |
| STT/TTS absent | 1 | 1 | continuous | 1 | 3 | 1 | 2 | 4 |
| CLAUDE.md stale docs | 1 | 1 | n/a | 1 | 1 | 1 | 5 | 5 |

## Autonomy Candidate Scorecard (Section 20)

None approved here. Scored for future reference only (1 low – 5 high,
except Dependency Readiness/Rollback Ease which are 1 hard – 5 easy):

| Candidate | Security | Reliability Value | User Value | Complexity | Operational Risk | Dependency Readiness |
|---|---|---|---|---|---|---|
| Service health diagnostics (read+explain) | 5 (already read-only) | 4 | 4 | 1 | 1 | 5 (mostly exists) |
| Service restart proposal (propose only, human executes) | 4 | 3 | 3 | 2 | 2 | 3 |
| Safe local restart (governed, narrow allowlist) | 2 | 3 | 3 | 4 | 4 | 1 (no governed action type exists yet) |
| Task reprioritization (propose) | 4 | 2 | 3 | 2 | 1 | 3 |
| Project planning (already propose-only) | 5 | 3 | 4 | 1 | 1 | 5 |
| Knowledge refresh (re-index trigger, propose) | 4 | 2 | 2 | 2 | 1 | 4 |
| Coding PR preparation (local commit → human pushes) | 3 | 3 | 4 | 3 | 3 | 2 (push/PR not implemented) |
| Connector reconnect (human-initiated, always) | n/a | n/a | n/a | n/a | n/a | n/a — stays `ESSENTIAL_HUMAN_CONTROL` |
| Notification (in-app) | 5 | 2 | 3 | 1 | 1 | 5 |
| External messaging | 1 | 1 | 2 | 5 | 5 | 1 — frozen, out of scope |
| Merge/deploy | 1 | 1 | 3 | 5 | 5 | 1 — frozen, out of scope |

## Hard Autonomy Prerequisites (Section 21)

Any future automation candidate must have ALL of: a deterministic target
(no free-text guessing of security-sensitive fields — already Phase 7C's
own rule), a policy rule, a risk model, a budget, a kill switch,
idempotency, reconciliation (never blind-retry a possibly-completed
write — already Phase 5F's own pattern), evidence recording, operator
visibility, a rollback path, negative tests, a simulation-first proof,
sandbox/fixture testing, and an incident-response plan. **Every candidate
in Section 20 above is missing at least one of these today** — none are
`READY`.

## Roadmap Options (Section 22)

**Option A — Operational Simplification First.** Close the security debt
found here, retire the confirmed-dead/duplicate legacy surfaces, fix the
boot/SelfHeal stories, update stale docs. Security: 5. Reliability: 4.
User value: 3. Complexity: 2. Operational risk: 1. Dependency readiness: 5.

**Option B — Semi-Autonomous Operations.** Build toward safe recovery
proposals and proactive-operations consolidation before the debt above is
closed. Security: 2 (building on an unaudited base). Reliability: 3. User
value: 4. Complexity: 4. Operational risk: 4. Dependency readiness: 2.

**Option C — AI Capability Expansion.** Local model, voice runtime
richness, deeper reasoning. Security: 3 (neutral — doesn't touch
authority). Reliability: 2 (adds ops burden). User value: 3. Complexity:
4. Operational risk: 2. Dependency readiness: 2.

**Option A wins decisively on every axis that matters most right now
(security, dependency readiness) and is not meaningfully behind on the
others.** Building semi-autonomous operations (Option B) or expanding AI
capability (Option C) on top of an unauthenticated live SSRF-shaped route
would be building on sand.

## Recommended Phase 8 Sequence (Section 23)

- **8A — Operational & Security Debt Closure** (this discovery's direct
  output): fix the unauthenticated route findings (Section 18), correct
  the `/api/browser/extract` manifest/reality mismatch, decide
  retire-vs-adapt for `routes/jarvis.ts` and its 3 legacy `jarvis/*`
  helper files, decide `mi-node-agent`'s fate, fix or remove the stale
  boot script.
- **8B — Legacy Retirement / Simplification**: execute the retirement
  decisions from 8A (route removal, dead-code deletion), consolidate the
  5-loop background-scheduler duplication (Section 15), update stale
  `CLAUDE.md` documentation.
- **8C — SelfHeal / Recovery Intelligence**: wire SelfHeal onto canonical
  health-truth (or retire its independent logic entirely), fix the
  unconditional "Restarted" log line.
- **8D — Runtime Startup & Recovery Certification**: formalize the
  working `pm2 resurrect` path, add the optional preflight check, real
  boot-recovery evidence (matching the existing `WHATSAPP_REBOOT_
  SURVIVAL` precedent but on current F: paths).
- **8E — Proactive Operations** (only after 8A-8D): evaluate whether any
  Section 20 candidate has since become `READY` per Section 21's
  prerequisites. Likely still mostly `NOT_READY` — this phase may find
  little to do, which is an acceptable outcome.
- **8F — Autonomy Candidate Evaluation**: revisit Section 20 with real
  evidence from 8A-8E; only proceed if a candidate genuinely clears every
  Section 21 prerequisite.
- **8G — Phase 8 Hardening / Closure**: same certification discipline as
  Phase 7G — red team, E2E, full regression, production-safe acceptance,
  freeze.

This sequence matches the directive's own hypothesis exactly, with 8A's
scope sharpened by this discovery's actual findings.

## Phase 8A Scope (recommended)

1. Add `requireAuth` (or promote to `requireTaskRuntimeAuth`/
   `requireRemoteAuth` as appropriate) to `/api/browser`, `/api/qb`, and
   the other 15 under-authenticated mounts found in Section 18.
2. Fix `POST /api/browser/extract` to actually call
   `denyAuthorityMutation()` (matching its sibling `/write`) until a
   real governed browser-read adapter is designed — or correct the
   manifest's classification AND add real auth, whichever a fresh
   directive decides; either way, close the reality/metadata gap.
3. Decide and execute: retire vs. formally adapt `routes/jarvis.ts` (49
   routes) and its 3 backing legacy files.
4. Decide: retire vs. keep-blocked `mi-node-agent`.
5. Fix or remove the stale `Mi-Ultimate.vbs`.
6. Re-run the full Phase 7G-style certification (red team, E2E, full
   regression) against whatever 8A actually changes.

**None of this requires new external authority, new capability, or
schema change.**

## Explicit Non-Goals (Section 24)

Gmail SEND, financial execution, desktop control, unrestricted shell,
unrestricted browser (beyond *closing* the `/extract` gap — no
*expansion*), autonomous merge/deploy, voice approval, broad OAuth
expansion. None of these are in scope for Phase 8A or implied by any
finding in this document.

## Schema Recommendation (Section 25)

**NO.** Schema stays v10. Every finding in this discovery is a route/
auth/process-hygiene fix or a code-deletion candidate — none require a
new table, column, or migration.

## Stop Conditions (Section 29) — evaluated, not triggered

Checked against every condition in the directive:

- Production outage: no.
- DB corruption: no (all 3 DBs `integrity_check=ok`).
- Provenance mismatch: no (`AUTHORITY: HEALTHY`, chain verified).
- Unknown mutation: no (`unknownMutations=0` held throughout; every
  surface touched, including the mis-classified `/extract` route, has
  manifest metadata — it's *inaccurate*, not *unknown*).
- Unresolved legacy mutation: no (`unresolvedLegacyMutations=0` held).
- Active Gmail SEND: no (confirmed unreachable, re-verified this phase).
- Financial execution: no (`/api/qb/*` is GET-only, no write capability
  exists in that file).
- Live unauthorized shell/browser path: **considered carefully** —
  `/api/browser/extract` is live, network-gated-only, and genuinely
  under-classified relative to its manifest metadata. Judgment call: this
  does **not** meet the bar for halting discovery entirely, because (a)
  it is gated by the same network-level `applyIpGuard` every other route
  in this class relies on — not open to the raw internet, (b) it
  predates Phase 5 entirely and is exactly the class of debt this
  program has been progressively finding and closing for 7 phases, (c)
  it does not touch shell execution, Gmail, or money movement, and (d)
  fixing it is trivial (one line, matching its own sibling route) and is
  now the explicit #1 item recommended for Phase 8A. Documented
  prominently rather than silently noted, and not fixed here per this
  phase's own discovery-only, no-production-mutation boundary.
- Cross-project leakage: no (re-verified via Phase 7G's still-passing
  red team; no code changed since).
- Secret leak: no.
- Ambiguous production runtime/DB root: no (`F:\Projects\mi-core`
  confirmed as the sole runtime root throughout).
- Phase 7 frozen assumption invalid: **no** — every Phase 7 freeze-policy
  boundary (Gateway uniqueness, project/session isolation, voice-is-not-
  authority, Controlled Action boundary, simulation/live separation) was
  re-verified holding. The finding above is about pre-Phase-5 legacy
  code the freeze policy never claimed to have already fully audited —
  it's new information *about* known debt, not a violation of anything
  Phase 7 asserted.

**No condition requiring a full stop was met. Proceeding to open the
discovery PR as instructed.**

---

## DECISION RECORD

**PHASE 8 RECOMMENDED DIRECTION:**
Option A — Operational Simplification First (operational/security debt
closure before any autonomy consideration).

**PHASE 8A RECOMMENDED FIRST SCOPE:**
Fix the unauthenticated-route findings (starting with `/api/browser/
extract` and `/api/qb/*`), close the `/extract` manifest/reality gap,
decide retire-vs-adapt for the legacy `/api/jarvis` router and its
backing files, decide `mi-node-agent`'s fate, fix the stale boot script.

**NEW EXTERNAL AUTHORITY REQUIRED FOR 8A:**
NO

**AUTONOMY EXPANSION REQUIRED FOR 8A:**
NO

**SCHEMA MIGRATION REQUIRED FOR 8A:**
NO

**PRODUCTION MUTATION PERFORMED DURING DISCOVERY:**
NO
