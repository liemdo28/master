# Phase 4 — Local Engine Audit

Audited on the canonical host, 2026-08-03.

| Engine | Installed | Version | Callable | Local models | Non-interactive | Worktree cwd | Cancellable | Structured output | Windows | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| OpenHands | **No** | — | — | — | — | — | — | — | needs Docker | WRAP_LATER |
| Aider | **No** | — | — | — | — | — | — | — | — | WRAP_LATER |
| Qwen Code | **No** | — | — | — | — | — | — | — | — | INACTIVE |
| OpenCode | **No** | — | — | — | — | — | — | — | — | INACTIVE |
| internal-patch-engine | Yes | Phase 3 | in-process | n/a | yes | yes | yes | yes | yes | ACTIVE (deterministic fallback) |
| **local-llm-engine** | Yes (Phase 4) | 4.0.0 | in-process | Ollama 0.32.0 | yes | yes | yes | yes (JSON schema) | yes | **ACTIVE** |

`command -v` found none of openhands / aider / qwen / opencode on PATH. No
candidate CLI engine was installed, so none could be wrapped. Rather than
install one, Phase 4 implements the adapter in-process against the Phase 3
`CodingEngineAdapter` contract, which satisfies every preferred selection
criterion without granting an external process unrestricted host access:

1. constrained to Mi's worktree — enforced in `llm/tools.ts` and `llm/patch.ts`
2. uses a local OpenAI-compatible/Ollama endpoint — loopback enforced pre-socket
3. runs non-interactively — no TTY, no prompts
4. emits machine-readable progress — task events + `/tasks/:id/progress`
5. requires no Docker or host access — in-process, no shell
6. cancellable and timed out — AbortSignal + explicit timeouts throughout
7. integrates with the Phase 3 adapter contract — implements it directly

## Hardware

| | |
|---|---|
| CPU | Intel i5-13400F, 10 cores / 16 threads |
| RAM | 31.9 GB |
| GPU | AMD Radeon RX 7600, 8 GB VRAM, ROCm working |
| Disk | C: 427 GB free, D: 66.7 GB free |
| Ollama | 0.32.0, models on D:\SystemData\ollama\models |

8 GB of VRAM fits exactly one 7-8B Q4 model. 14B/16B Q4 models spill to CPU.
This is why model inference is serialised to a single slot.

## Correction to the stated baseline

The directive stated all roles used `qwen2.5-coder:7b`. That model was **not
installed**; `model-registry.ts` declared it and `ollama-router.ts` listed it
first for the coding role, but `selectModel()` fell through its priority list to
the "first available non-embedding model" — `qwen3:8b`. The configuration and
the runtime disagreed. Roles are now resolved from measured results.
