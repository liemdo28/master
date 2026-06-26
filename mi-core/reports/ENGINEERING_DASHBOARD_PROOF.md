# Engineering Dashboard Proof

Command:

```powershell
node tests\phase1-engineering-runtime-test.mjs
```

Dashboard evidence from runtime proof:

```json
{
  "activeTasks": 1,
  "assignedModels": {
    "qwen": 0,
    "deepseek": 0,
    "claude": 2,
    "gpt": 0,
    "kimi": 0,
    "human": 0
  },
  "queueStatus": {
    "PENDING": 1,
    "FAILED": 1
  },
  "reviewScores": [
    {
      "task_id": "ET-002",
      "score": 50
    }
  ],
  "testStatus": [
    {
      "task_id": "ET-002",
      "passed": 0,
      "failed": 0,
      "executed": false
    }
  ],
  "prStatus": [
    {
      "task_id": "ET-002",
      "status": "BLOCKED_NO_REAL_PR",
      "pr": null
    }
  ]
}
```

Covered dashboard fields:

- active tasks
- assigned model
- queue status
- review scores
- test status
- PR status
- approvals
- failures
- cost
- success rate
