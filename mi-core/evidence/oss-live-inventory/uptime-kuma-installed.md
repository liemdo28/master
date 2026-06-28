# Evidence: Uptime Kuma Installed

**Date:** 2026-06-28
**OSS:** Uptime Kuma
**Expected Status:** `LIVE_INSTALLED`

## Verification

Uptime Kuma runs as a Docker container on TCP 3001.

## Business Role

- Store-ops uptime monitoring
- Health check for Mi-Core, n8n, connectors
- Checklist compliance monitoring

## Replacement

In-engine store-health + checklist compliance is available as fallback.

## Source

Docker container deployment with REST API accessible.
