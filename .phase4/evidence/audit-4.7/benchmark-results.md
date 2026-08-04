| model | tasks passed | plan valid | patch valid | halluc. paths | validation pass | repair success | ctx fail | tok/s | mean s | peak VRAM |
|---|---|---|---|---|---|---|---|---|---|---|
| qwen3:8b | 4/5 | 100% | 100% | 0% | 80% | 50% | 0% | 13.9 | 66 | 7.15 GB |
| qwen2.5-coder:7b | 2/5 | 100% | 100% | 0% | 40% | 40% | 0% | 29.0 | 38 | 6.42 GB |
| qwen2.5-coder:14b | 4/5 | 100% | 100% | 0% | 80% | 67% | 0% | 5.1 | 124 | 7.19 GB |
| deepseek-coder-v2:lite | 2/5 | 100% | 100% | 0% | 40% | 25% | 0% | 7.2 | 177 | 7.14 GB |

| model | fixture | category | result | failure | repairs | s |
|---|---|---|---|---|---|---|
| qwen3:8b | task-a-bug-fix | bug-fix | PASS | - | 0 | 43 |
| qwen3:8b | task-b-multi-file-feature | multi-file-feature | PASS | - | 0 | 98 |
| qwen3:8b | task-c-type-repair | type-repair | PASS | - | 1 | 55 |
| qwen3:8b | task-d-refactor | refactor | FAIL | INVALID_PATCH | 1 | 89 |
| qwen3:8b | task-e-unfamiliar-repo | unfamiliar-repo | PASS | - | 0 | 43 |
| qwen2.5-coder:7b | task-a-bug-fix | bug-fix | PASS | - | 1 | 24 |
| qwen2.5-coder:7b | task-b-multi-file-feature | multi-file-feature | FAIL | INVALID_PATCH | 2 | 78 |
| qwen2.5-coder:7b | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 1 | 22 |
| qwen2.5-coder:7b | task-d-refactor | refactor | FAIL | INVALID_PATCH | 2 | 47 |
| qwen2.5-coder:7b | task-e-unfamiliar-repo | unfamiliar-repo | PASS | - | 1 | 19 |
| qwen2.5-coder:14b | task-a-bug-fix | bug-fix | PASS | - | 1 | 112 |
| qwen2.5-coder:14b | task-b-multi-file-feature | multi-file-feature | PASS | - | 0 | 136 |
| qwen2.5-coder:14b | task-c-type-repair | type-repair | PASS | - | 1 | 88 |
| qwen2.5-coder:14b | task-d-refactor | refactor | FAIL | INVALID_PATCH | 1 | 202 |
| qwen2.5-coder:14b | task-e-unfamiliar-repo | unfamiliar-repo | PASS | - | 0 | 84 |
| deepseek-coder-v2:lite | task-a-bug-fix | bug-fix | PASS | - | 0 | 65 |
| deepseek-coder-v2:lite | task-b-multi-file-feature | multi-file-feature | FAIL | INVALID_PATCH | 2 | 240 |
| deepseek-coder-v2:lite | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 3 | 209 |
| deepseek-coder-v2:lite | task-d-refactor | refactor | FAIL | - | 3 | 236 |
| deepseek-coder-v2:lite | task-e-unfamiliar-repo | unfamiliar-repo | PASS | - | 1 | 134 |
