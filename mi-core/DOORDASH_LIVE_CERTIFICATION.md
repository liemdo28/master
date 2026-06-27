# DoorDash Live Certification

Generated: 2026-06-27T03:30:00Z

Certification result: `BLOCKED`

## Observed Evidence

- DoorDash service source exists at `services/doordash-agent`.
- Historical screenshot/session evidence exists under `services/doordash-agent/data/sessions`.
- Historical scrape output exists at `services/doordash-agent/data/latest-metrics.json`.
- Port `3460` was closed during this audit.
- `GET http://127.0.0.1:3460/health` failed to connect.

## Historical Data Limitation

The latest metrics file contains account labels and portal screenshots, but the scrape text showed DoorDash page-load errors and null campaign/order/revenue metrics. This is evidence of an attempted read-only operator session, not a current live certification.

## Gate Results

| Gate | Result |
| --- | --- |
| Real account detection | PARTIAL |
| Store account evidence | PARTIAL |
| Campaign visibility | FAIL |
| Menu visibility | NOT PROVEN |
| Health checks | FAIL |
| Runtime login/session screenshot | PARTIAL historical evidence only |
| Approval gate | PASS as architecture, not live operator proof |

## Certification Decision

DoorDash remains blocked until the read-only agent is reachable and fresh account, campaign, menu, screenshot, and audit-trail evidence can be collected.
