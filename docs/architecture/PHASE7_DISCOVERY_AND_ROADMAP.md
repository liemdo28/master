# Phase 7 Discovery & Roadmap — JARVIS RELIABILITY / OPERATIONS / UNIFIED EXPERIENCE

Date: 2026-08-13

Discovery + roadmap only. No Phase 7 implementation. No production mutation.
No stopped service started. No OAuth reconnected. No Ollama started. No
authority expanded.

## 1. Executive Summary

"Jarvis" is not one system today — it is **at least five separately-booted
reasoning subsystems** (`jarvis/phase30-jarvis/jarvis-core.ts`,
`routes/jarvis.ts` + `gstack/`, `coo-v4/`, the `communication/` layer, and
`routes/chat.ts` + `pipeline/response-pipeline.ts`) that a single inbound
WhatsApp message can be routed through via a **10+ stage sequential fallback
chain**, with the same `jarvis-core.processJarvisQuery` function invoked at
two separate points in that one chain. Command Center — the one polished,
governed UI this program built across Phases 5–6 — has **21 pages and zero
chat/Jarvis page**; it only talks to the canonical `personal-os`/
`command-center` API surface, so none of the five legacy reasoning engines are
visible from it at all.

The canonical Phase 5F–6G governance stack (`ControlledActionService`,
`ActionPolicyEngine`, kill switches, budgets, delegation, the Phase 6A/6B
authority scanner) is sound and correctly enforced everywhere it is the only
path — but this discovery found **three live paths that mutate state or
trigger real external sends without going through it**:

1. `node-agent.mjs`'s `POST /exec` — runs arbitrary shell commands via
   `execSync`, gated only by a bypassable denylist, **with no authentication
   check at all** before reaching it.
2. `server/src/jarvis/autonomous-task-runner.ts`'s `runApprovedTask()` — runs
   `execAsync(approval.auto_command, ...)` after approval through a
   **separate, jarvis-specific approval store** (`jarvis/approval-conversation.ts`),
   not `personal-os/actions/governance/`.
3. `services/whatsapp-ai-gateway`'s `reply-service.js` — can call
   `client.sendMessage()` directly against a live WhatsApp session, gated only
   by the **legacy** `server/src/approval/gate.ts`, not the Controlled Action
   pipeline.

None of these three are new — they predate this discovery — and none were
exercised or triggered during this read-only audit. But they mean the
"everything mutating flows through governed `ControlledActionService`"
assumption that Phase 6's authority-manifest scanner enforces for *HTTP
routes* does **not** hold for these three code paths, because two of them
(#1, #2) aren't HTTP routes the scanner inventories the same way, and #3 lives
in a separate PM2 process outside the scanner's reach entirely. This is the
single most important finding of this discovery and drives the Phase 7A
recommendation below.

Separately, and less urgently: the canonical Phase 6E knowledge-retrieval
system is bypassed by both the chat pipeline and the Jarvis reasoning path (it
is only wired into the Daily Operating Brief); the Python `ai-service` process
is functionally orphaned (all real generation calls go straight from Node to
Ollama); and two "Jarvis memory" files carry hardcoded stale paths
(`E:/Project/Master`, a hardcoded `C:/Users/liemdo` path) left over from
before the D:→F: migration — the same bug class that caused the original
production outage, just not yet on the PM2-critical path.

**Recommended direction: reliability/safety-boundary-first (Option A in
Section 32), not UX-first.** A unified Jarvis experience is not safe to design
on top of a foundation with three unguarded write paths and a boot-recovery
gap that has already caused one real outage this program.

## 2. Authoritative Baseline (independently re-verified 2026-08-13)

| Item | Value | Verified |
|---|---|---|
| `origin/master` | `4ea1791776abc8ffa439d5229a52bbcc0df73f27` | ✅ matches expected |
| Functional deployed SHA | `5660c03900dc1b343e4c11cef97ec4abb4860c54` | ✅ `.env`/snapshot-manifest.json aligned |
| Production schema | Personal OS **v10** | ✅ `personal-os.db` `schema_migrations` max=10 |
| Phase 6G decision | NO NEW AUTHORITY APPROVED | ✅ per closure docs |
| PM2 fleet | `mi-core` (PID 21728, 0 restarts), `mi-ai-service`, `mi-accounting`, `mi-node-agent` (0 restarts each), `qb-ops-agent` (1 restart, pre-existing) all `online`, correct `cwd`/`script` under `F:\Projects\mi-core` | ✅ no stale paths |
| `mi-ceo-observer`/`mi-whatsapp-gateway`/`mi-n8n` | not running | ✅ confirmed absent from `pm2 jlist` |
| Health | `{"server":"ok","python_ai_service":"ok","ollama":"down"}` | ✅ Ollama down, honestly unchanged, not silently claimed recovered |
| Authority | `unknownMutations: 0`, `unresolvedLegacyMutations: 0`, `total: 1076` | ✅ |
| DB integrity | `integrity_check=ok`, 0 FK violations, all 3 DBs | ✅ |
| Google OAuth | not connected (empty `GOOGLE_REFRESH_TOKEN`, no `google-tokens.json`) | ✅ unchanged, not reconnected |
| PM2_HOME | unset → defaults to `%USERPROFILE%\.pm2` | ✅ confirmed via env check |
| Windows Scheduled Task for PM2 | **none found** | ✅ `schtasks /query` — zero matches for pm2/mi-core |
| Windows Service for PM2 | **none found** | ✅ `sc.exe query` — zero matches |

No production mutation was performed at any point in this discovery.

## 3. Current Jarvis Definition (from real code, not assumption)

Five distinct, independently-live subsystems all self-identify as "Jarvis" or
serve the same conversational-assistant role:

| Subsystem | Entry point | Mounted? | Manifest status |
|---|---|---|---|
| `jarvis/phase30-jarvis/jarvis-core.ts` | `bootJarvis()`, called `index.ts:571-573` at startup | Yes | not a single HTTP surface — internal orchestrator boots `phase21`–`phase29` submodules |
| `routes/jarvis.ts` | `/api/jarvis` | Yes, `index.ts:307` | `ADAPTER_TO_CANONICAL`/`ADAPTED` |
| `gstack/` (`intent-router.ts`, `gstack-orchestrator.ts`) | `/api/gstack` | Yes, `index.ts:331` | `LEGACY_QUARANTINED`/`QUARANTINED` (9 routes) |
| `coo-v4/` | `/api/coo-v4` | Yes, `index.ts:339` | `LEGACY_QUARANTINED`/`QUARANTINED` (13 routes) |
| `communication/` (`natural-conversation-engine.ts`, `natural-intent-router.ts`, `mi-human-assistant.ts`) | reached from `routes/whatsapp.ts:809,874` | Yes (indirectly) | uncatalogued in the authority manifest |
| `routes/chat.ts` + `pipeline/response-pipeline.ts` | `/api/chat` | Yes, `index.ts:306` | `ADAPTER_TO_CANONICAL`/`ADAPTED` |

**The WhatsApp inbound chain** (`routes/whatsapp.ts` `POST /mi`) is a single
waterfall with 10+ short-circuit stages (comment markers at lines 464, 603,
625, 655, 693, 716, 740, 777, 807, 828, 873, 893, 917, 965, 1062): approval
commands → fingerprint dedup → statement guard → multi-intent executor →
finance-truth QB answer → `tryJarvisReadOnlyReply` → execution engine
`processCEORequest` → **jarvis-core `processJarvisQuery` (first call, line
779)** → `handleMiHumanAssistant`/natural-conversation-engine → skill
registry → `handleMiHumanAssistant` fallback (second try) → `routeCeoCommand`
→ **jarvis-core `processJarvisQuery` (second call, line 919)** → `runPipeline`
fallback. `jarvis-core.ts` itself separately calls
`executive-personality.ts`, which calls `gstack-orchestrator.processGStackRequest`
when its own gate fires — meaning a single message can, depending on which
regex/classifier matches first, be answered by up to **five different reasoning
engines**, with no single canonical path.

`POST /api/chat` (the HTTP-native entrypoint, separate from WhatsApp) is
architecturally parallel and non-overlapping: it never imports `personal-os/`
or `task-runtime/` at all, has its own conversation store
(`chat/conversation-store.ts`) and its own executive-memory
(`memory/executive-memory.ts`), and ends in `askAiWithBrain()` →
`services/ai-client.ts` → `providers/provider-router.ts` (Ollama, with an
external-provider fallback chain).

## 4. Component Map

| Component | Path | Runtime | Live? | Authority | Phase 7 recommendation |
|---|---|---|---|---|---|
| ControlledActionService | `personal-os/actions/service.ts` | mi-core | Yes | Canonical, frozen | Preserve |
| ActionPolicyEngine / RiskEvaluator | `personal-os/actions/governance/` | mi-core | Yes | Canonical, frozen | Preserve |
| Personal OS orchestration | `personal-os/orchestration/` | mi-core | Yes | `CANONICAL_GOVERNED_ORCHESTRATION` | Preserve |
| Authority Control Plane scanner | `authority-control-plane/` | mi-core | Yes | Canonical, frozen | Preserve |
| AutomationSimulationService | `personal-os/automation-simulation/` | mi-core | Yes | Canonical, frozen (Phase 6F) | Preserve |
| `jarvis/phase30-jarvis/jarvis-core.ts` | ditto | mi-core | Yes | uncatalogued | Consolidate (see §31) |
| `jarvis/autonomous-task-runner.ts` | ditto | mi-core | Yes | **ungoverned direct exec** | **Retire or fully re-platform onto governance (Phase 7A)** |
| `gstack/` | ditto | mi-core | Yes | `LEGACY_QUARANTINED` | Quarantine (already is) — evaluate retire |
| `coo-v4/` | ditto | mi-core | Yes | `LEGACY_QUARANTINED` | Quarantine (already is) — evaluate retire |
| `communication/` layer | ditto | mi-core | Yes | uncatalogued | Adapt or retire |
| `routes/chat.ts` + `response-pipeline.ts` | ditto | mi-core | Yes | `ADAPTED` | Consolidate toward personal-os (see §9) |
| `node-agent.mjs` `/exec` | root | mi-node-agent (separate process) | Yes, **unauthenticated** | not scanned by authority-control-plane at all | **Fix immediately (Phase 7A) — narrow or retire** |
| `voice/` inbound | `voice/transcription-service.ts`, `tts-service.ts` | mi-core | Yes (inbound only) | Quarantined for outbound | Preserve boundary, adapt for 7F |
| `voice-output-orchestrator.ts`, `whatsapp-voice-handler.ts` | `voice/` | mi-core | **No — never imported anywhere** | dead code | Retire or finish-and-govern |
| `whatsapp-ai-gateway` | separate process | stopped | N/A (process stopped) | send capability ungoverned when running | Re-platform onto Controlled Actions before restart (Phase 7A/7C) |
| `mi-n8n` | separate process | stopped | N/A | writes correctly `denyAuthorityMutation`'d | Fine as-is; evaluate long-term relevance |
| `mi-ceo-observer` | separate process | stopped | N/A | read-only ingest, no send | Low risk; candidate for consolidation into Operating Loop |
| `mi-accounting` | separate process | running | Yes | read/reporting only, no external financial write found | Preserve boundary |
| `qb-ops-agent` | separate process | running | Yes | heartbeat/poll only; SOAP subsystem still broken (missing `express` dep) | Out of scope for Phase 7 |
| Provider routing (×2 files) | `providers/provider-router.ts`, `engineering/providers/provider-router.ts` | mi-core | Both live, different callers | n/a | Consolidate (see §31) |
| `ai-service` (Python) | `ai-service/main.py` | separate process | Running but **functionally unused** for generation | n/a | Retire or repurpose (Phase 7A/7B) |
| Knowledge stores (×4) | `knowledge/knowledge-db.ts`, `knowledge-federation/`, `jarvis/phase21-knowledge/`, `personal-os/documents/` (canonical) | mi-core | All 3 legacy live; canonical narrowly wired | n/a | Consolidate toward canonical (see §31) |

## 5. Runtime Fleet

| Process | Purpose | Required for Jarvis? | Status | Safe to auto-start? |
|---|---|---|---|---|
| `mi-core` | Central server, all governed APIs, all 5 legacy Jarvis reasoning paths | Yes — core | online, healthy | Yes (already is) |
| `mi-ai-service` | Python FastAPI Ollama wrapper | **No** — unused for real generation (§8) | online, healthy but idle | Yes, low priority |
| `mi-accounting` | Internal accounting reporting | Indirectly (finance-truth QB answers in WhatsApp chain) | online, healthy | Yes |
| `mi-node-agent` | Secondary-device registration + **unauthenticated remote exec** | Not required for core Jarvis; optional device mesh | online, `BLOCKED_RUNTIME` (registration fails), **security gap live** | **No — fix auth + narrow `/exec` before considering auto-start policy** |
| `mi-ceo-observer` | Reads CEO's own WhatsApp, classifies signals, forwards to `/api/whatsapp/mi` | Optional signal source, not core | intentionally stopped | Not evaluated this cycle (stays stopped) |
| `mi-whatsapp-gateway` | Real WhatsApp session, inbound/outbound | The only way WhatsApp UX works | intentionally stopped | Not evaluated this cycle (stays stopped) |
| `mi-n8n` | Real n8n binary wrapper, workflow metadata | Optional; overlaps with `personal-os/orchestration/` | intentionally stopped | Not evaluated this cycle (stays stopped) |
| `qb-ops-agent` | QuickBooks heartbeat/workflow poll | No | online, healthy (SOAP subsystem broken, unrelated) | Yes |
| `pm2-logrotate` | Log rotation module | Infra only | online | Yes |

## 6. User Surface Inventory

| Surface | Classification |
|---|---|
| Command Center (21 pages: Today, Plan, Approvals, Actions, Governance, Plans, Delegations, Goals, Projects, Tasks, Knowledge, Memory, Calendar, Inbox, Coding, Health, Reviews, Operator, Evidence, Simulation, Authority, Settings) | CANONICAL_ACTIVE (governance primitives only — **no chat/Jarvis page exists**) |
| `/api/chat` | LEGACY_ACTIVE |
| `/api/jarvis` | LEGACY_ACTIVE (`ADAPTED`) |
| `/api/gstack` | LEGACY_QUARANTINED |
| `/api/coo-v4` | LEGACY_QUARANTINED |
| WhatsApp (via gateway) | INTENTIONALLY_STOPPED |
| Voice inbound (`/api/voice/transcribe`, `/ask`) | CANONICAL_INCOMPLETE (live, but not integrated with canonical retrieval — §11) |
| Voice outbound | LEGACY_QUARANTINED (route-level deny) + DEAD (orchestrator never imported) |
| CLI (`personal-os/cli.ts`, `coding/cli.ts`, `project-registry/cli.ts`) | CANONICAL_ACTIVE, operator-only, not end-user Jarvis UX |
| Daily briefing (WhatsApp delivery) | CANONICAL_ACTIVE but **currently a silent no-op** (gateway stopped, fetch fails, swallowed) |
| Proactive suggestions (WhatsApp delivery) | CANONICAL_ACTIVE, same silent-no-op condition |
| Simulation UI (`/simulation` in Command Center) | CANONICAL_ACTIVE (Phase 6F) |

## 7. Canonical vs Legacy vs Dead vs Quarantined (summary)

- **Canonical, frozen, working correctly:** `personal-os/actions/`,
  `personal-os/orchestration/`, `personal-os/delegation/`,
  `authority-control-plane/`, `personal-os/automation-simulation/`,
  `personal-os/documents/` (narrowly wired), Command Center.
- **Legacy, live, quarantined correctly (good discipline, no action needed):**
  `/api/gstack`, `/api/coo-v4`, `/api/voice/output/*`, `/api/n8n` write routes.
- **Legacy, live, NOT quarantined and NOT authenticated (needs Phase 7A
  attention):** `node-agent.mjs` `/exec`, `jarvis/autonomous-task-runner.ts`,
  `whatsapp-ai-gateway`'s direct `client.sendMessage()` path.
- **Legacy, live, uncatalogued in the authority manifest at all:**
  `communication/` layer, `jarvis/phase30-jarvis/*`, `jarvis/phase21-knowledge/*`.
- **Dead (present in source, never imported/reachable):**
  `voice-output-orchestrator.ts`, `whatsapp-voice-handler.ts`.

## 8. Authority Boundaries — the three real gaps

1. **`node-agent.mjs` `POST /exec`** (`node-agent.mjs:144-167`): runs
   `execSync(command, { cwd, timeout: 10_000 })` with only a bypassable
   denylist (`rm `, `del `, `format `, `mkfs`, `dd if=`, `shutdown`, `reboot`)
   and **zero authentication** — reachable by anyone who can reach port 4004.
   The manifest correctly quarantines the *mi-core-side* `/api/nodes/:id/exec`
   dispatch route, but has no visibility into node-agent's own listener,
   which is a separate process the scanner never inspects.
2. **`jarvis/autonomous-task-runner.ts` `runApprovedTask()`**
   (line 43-60): runs `execAsync(approval.auto_command, ...)` after approval
   through `jarvis/approval-conversation.ts` — a completely separate approval
   store from `personal-os/actions/governance/`, with its own allowlist regex
   instead of `ActionPolicyEngine`/`RiskEvaluator`/kill-switch/budget checks.
3. **`whatsapp-ai-gateway`'s `reply-service.js:37`** `client.sendMessage()`:
   real outbound WhatsApp send, gated on the mi-core side only by the legacy
   `approval/gate.ts` (`routes/whatsapp.ts:834-851,984-1043`), never by
   `personal-os/actions/router.ts`.

None of these were triggered or exercised during this discovery. All three
predate Phase 7 and were not introduced by any prior phase's work — they are
architectural debt from before the Phase 5F/5G/6A governance stack existed,
never retrofitted.

## 9. Context/Memory

Five distinct persistence layers self-describe as Jarvis/executive memory:

| Store | Backing | Canonical owner | Notes |
|---|---|---|---|
| `personal-os.db` | SQLite, `personal-os/store.ts` | Canonical | schema v10 |
| `executive-memory-v2/*.json` | flat JSON files, `memory/executive-memory.ts` | Legacy | read directly by `routes/chat.ts` |
| `operational-memory/memory.db` | SQLite, `operational-memory/operational-memory-db.ts` | Legacy | backs `/api/memory/*` |
| same `memory.db`, read independently | `strategic-memory/strategic-memory-engine.ts:12-20` | Legacy | **hardcoded default root `E:/Project/Master/mi-core`** — stale, pre-migration |
| `memory-registry.json` | `jarvis/phase22-memory/memory-registry.ts:32` | Legacy | **hardcoded fallback path under a specific `C:/Users/liemdo/...` profile** — stale, pre-migration, machine-specific |

The two hardcoded-path files are not currently on the PM2 critical boot path
(they didn't cause the earlier outage), but they are the same class of latent
bug — silent misdirection after any future drive/user-profile change — and
should be fixed opportunistically whenever those files are next touched, not
as urgent Phase 7A work.

No new memory database should be created (per directive constraint) — Phase 7
should consolidate reads onto `personal-os.db` + `operational-memory/memory.db`,
not add a sixth store.

## 10. Knowledge/Retrieval Integration

**The canonical Phase 6E retrieval system (`personal-os/documents/retrieval.ts`)
is bypassed by both the chat pipeline and the Jarvis reasoning path.** Its
only in-code caller is `personal-os/operating/brief.ts:20` (the Daily
Operating Brief). Three separate legacy implementations exist instead:

1. `knowledge/knowledge-db.ts` (SQLite FTS5) — used by `response-pipeline.ts`.
2. `knowledge-federation/index.ts` (aggregates knowledge-db + JSON memory +
   markdown reports + a filesystem "US Compliance DB") — used by `chat.ts`'s
   general-fallback path.
3. `jarvis/phase21-knowledge/knowledge-indexer.ts` ("Knowledge Universe") —
   used by `jarvis-core.ts`.

Citations exist as real machinery (`personal-os/documents/citations.ts`) but
**never reach the user in the actual chat/Jarvis response** —
`response-pipeline.ts` returns only a bare `sources: string[]` label list
(e.g. `'knowledge-db'`), no document IDs/URIs/excerpts. A
`retrieveWithCitations()` helper exists in `knowledge-federation/index.ts:307`
but is never called.

Project-boundary enforcement, stale/conflict metadata, and no-answer behavior
— all proven correct within Phase 6E's own test suite — do not currently
protect the live chat/Jarvis answer path at all, because that path never
calls into Phase 6E.

## 11. Planning/Tasks/Projects Integration

`PersonalOsService.planGoal()` (`personal-os/service.ts:50-163`) directly
instantiates `TaskEngine` and calls `createTask`/`transition` — a **direct
write path to `task-runtime/store.ts`**, gated only by tasks landing in
`WAITING_APPROVAL` status (an app-level convention), not by
`ControlledActionService`'s policy/risk/kill-switch/budget machinery.
`activateGoal()` similarly writes goal status directly. This is reachable via
`personal-os/router.ts` (`POST /goals/:id/plan`, `/activate`).

The legacy Jarvis subsystem (`jarvis/`, `routes/jarvis.ts`) is **entirely
disjoint** from `personal-os`/`task-runtime`/`project-registry` — zero import
matches found. It has its own separate approval mechanism (§8, item 2).

The only fully governed mutation path for tasks/projects/goals-adjacent
actions is `ControlledActionService` for `LOCAL_TASK_DRAFT`,
`LOCAL_STATE_UPDATE`, `CODING_TASK_APPROVAL` — narrower in scope than what
`planGoal()`/`activateGoal()` actually do.

## 12. Proactive / Operating Loop

Clear READ/ANALYZE vs WRITE/EXECUTE/NOTIFY split found:

- **READ/ANALYZE only, not scheduled:** `DailyOperatingLoop`
  (`personal-os/operating/loop.ts`) — not wired to any cron/timer in
  `index.ts`; reachable only via on-demand HTTP call.
- **READ/ANALYZE, scheduled, live:** sync scheduler, burn-in scheduler,
  self-healing scheduler/monitor, leader heartbeat.
- **NOTIFY, scheduled, live, currently silently failing:** `jarvis/proactive-monitor.ts`
  (15-min cycle, `fire()` → `queueToCeo()` → real WhatsApp POST) and
  `jarvis/daily-briefing-scheduler.ts` (07:00 VN, same `queueToCeo()` path).
  Both attempt a real network send every cycle; with the gateway stopped,
  `whatsapp-sender.ts:52-71`'s fetch throws, is caught, logged to a local
  `outbox.json` with `delivered:false`, and swallowed
  (`whatsapp-sender.ts:154`, `.catch(() => {})`) — no crash, no alert, just a
  silent no-op. An operator has no way to see this failure without reading
  `outbox.json` directly.

**A proactive assistant currently only reaches "propose" via a channel
(WhatsApp) that is off.** No proactive code path was found that gains
autonomous execution authority — every write found funnels either through
`ControlledActionService` (governed) or `queueToCeo` (a notification attempt,
not an execution).

## 13. Voice

Inbound transcription (`POST /api/voice/transcribe`, `/ask`) and TTS synthesis
(`POST /api/voice/output/speak`) are live and reachable. Outbound/mutating
voice — daily-brief-by-voice, voice-triggered send — is **explicitly denied**
at the route layer (`voice.ts:208-215`, `denyAuthorityMutation(...'quarantined
in Phase 6A')`) and the code that *would* perform the send
(`voice-output-orchestrator.ts`, `whatsapp-voice-handler.ts`) is **never
imported anywhere** — dead, not just quarantined. No wake-word implementation
exists. This is the cleanest-boundaried subsystem found in this discovery —
Phase 7 should preserve this pattern as the model for how the other two real
gaps (§8) should be fixed.

## 14. WhatsApp

`whatsapp-ai-gateway` is a real whatsapp-web.js/Puppeteer client with ~30
integrated subsystems (food-safety pipeline, OCR, sensor forwarding, Telegram
relay). Per-client API keys, server-side validated, audited. **Can send real
messages** via a direct client call, gated on mi-core's side only by the
legacy `approval/gate.ts`, never the Controlled Action pipeline. Not started
this cycle, not evaluated for restart.

## 15. n8n

`n8n-start.js` spawns the literal n8n binary (not a custom engine). Reads
proxy live through `n8n-router.ts`; every write route
(`trigger/:id`, `execution/:id` DELETE, `evidence` POST) is explicitly
`denyAuthorityMutation`'d — correctly quarantined, good discipline. Overlaps
conceptually with `personal-os/orchestration/` (both are DAG-style workflow
systems) but n8n's own mutation surface cannot be reached through `server/src`
at all currently. Not started this cycle.

## 16. CEO Observer

Reads the CEO's own WhatsApp session (separate Puppeteer instance from the
gateway), classifies with regex NLP, forwards matches to mi-core's
`/api/whatsapp/mi` (same ingest endpoint the gateway uses). No outbound-send
code found anywhere in the service. Only self-contained mutation is a local
policy-whitelist JSON file it owns. Not started this cycle.

## 17. Accounting / QB-Ops-Agent / Financial Boundary

`mi-accounting`'s `server.js` exposes only reporting-shaped routes (`/stats`,
`/qa`, `/patches`, `/sessions`, `/models`, `/costs`, `/risks`) over an
internal SQLite DB, bound to `127.0.0.1:8844` with a loopback-only guard — no
bank/payment SDK import found. `qb-ops-agent`'s QuickBooks write path
(`qbxml-client.ts`) is an explicit stub that always returns `success:false`
("not enabled in Phase 1... intentionally read-only") — confirmed still true.
The SOAP subsystem (`qbwc-server.ts`) still imports `express`, which is still
absent from `package.json` dependencies — still cannot boot. **No financial
execution authority exists anywhere in this codebase.** This boundary is
intact and Phase 7 must not weaken it.

## 18. AI Provider Routing

Two independent, unrelated "provider router" implementations exist:
`providers/provider-router.ts` (used by `chat.ts`/pipeline; has a circuit
breaker, timeouts, an `openai-compatible → anthropic → openai → gemini →
deepseek → minimax → ollama` fallback chain) and
`engineering/providers/provider-router.ts` (used only by `/api/ai`, raw
`https.request`, no retry/circuit-breaker/timeout policy visible). At least 5
more direct Ollama call sites exist scattered across `model-router/`,
`coding/llm/`, `executive-intelligence/`, `models/`, and `coo-v4/agents/`,
each with its own ad hoc timeout handling — no shared policy.

**The Python `ai-service` process is functionally orphaned**: its `/chat`
endpoint has zero callers anywhere in `server/src` for real generation — every
actual generation call goes straight from Node to Ollama's `:11434`. The only
things that talk to `ai-service` are health-check pings. It degrades cleanly
on a cold Ollama-down check (`503`) but not on a mid-call Ollama drop
(unhandled `ConnectError` → uncaught `500`).

## 19. Health Model

Current `/api/health` reports exactly 3 fields: `server`, `python_ai_service`,
`ollama`. It does not reflect authority state, DB integrity, knowledge-store
health, or any of the 9 background schedulers found in §12. `python_ai_service:
ok` is truthful about the process being alive but doesn't reflect that it's
functionally unused (§18) — a healthy-but-useless status that could mislead
an operator.

**Design target for Phase 7B** (not implemented here):

```
CORE                 = HEALTHY
AI (Node→Ollama path) = <AVAILABLE|DEGRADED|UNAVAILABLE>
PYTHON_AI_SERVICE     = <alive, but flag as UNUSED-FOR-GENERATION>
KNOWLEDGE             = HEALTHY | STALE
DATABASE              = integrity_check + schema version
AUTHORITY             = unknownMutations / unresolvedLegacyMutations
EXTERNAL_CONNECTORS   = GOOGLE: DISCONNECTED, WHATSAPP: DISABLED
BACKGROUND_SERVICES   = per-scheduler last-run/last-error
```

A local-model outage must never report the whole assistant as DOWN — §12
already proves most of Jarvis's deterministic value (briefing, task
intelligence, knowledge search per Phase 6E) needs no LLM at all.

## 20. Boot / Recovery

No Windows Scheduled Task, no Windows Service, `PM2_HOME` unset (defaults to
`%USERPROFILE%\.pm2`) — all independently reconfirmed this session. This
exact gap caused the mid-Phase-6 production outage (D:→F: migration + reboot
→ all 8 PM2 app definitions unresurrectable, no OS-level recovery mechanism).
The underlying PM2 config bug was fixed (hotfix PR #93); the auto-start gap
itself remains, per standing instruction not to install a startup mechanism
opportunistically.

Comparison of approaches for a future Phase 7A decision (not decided here):

| Approach | Reliability | Observability | Rollback | Security | Maintenance | Path portability |
|---|---|---|---|---|---|---|
| A. Windows Scheduled Task (run `pm2 resurrect` at logon/boot) | Medium (user-session dependent unless "run whether user logged on or not") | Low (Task Scheduler history only) | Easy (`schtasks /delete`) | Medium (runs as a specific user) | Low | High if the task itself uses `%~dp0`-relative paths |
| B. Windows Service wrapper (e.g. `node-windows`, NSSM) | High (survives logoff, no session dependency) | Medium (Windows Event Log) | Medium (service uninstall) | Needs careful account/permission choice | Medium (new dependency) | High if paths are relative |
| C. Explicit bootstrap script, manually run post-reboot | Low (fully manual) | High (script can log verbosely) | Trivial | High (no new privilege) | Low | High |
| D. Repository-consistent mechanism (a `recovery-cli` per §34) | Depends on trigger | High if designed for it | Easy | Depends | Medium (new code) | High by design |

## 21. Deployment / Provenance Model

Confirmed working end-to-end across Phases 6D/6F/6G:
`git master → clean worktree build (npm ci, tsc, vite build) → deploy-owned
source snapshot (build-snapshot-cli.ts) → server/dist + server/src copied to
runtime → .env markers updated (MI_DEPLOYED_SOURCE_SHA/_ROOT) → PM2
delete+start only the changed process → authority scanner reads from the
snapshot, not the mutable git checkout`. This is deterministic and no longer
depends on any mutable working directory for the scanner (that was Phase 6D's
own fix). Phase 7 should not need to change this model.

## 22. Backup / Restore Model

Confirmed working: online-safe SQLite backup (`Database.backup()`, not raw file
copy) for all 3 DBs, source/backup checksum comparison, `integrity_check`/
`foreign_key_check` verification, `ROLLBACK_NOTE.md` per backup, 10+ historical
backups retained under `mi-core-production-backups/`, none ever deleted. No
missing-restore-drill gap was found in this discovery — restores were
exercised for real during the F-drive incident recovery (this program's
biggest real-world test of the backup strategy, and it worked).

## 23. Incident Lessons (Phases 5–6)

| Incident | Root cause | Detection gap | Recovery gap | Prevention opportunity |
|---|---|---|---|---|
| D:→F: drive migration outage | No OS-level auto-resurrect; `ecosystem.config.js` had hardcoded absolute paths for 3 apps + missing `qb-ops-agent` entry | No health monitoring ran while down (nothing to detect against) | Manual, multi-hour recovery | §20 boot-recovery mechanism |
| Authority source/dist provenance mismatch (Phase 6D) | Scanner read from `process.cwd()`, not a pinned snapshot | Manifest silently reported stale counts | Root-caused via manual comparison | Fixed permanently (deploy-owned snapshot) |
| Duplicate `safe.directory` fix (PR #92 vs #93 merge conflict) | Two branches independently fixed the same test | CI mergeability flag caught it | Rebase + semantic merge | Working as intended — this is the system catching itself |
| Transient CI flake (`coding-workflow.test.ts` cancel-during-validation race) | Timing-dependent test, CI-runner-speed-sensitive | None (test itself is the detector) | Re-run confirmed transient | Follow-up task already spawned (task_94acfc62) |
| `mi-node-agent` unauthenticated `/exec` (this discovery) | Never had auth from the start, not a regression | **No detection exists today** | N/A — never triggered | §8 |
| Hardcoded stale memory-store paths (this discovery) | Pre-migration hardcoding, never revisited | No detection — silent misdirection | N/A — not yet triggered | §9 |

## 24. UX Fragmentation

An operator today **cannot** answer "what is Jarvis thinking/proposing/
waiting on" from one page. Command Center's 21 pages cover governance
primitives well (Authority, Operator, Evidence, Simulation, Approvals,
Delegations) and productivity primitives (Today, Tasks, Projects, Goals,
Knowledge, Calendar) — but none of them surface the 5 legacy reasoning
engines' state, the 9 background schedulers' last-run/last-error, or the
silent WhatsApp-delivery-failure condition from §12. An operator would need to
cross-reference the PM2 CLI, raw log files, and `outbox.json` — none of which
are in the UI — to understand why a proactive suggestion never arrived.

## 25. Capability Matrix

| Capability | Current state | Can read | Can propose | Can simulate | Can request approval | Can execute | Authority source | Runtime status | Phase 7 recommendation |
|---|---|---|---|---|---|---|---|---|---|
| Conversation | Fragmented, 5 engines | Yes | Yes (chat.ts approvals) | No | Yes (2 separate mechanisms) | Partial (see §8) | Mixed | live | Consolidate (§9, §31) |
| Knowledge | 4 implementations, canonical narrow | Yes | n/a | n/a | n/a | n/a | Mixed | live | Consolidate onto Phase 6E |
| Tasks | direct-write bypass exists | Yes | Yes | via 6F sim | partial | direct (bypass) | Mixed | live | Route through governance |
| Projects | same as Tasks | Yes | Yes | via 6F sim | partial | direct (bypass) | Mixed | live | Route through governance |
| Goals | same as Tasks | Yes | Yes | via 6F sim | partial | direct (bypass) | Mixed | live | Route through governance |
| Planning | canonical exists (`orchestration/`) | Yes | Yes | via 6F sim | Yes | Yes (governed) | Canonical | live | Preserve |
| Simulation | canonical, frozen | Yes | n/a | Yes | n/a | never (by design) | Canonical | live | Preserve |
| Controlled Actions | canonical, frozen | Yes | Yes | Yes | Yes | Yes | Canonical | live | Preserve |
| Delegation | canonical, frozen | Yes | n/a | Yes | Yes | Yes (bounded) | Canonical | live | Preserve |
| Operator | canonical | Yes | n/a | n/a | n/a | n/a | Canonical | live | Preserve, extend (§19) |
| Coding | canonical (Agentic Coding) | Yes | Yes | n/a | Yes | Yes (sandboxed) | Canonical | live | Preserve |
| Voice | inbound live, outbound dead/quarantined | Yes (inbound) | No | No | No | No | Quarantined | live (inbound) | Preserve boundary, extend read-only |
| WhatsApp | stopped, send capability ungoverned | n/a | n/a | n/a | legacy gate only | Yes (if restarted) | **Ungoverned** | stopped | Re-platform before restart |
| Notifications | live but silently failing | n/a | n/a | n/a | n/a | attempts real send | Mixed | live (broken) | Fix health visibility (§19) |
| Accounting | reporting only | Yes | No | No | No | No | n/a | live | No change needed |
| Browser | quarantined, legacy | n/a | n/a | n/a | n/a | No (quarantined) | Quarantined | dormant | Out of scope (Phase 6G already deferred) |
| Desktop | not implemented | n/a | n/a | n/a | n/a | n/a | n/a | n/a | Explicit non-goal |

## 26. Duplication Matrix

| Duplicated concept | Instances found | Recommendation |
|---|---|---|
| Conversational reasoning engine | jarvis-core, gstack, coo-v4, communication/, chat.ts (5) | CONSOLIDATE toward one canonical gateway (§33, 7C) |
| Approval mechanism | `personal-os/actions/governance` (canonical), `approval/gate.ts` (legacy, whatsapp.ts), `jarvis/approval-conversation.ts` (legacy, autonomous-task-runner.ts) (3) | CONSOLIDATE onto canonical; retire the other two |
| Planner/orchestrator | `personal-os/orchestration/` (canonical), `coo-v4` orchestrator, `gstack-orchestrator`, `jarvis/phase27-workflows/workflow-runner.ts` (4) | QUARANTINE non-canonical (mostly already are), evaluate retire |
| Memory/context store | `personal-os.db`, `executive-memory-v2/`, `operational-memory/memory.db`, `strategic-memory` (reads same DB), `jarvis/phase22-memory/` (5, 2 with stale paths) | CONSOLIDATE reads onto `personal-os.db` + `operational-memory/memory.db`; fix stale paths; no new DB |
| Knowledge/retrieval | `knowledge-db.ts`, `knowledge-federation/`, `phase21-knowledge/`, `personal-os/documents/` (canonical) (4) | CONSOLIDATE onto canonical (§10) |
| Provider router | `providers/provider-router.ts`, `engineering/providers/provider-router.ts` (2), plus 5+ direct Ollama call sites | CONSOLIDATE onto one router with shared timeout/retry/circuit-breaker |
| Health model | current 3-field `/api/health` vs the richer truth each subsystem actually has | CONSOLIDATE into the §19 target model |
| Notification/send path | `queueToCeo`/`whatsapp-sender.ts` (proactive+briefing), `whatsapp-ai-gateway`'s own send, `voice` (blocked) | CONSOLIDATE send authorization onto governance before any restart |

## 27. Security Boundaries

| Threat | Mitigated by | Gap found this cycle |
|---|---|---|
| Prompt injection | `assertPlainPayload` (prototype-pollution guard), strict allowlist parsing in simulation router | Chat/Jarvis path's free-text `askAi` calls (e.g. `memory_save` intent extraction) not separately hardened — **not audited this cycle, flag for 7B/7C** |
| Authority confusion | Phase 6A/6B scanner, `CANONICAL`/`ADAPTER`/`QUARANTINED`/`FORBIDDEN` classification | Does not cover `node-agent.mjs` or separate PM2 processes (§8) |
| Voice spoofing/replay | No voice-triggered write path exists at all (§13) | n/a — mitigated by absence |
| Stale approval | `approval/gate.ts` and `personal-os/actions/governance/` both have expiry concepts | Two separate expiry implementations, not unified |
| Cross-project leakage | Phase 6E's project-boundary tests | Chat/Jarvis path doesn't use Phase 6E at all (§10) — **its own project-scoping was not audited this cycle** |
| Process execution | `personal-os/actions/` has no exec capability by design | `node-agent.mjs` `/exec` and `jarvis/autonomous-task-runner.ts` (§8) |
| Browser automation | `LEGACY_QUARANTINED` at the route layer | Consistent with Phase 6G's explicit deferral |
| Provider ambiguity | Phase 6F's `AMBIGUOUS_RESULT` scenario, reconciliation-required flag | Not yet applied to any new Phase 7 candidate — n/a until one exists |
| Secret leakage | `.env` never printed in any audit this program has run; name-only config scans | None found this cycle |
| Service impersonation | `whatsapp-ai-gateway` per-client API keys, `x-node-secret` header on mi-core→node-agent leg | `node-agent.mjs`'s own `/exec` has no equivalent check (§8) |
| Local network trust | `node-agent.mjs` binds `0.0.0.0:4004` | Same finding — anyone on the LAN can reach `/exec` unauthenticated |
| Replay | idempotency keys throughout `personal-os/actions/` | Not applicable to the three ungoverned paths (§8) — they have no idempotency concept at all |

## 28. Roadmap Options

**Option A — Reliability-first (recommended).** Fix the three ungoverned
mutation paths (§8), the boot-recovery gap (§20), and the health-truth model
(§19) before touching UX. Security: high (closes real gaps). Operational
risk: low (mostly hardening, minimal new surface). User value: indirect but
foundational. Complexity: medium. Dependency readiness: high (no blocked
dependencies). Rollback: easy (mostly additive/restrictive changes).
Phase 5/6 compatibility: full — extends the existing governance model rather
than replacing it.

**Option B — Unified Jarvis UX-first.** Build a single Command Center chat
page and canonical gateway before fixing the ungoverned paths. Security:
**low** — would add a new, more prominent surface on top of an already-forked
reasoning layer without first closing §8's gaps. Operational risk: high.
User value: high, but built on an unstable foundation. Complexity: high.
Dependency readiness: low (Google OAuth still disconnected, so a "unified"
experience couldn't demo real external actions anyway). Rollback: harder (UI
changes are more visible/sticky). Phase 5/6 compatibility: at risk if the new
gateway doesn't route everything through governance from day one.

**Option C — Voice/proactive-first.** Expand voice UX and fix the
proactive-notification silent-failure before anything else. Security: medium
(voice's existing boundary is good, low new risk). Operational risk: medium
(still depends on WhatsApp gateway, which needs the §8/§14 fix first anyway).
User value: high once WhatsApp is safely restartable, but blocked on that.
Complexity: medium. Dependency readiness: **low** — blocked on the WhatsApp
gateway re-platforming that Option A would do anyway. Phase 5/6 compatibility:
full if built on top of Option A's fixes.

**Recommendation: Option A.** Options B and C both have hard dependencies on
work Option A does first (a safe WhatsApp restart, a trustworthy health
model, closed exec paths). Sequencing A first doesn't delay B/C — it's a
prerequisite either way.

## 29. Recommended Phase 7 Sequence

```
7A — Runtime Reliability & Authority-Gap Closure   (this discovery's output)
7B — Health / Dependency Truth Model
7C — Canonical Jarvis Gateway (consolidate the 5 reasoning engines → 1)
7D — Unified Context & Operator Experience (Command Center Jarvis page)
7E — Proactive Suggestions / Operating Loop (fix silent-failure, extend safely)
7F — Voice Experience, read/propose only (extend the existing good boundary)
7G — Phase 7 Production Hardening / Closure
```

This matches the directive's hypothesis structure with one adjustment: 7A's
scope is evidence-driven toward *closing the three found authority gaps*
first, ahead of (not instead of) the originally-hypothesized boot-recovery
scope — both are reliability work and belong in the same subphase.

## 30. Phase 7A Proposed Scope (not implemented here)

1. **Authenticate `node-agent.mjs`'s `/exec`** (or retire it) — require the
   same `x-node-secret`-style check mi-core already sends, and narrow the
   denylist to an allowlist if it survives at all.
2. **Re-platform `jarvis/autonomous-task-runner.ts`** onto
   `ControlledActionService` or retire it if no live caller needs it.
3. **Re-platform `whatsapp-ai-gateway`'s send path** onto the Controlled
   Action pipeline before that service is ever restarted.
4. Deterministic Windows boot recovery (§20 comparison, decision deferred to
   7A's own directive).
5. PM2 fleet definition validation, duplicate-process prevention, port
   ownership checks, canonical DB discovery, config-presence checks — a
   `recovery-cli`/runbook (§20 option D).
6. Degraded-service classification feeding into the §19 health model (7A can
   lay groundwork; full model is 7B).

## 31. Explicit Non-Goals (Phase 7, all subphases)

| Item | Status |
|---|---|
| Gmail SEND | OUT OF SCOPE |
| Financial actions | OUT OF SCOPE |
| Autonomous approval | OUT OF SCOPE |
| Autonomous merge/deploy | OUT OF SCOPE |
| Unrestricted browser write | OUT OF SCOPE |
| Unrestricted shell/process execution | OUT OF SCOPE (§8's fixes *narrow or remove* existing exec paths — they do not add new ones) |
| Voice-triggered external writes | OUT OF SCOPE |
| Broad OAuth expansion | OUT OF SCOPE |
| Desktop control | OUT OF SCOPE |

All remain out of scope unless a future explicit directive changes them.

## 32. Schema Recommendation

**Schema v11 is NOT required for Phase 7A.** 7A's proposed scope (§30) is
authentication/authorization hardening, process-supervision tooling, and a
health model — none require new persisted state beyond what `personal-os.db`
already has (kill switches, budgets, evidence already exist as tables). If a
later subphase (likely 7C, consolidating reasoning engines) needs a canonical
conversation-turn table, that would be evaluated and justified explicitly at
that time, not assumed now.

## 33. Operational Gaps (carried forward + newly found)

Carried forward, unchanged, not fixed opportunistically:
- Ollama down/unavailable.
- Windows PM2 auto-start gap.
- `mi-node-agent` `BLOCKED_RUNTIME` (registration auth gap) — **now understood
  to be one symptom of a larger issue: the same process's `/exec` listener has
  no auth either**.
- `mi-ceo-observer`, `mi-whatsapp-gateway`, `mi-n8n` intentionally stopped.

Newly found this cycle (not fixed, per discovery-only mandate):
- `node-agent.mjs` unauthenticated `/exec` (§8).
- `jarvis/autonomous-task-runner.ts` ungoverned direct exec (§8).
- `whatsapp-ai-gateway` send path ungoverned by Controlled Actions (§8).
- Two hardcoded stale-path memory files (§9).
- Proactive/briefing WhatsApp delivery silently failing, invisible to
  operators (§12, §24).
- `ai-service` (Python) functionally orphaned (§18).
- Canonical Phase 6E retrieval unused by the live chat/Jarvis path (§10).

## 34. Stop Conditions — evaluated

None of Section 45's literal stop conditions (production outage, DB
corruption, unknown/unresolved authority mutation, Gmail SEND reachable
through canonical authority, financial execution reachable, provenance
mismatch, secret exposure, ambiguous production DB root, runtime root
ambiguity) were triggered. However, per the directive's own closing
instruction ("Report the finding before proceeding"), this discovery does
report as a significant finding — **not a hard stop, since discovery-only
fact-finding is exactly what was asked for and no exploitation occurred** —
that the "everything mutating flows through governed
`ControlledActionService`" assumption is **not universally true** (§1, §8). No
production mutation was performed during discovery.

---

## Decision Record

```
PHASE 7 RECOMMENDED DIRECTION:
Option A — Reliability-first. Close the three found ungoverned-mutation
paths and the boot-recovery gap before any UX consolidation work.

PHASE 7A RECOMMENDED FIRST SCOPE:
Authenticate/narrow node-agent.mjs's /exec; re-platform or retire
jarvis/autonomous-task-runner.ts's direct exec; re-platform
whatsapp-ai-gateway's send path onto Controlled Actions before any restart;
deterministic Windows boot recovery; PM2 fleet/config validation tooling;
groundwork for the health-truth model.

NEW EXTERNAL AUTHORITY REQUIRED FOR 7A:
NO

SCHEMA MIGRATION REQUIRED FOR 7A:
NO

PRODUCTION MUTATION PERFORMED DURING DISCOVERY:
NO
```
