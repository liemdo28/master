| model | tasks passed | plan valid | patch valid | halluc. paths | validation pass | repair success | ctx fail | tok/s | mean s | peak VRAM |
|---|---|---|---|---|---|---|---|---|---|---|
| qwen2.5-coder:7b | 1/5 | 80% | 60% | 0% | 20% | 0% | 20% | 45.2 | 27 | 5.62 GB |
| qwen3:8b | 3/5 | 100% | 100% | 0% | 60% | 33% | 0% | 23.1 | 41 | 7.22 GB |
| qwen2.5-coder:14b | 1/5 | 100% | 100% | 0% | 20% | 0% | 0% | 6.9 | 98 | 7.30 GB |
| deepseek-coder-v2:lite | 1/5 | 100% | 80% | 0% | 20% | 0% | 0% | 10.5 | 133 | 7.23 GB |

| model | fixture | category | result | failure | repairs | s |
|---|---|---|---|---|---|---|
| qwen2.5-coder:7b | task-a-bug-fix | bug-fix | PASS | - | 0 | 7 |
| qwen2.5-coder:7b | task-b-multi-file-feature | multi-file-feature | FAIL | INVALID_PATCH | 2 | 27 |
| qwen2.5-coder:7b | task-c-type-repair | type-repair | FAIL | - | 3 | 88 |
| qwen2.5-coder:7b | task-d-refactor | refactor | FAIL | INVALID_PATCH | 0 | 10 |
| qwen2.5-coder:7b | task-e-unfamiliar-repo | unfamiliar-repo | FAIL | CONTEXT_INSUFFICIENT | 0 | 3 |
| qwen3:8b | task-a-bug-fix | bug-fix | PASS | - | 0 | 25 |
| qwen3:8b | task-b-multi-file-feature | multi-file-feature | FAIL | POLICY_DENIED | 1 | 66 |
| qwen3:8b | task-c-type-repair | type-repair | PASS | - | 1 | 26 |
| qwen3:8b | task-d-refactor | refactor | PASS | - | 0 | 36 |
| qwen3:8b | task-e-unfamiliar-repo | unfamiliar-repo | FAIL | INVALID_PATCH | 1 | 52 |
| qwen2.5-coder:14b | task-a-bug-fix | bug-fix | PASS | - | 0 | 47 |
| qwen2.5-coder:14b | task-b-multi-file-feature | multi-file-feature | FAIL | POLICY_DENIED | 1 | 134 |
| qwen2.5-coder:14b | task-c-type-repair | type-repair | FAIL | POLICY_DENIED | 1 | 61 |
| qwen2.5-coder:14b | task-d-refactor | refactor | FAIL | INVALID_PATCH | 1 | 151 |
| qwen2.5-coder:14b | task-e-unfamiliar-repo | unfamiliar-repo | FAIL | POLICY_DENIED | 1 | 95 |
| deepseek-coder-v2:lite | task-a-bug-fix | bug-fix | PASS | - | 0 | 49 |
| deepseek-coder-v2:lite | task-b-multi-file-feature | multi-file-feature | FAIL | POLICY_DENIED | 1 | 148 |
| deepseek-coder-v2:lite | task-c-type-repair | type-repair | FAIL | INVALID_PATCH | 0 | 55 |
| deepseek-coder-v2:lite | task-d-refactor | refactor | FAIL | - | 3 | 260 |
| deepseek-coder-v2:lite | task-e-unfamiliar-repo | unfamiliar-repo | FAIL | INVALID_PATCH | 3 | 152 |
