# Chat Freshness Guard Report

Target: CHAT_FRESHNESS_GUARD_READY

Implemented in `server/src/executive/executive-snapshot.ts`.

Freshness metadata per section:

- `source`
- `last_synced_at`
- `freshness`
- `stale`
- `confidence`
- `error`

Guard behavior:

- Fresh data can be answered directly.
- Stale data is prefixed as stale/cached.
- Missing data is reported as missing.
- Error data is reported as connector failure.
- Freshness monitor write/read failures degrade the snapshot instead of crashing the API.

Operational chat formatter:

- `formatExecutiveSnapshotAnswer()`
- Returns `reply`, `intent`, and `sources`.
- Used by `server/src/routes/chat.ts` before old visibility fallbacks.

Acceptance smoke:

- Missing Gmail returns: missing/unavailable language, not fake counts.
- Missing dashboard freshness returns: `khong chot xanh gia` language.
- QB with Dev1 action required returns `needs_dev1_action`.
