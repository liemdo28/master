| model | tasks passed | plan valid | patch valid | halluc. paths | validation pass | repair success | ctx fail | tok/s | mean s | peak VRAM |
|---|---|---|---|---|---|---|---|---|---|---|
| qwen3:8b | 0/3 | 100% | 0% | 0% | 0% | 0% | 100% | 13.7 | 277 | 7.15 GB |

| model | fixture | category | result | failure | repairs | s |
|---|---|---|---|---|---|---|
| qwen3:8b | task-d-refactor | refactor | FAIL | CONTEXT_INSUFFICIENT | 0 | 284 |
| qwen3:8b | task-d-refactor | refactor | FAIL | CONTEXT_INSUFFICIENT | 0 | 275 |
| qwen3:8b | task-d-refactor | refactor | FAIL | CONTEXT_INSUFFICIENT | 0 | 272 |
