| model | tasks passed | plan valid | patch valid | halluc. paths | validation pass | repair success | ctx fail | tok/s | mean s | peak VRAM |
|---|---|---|---|---|---|---|---|---|---|---|
| qwen3:8b | 3/6 | 100% | 67% | 0% | 50% | 67% | 33% | 13.9 | 141 | 7.15 GB |

| model | fixture | category | result | failure | repairs | s |
|---|---|---|---|---|---|---|
| qwen3:8b | task-c-type-repair | type-repair | PASS | - | 1 | 78 |
| qwen3:8b | task-d-refactor | refactor | FAIL | CONTEXT_INSUFFICIENT | 0 | 282 |
| qwen3:8b | task-c-type-repair | type-repair | PASS | - | 0 | 50 |
| qwen3:8b | task-d-refactor | refactor | FAIL | INVALID_PATCH | 1 | 95 |
| qwen3:8b | task-c-type-repair | type-repair | PASS | - | 1 | 58 |
| qwen3:8b | task-d-refactor | refactor | FAIL | CONTEXT_INSUFFICIENT | 0 | 283 |
