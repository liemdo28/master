# Connector Health Truth Report

Target: CONNECTOR_HEALTH_TRUTH_READY

Implemented connector truth state under:

`GET /api/executive/snapshot -> connectors.data.truth`

Each connector truth row includes:

- `connector_id`
- `name`
- `owner`
- `auth`
- `health`
- `api_available`
- `data_freshness`
- `stale`
- `last_successful_sync`
- `error_count`
- `action_required`
- `setup_hint`
- `evidence_links`

Ownership mapping:

- QuickBooks runtime: Dev1
- WhatsApp-specific connectors: Dev3
- Mi-Core visibility/connectors/API truth: Dev2

Rule:

Connector truth is not just HTTP 200. It combines registry auth/health with freshness and evidence paths.

Smoke result:

- 13 connectors found.
- 9 connectors require action in the local test snapshot.
