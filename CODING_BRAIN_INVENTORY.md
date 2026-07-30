# Coding Brain Inventory

Generated: 2026-06-19
Command: `ollama list`

## Installed Models

| Model | Size | Coding benchmark target |
|---|---:|---|
| `qwen3:8b` | 5.2 GB | Yes |
| `qwen3:14b` | 9.3 GB | Yes |
| `qwen2.5-coder:7b` | 4.7 GB | Yes; current Engineering primary |
| `gemma3:12b` | 8.1 GB | No |
| `nomic-embed-text:latest` | 274 MB | No |

## Candidate Status Before Install

`deepseek-coder:6.7b`: missing

## Candidate Status After Install

| Model | Size | Status |
|---|---:|---|
| `deepseek-coder:6.7b` | 3.8 GB | Installed and visible in `ollama list` |

## Registry Reality

The CEO directive describes the current coding brains as `qwen3:8b` and
`qwen3:14b`. The active Company OS source currently assigns:

- Engineering primary: `qwen2.5-coder:7b`
- Engineering fallback: `qwen3:14b`
- Fast/emergency model available elsewhere: `qwen3:8b`

Source:

- `server/src/company-os/brain-registry.ts`
- `server/src/company-os/departments.ts`

No registry change is made during inventory.

## Expanded Benchmark Scope

The final benchmark includes all three directive models plus the active primary:

- `qwen2.5-coder:7b`
- `qwen3:8b`
- `qwen3:14b`
- `deepseek-coder:6.7b`

Each model was tested for three runs across five identical tasks.
