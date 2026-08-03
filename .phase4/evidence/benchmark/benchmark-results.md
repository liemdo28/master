| model | tasks passed | plan valid | patch valid | halluc. paths | validation pass | repair success | ctx fail | tok/s | mean s | peak VRAM |
|---|---|---|---|---|---|---|---|---|---|---|
| qwen3:8b | 4/5 | 100% | 80% | 0% | 80% | 100% | 20% | 14.6 | 95 | 7.15 GB |
| qwen2.5-coder:7b | 2/5 | 100% | 80% | 0% | 40% | 33% | 0% | 32.6 | 47 | 6.42 GB |
| qwen2.5-coder:14b | 3/5 | 100% | 80% | 0% | 60% | 0% | 0% | 5.5 | 153 | 7.19 GB |
| deepseek-coder-v2:lite | 2/5 | 100% | 100% | 0% | 40% | 0% | 0% | 8.1 | 148 | 7.14 GB |

| model | fixture | category | result | failure | repairs | s |
|---|---|---|---|---|---|---|
| qwen3:8b | task-a-bug-fix | bug-fix | PASS | - | 0 | 40 |
| qwen3:8b | task-b-multi-file-feature | multi-file-feature | PASS | - | 0 | 79 |
| qwen3:8b | task-c-type-repair | type-repair | PASS | - | 3 | 72 |
| qwen3:8b | task-d-refactor | refactor | FAIL | CONTEXT_INSUFFICIENT | 0 | 209 |
| qwen3:8b | task-e-unfamiliar-repo | unfamiliar-repo | PASS | - | 0 | 77 |
| qwen2.5-coder:7b | task-a-bug-fix | bug-fix | PASS | - | 0 | 16 |
| qwen2.5-coder:7b | task-b-multi-file-feature | multi-file-feature | FAIL | INVALID_PATCH | 2 | 59 |
| qwen2.5-coder:7b | task-c-type-repair | type-repair | FAIL | - | 3 | 100 |
| qwen2.5-coder:7b | task-d-refactor | refactor | FAIL | INVALID_PATCH | 0 | 44 |
| qwen2.5-coder:7b | task-e-unfamiliar-repo | unfamiliar-repo | PASS | - | 1 | 17 |
| qwen2.5-coder:14b | task-a-bug-fix | bug-fix | PASS | - | 0 | 60 |
| qwen2.5-coder:14b | task-b-multi-file-feature | multi-file-feature | PASS | - | 0 | 101 |
| qwen2.5-coder:14b | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 1 | 110 |
| qwen2.5-coder:14b | task-d-refactor | refactor | FAIL | INVALID_PATCH | 0 | 414 |
| qwen2.5-coder:14b | task-e-unfamiliar-repo | unfamiliar-repo | PASS | - | 0 | 78 |
| deepseek-coder-v2:lite | task-a-bug-fix | bug-fix | PASS | - | 0 | 60 |
| deepseek-coder-v2:lite | task-b-multi-file-feature | multi-file-feature | FAIL | INVALID_PATCH | 1 | 198 |
| deepseek-coder-v2:lite | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 2 | 146 |
| deepseek-coder-v2:lite | task-d-refactor | refactor | FAIL | - | 3 | 218 |
| deepseek-coder-v2:lite | task-e-unfamiliar-repo | unfamiliar-repo | PASS | - | 0 | 118 |
