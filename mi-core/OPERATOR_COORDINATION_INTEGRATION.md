# OPERATOR COORDINATION INTEGRATION

## Integration Contract

The runtime receives and preserves:

1. `task_id`
2. `objective_id`

It also performs these coordination steps:

- verify task existence
- update status to `DISPATCHED`
- update status to `IN_PROGRESS`
- update status to terminal state (`DONE`, `FAILED`, or `BLOCKED_BY_POLICY`)
- register evidence

## Compatibility Adapter

A compatibility adapter is implemented in:

- `server/src/operator-runtime/coordination-client.ts`

Because a live Executive Coordination API was not available in this pass, the adapter uses a mock compatibility layer that:

- returns `exists: true`
- marks `source: mock`
- preserves status update history
- allows task execution and evidence registration to proceed safely

## Verified Output

Observed in test result:

```json
{
  "check": {
    "exists": true,
    "source": "mock",
    "available": false
  },
  "updates": ["DISPATCHED", "IN_PROGRESS", "FAILED"]
}
```

## Summary

Executive Coordination integration exists at the interface level and is safe to swap to a live API later.