# mi-connector-ops

Use for Visibility, Action Layer, Project Connectors, WhatsApp gateway, Google, Asana, website, and remote integrations.

1. Confirm connector identity, data source, auth mode, cache path, and freshness signal.
2. Validate read-only operations separately from write operations.
3. Ensure write operations go through Approval Gate and have rollback or compensating action notes.
4. Verify connector health output includes status, last sync, errors, and degraded mode.
5. Keep connector-specific failures isolated so one failing connector does not break the daily snapshot.

