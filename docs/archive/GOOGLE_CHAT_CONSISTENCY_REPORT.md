# Google Chat Consistency Report

Target: GOOGLE_CHAT_CONSISTENCY_READY

Canonical sections:

- Gmail: `GET /api/executive/snapshot -> gmail`
- Calendar: `GET /api/executive/snapshot -> calendar`
- Drive: `GET /api/executive/snapshot -> drive`

Fields:

- Gmail: unread count, important count, important email list, timestamp
- Calendar: today event count, today events, upcoming count, timestamp
- Drive: recent files, total found, files needing action, timestamp

Smoke result:

- Gmail cache is missing in the local test snapshot, so chat reports missing.
- Calendar cache is missing in the local test snapshot, so chat reports missing.
- Drive cache is represented through the snapshot with freshness metadata.

Rule:

WhatsApp must not invent Google counts. If cache is missing/stale, say missing/stale and point to the snapshot source.
