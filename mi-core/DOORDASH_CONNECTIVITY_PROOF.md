# DoorDash Connectivity Proof

Generated: 2026-06-27T03:11:40Z

Status: BLOCKED

Configured agent URL was checked, but the health endpoint was not reachable from this host during audit.

Required to pass:
- DoorDash agent listener reachable.
- `/health` returns ok.
- `/metrics` returns cached or live campaign/store data.
