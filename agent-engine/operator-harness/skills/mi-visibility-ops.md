# mi-visibility-ops

Use for Universal Visibility, connector registry, cache freshness, and dashboard health.

1. Verify connector id, auth state, last sync, errors, and freshness.
2. Keep one failing connector isolated from the full dashboard.
3. Check UI surfaces for stale cache, misleading ready state, and missing degraded-mode text.
4. Verify sync endpoints and cache writes separately.
5. Report connected, degraded, offline, and not configured counts.

