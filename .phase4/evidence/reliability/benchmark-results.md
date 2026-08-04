| model | tasks passed | plan valid | patch valid | halluc. paths | validation pass | repair success | ctx fail | tok/s | mean s | peak VRAM |
|---|---|---|---|---|---|---|---|---|---|---|
| qwen3:8b | 1/20 | 100% | 100% | 0% | 5% | 0% | 0% | 14.4 | 206 | 7.15 GB |

| model | fixture | category | result | failure | repairs | s |
|---|---|---|---|---|---|---|
| qwen3:8b | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 1 | 80 |
| qwen3:8b | task-d-refactor | refactor | PASS | - | 0 | 182 |
| qwen3:8b | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 1 | 72 |
| qwen3:8b | task-d-refactor | refactor | FAIL | - | 3 | 348 |
| qwen3:8b | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 1 | 63 |
| qwen3:8b | task-d-refactor | refactor | FAIL | - | 3 | 462 |
| qwen3:8b | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 1 | 69 |
| qwen3:8b | task-d-refactor | refactor | FAIL | - | 3 | 364 |
| qwen3:8b | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 1 | 69 |
| qwen3:8b | task-d-refactor | refactor | FAIL | - | 3 | 329 |
| qwen3:8b | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 1 | 69 |
| qwen3:8b | task-d-refactor | refactor | FAIL | - | 3 | 354 |
| qwen3:8b | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 1 | 70 |
| qwen3:8b | task-d-refactor | refactor | FAIL | - | 3 | 330 |
| qwen3:8b | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 1 | 69 |
| qwen3:8b | task-d-refactor | refactor | FAIL | INVALID_PATCH | 2 | 357 |
| qwen3:8b | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 1 | 60 |
| qwen3:8b | task-d-refactor | refactor | FAIL | - | 3 | 401 |
| qwen3:8b | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 1 | 60 |
| qwen3:8b | task-d-refactor | refactor | FAIL | INVALID_PATCH | 2 | 318 |
