# BASELINE_DIRTY_REPOS.md
> Mi Company OS — Dirty Repository State at Baseline Freeze
> Date: 2026-06-18

---

## Summary

The repository is DIRTY at baseline. This is expected and documented below. The working tree contains runtime data, session artifacts, and in-progress development that has not been committed.

---

## Repository Structure

**Single monorepo:** All projects under `E:\Project\Master` are in ONE git repository.  
**Branch:** `feature/mi-core-big-data-foundation`  
**HEAD:** `ae8ad26f`

---

## Dirty File Categories

### Category 1: Runtime Data (`.local-agent-global/`) — EXPECTED DIRTY

These files change every session as the system processes work orders, logs events, and syncs connectors. They are NOT part of the source code and should never be committed.

| File / Pattern | Reason Dirty |
|----------------|-------------|
| `knowledge-db/ingestion_log.json` | Knowledge ingestion activity |
| `knowledge-db/knowledge.db` | Knowledge base SQLite (live writes) |
| `knowledge-db/stats.json` | Knowledge stats updated |
| `mi-core/master-projects.json` | Project registry updated |
| `mi-core/whatsapp-client.json` | WhatsApp session state |
| `remote-access/audit_log.json` | Remote access audit |
| `remote-access/sessions.json` | Active sessions |
| `remote-access/trusted_devices.json` | Device trust |
| `visibility/connector-registry.json` | Connector health updates |
| `visibility/daily-snapshot.json` | Daily snapshot |
| `visibility/dashboard/errors.json` | Error log |
| `visibility/food-safety/data.json` | Food safety sensor data |
| `visibility/food-safety/last_sync.json` | Last sync time |
| `visibility/projects/data.json` | Project data cache |
| `visibility/projects/last_sync.json` | Last sync time |
| `visibility/projects/summary.json` | Project summary |
| `visibility/sync_log.json` | Sync activity log |

**Note:** `.local-agent-global/knowledge-db/knowledge.db-shm` and `.db-wal` deleted (SQLite closed cleanly).

### Category 2: Agent Coding API Keys (`Agent/agent-coding-api-keys/`) — IN-PROGRESS DEV

| File | Reason Dirty |
|------|-------------|
| `.env.example` | Updated API key examples |
| `package.json` | Version or dependency update |
| `src/providers/base-provider.ts` | Provider base changes |
| `src/providers/openai-compatible-provider.ts` | OpenAI compat updates |
| `src/router/provider-router.ts` | Router logic update |
| `src/runtime/api-key-rotation-service.ts` | Key rotation logic |
| `src/runtime/model-quota-service.ts` | Quota tracking |
| `src/runtime/upstream-error-classifier.ts` | Error classification |
| `src/server.ts` | Server update |
| `src/types.ts` | Type definitions |
| `src/ui/dashboard.ts` | Dashboard UI |
| `tests/supply-source-policy.mjs` | Test update |

**Action:** These changes belong to the `agent-coding-api-keys` project. They should be committed to that project's feature branch, separate from mi-core baseline.

### Category 3: Mi-Core Source (`mi-core/`) — THIS SESSION'S FIXES

| File | Reason Dirty |
|------|-------------|
| `agent-engine/bridge.mjs` | Agent bridge update |
| `data/doordash-agent/packages/1.0.0/package.json` | DoorDash agent package |
| `data/qb-agent.db` | QB agent SQLite |
| `ecosystem.config.js` | PM2 config update |
| `local-agent/knowledge-federation/Compli*` | Knowledge federation |
| `server/src/company-os/qa-gate.ts` | **QA gate bug fix** (`started_at`→`created_at`) |
| `server/src/index.ts` | EADDRINUSE fix (MAX_BIND_ATTEMPTS) |
| (other server src files) | This session's development work |

**Action:** The mi-core source fixes (`qa-gate.ts`, `index.ts`) are the critical changes. These should be committed.

---

## Files That Should NOT Be in Git (but are — CRITICAL)

| File | Why Critical |
|------|-------------|
| `Other/gdrive-tools/credentials.json` | Real Google OAuth `client_secret` for `drive-cleaner-488606` |
| `Other/gdrive-tools/token.json` | Real Google OAuth `refresh_token` — grants Drive access |

**Action required:** CEO must revoke these credentials in Google Cloud Console, then authorize force-push after BFG Repo Cleaner history purge.

---

## Recommendation Before Committing

1. **Do commit:** `server/src/company-os/qa-gate.ts` + `server/src/index.ts` — these are bug fixes
2. **Do NOT commit:** `.local-agent-global/**` — runtime data only
3. **Do NOT commit:** `Agent/agent-coding-api-keys/**` — belongs to separate project branch
4. **Review before commit:** `ecosystem.config.js` — verify PM2 config changes are intentional
5. **Block commit until resolved:** `Other/gdrive-tools/` — must be purged from history, not just .gitignored

---

## Conclusion

The dirty state at baseline freeze is primarily runtime data (expected) + session dev work (not yet committed). The source code fixes from this session (`qa-gate.ts`, `index.ts`) are the only files that should move to the next commit. All other dirty state is either runtime artifacts or in-progress work from other projects.
