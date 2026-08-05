# Coding Engine Freeze Policy

Effective at Mi Personal OS v1.0.0, the coding engine is frozen for stability.

## Frozen Components

- Task runtime contracts.
- Project Registry contracts.
- Coding workflow.
- Retrieval.
- Symbol context.
- AST editing.
- Impact graph.
- Validation profiles.
- Local commit and review gates.

## Meaning Of Frozen

Frozen means:

- No speculative feature additions.
- No prompt tuning without measured regression evidence.
- No model replacement without benchmark evidence.
- No new task-specific rules.
- No broad architecture rewrites.

Allowed changes:

- Confirmed bugs.
- Security issues.
- Platform compatibility issues.
- Measured regressions.
- Approved support for a new language or framework.

## Required Evidence For Any Change

Every future coding-engine change must include:

- Reproduction.
- Failing test.
- Focused fix.
- Regression validation.
- Real-project verification where relevant.
- Confirmation that no push, merge, deploy, publishing, or external action capability was added.

## Model Policy

The current production roles are local-first:

- `coding_primary=qwen3:8b`
- `coding_fast=qwen2.5-coder:7b`
- `coding_review=qwen3:8b`

Changing these defaults requires benchmark evidence and acceptance results. Cloud fallback remains disabled unless a separate approved release explicitly enables it.

## Retrieval Policy

Do not add project-specific retrieval rules. Explicit project-relative paths may be included only when they exist, remain inside the project boundary, and are not excluded, generated, or secret paths. Ordinary ranking must remain stable.

## Validation Policy

Validation profiles must stay project-scoped and use approved command definitions. Missing commands must report `NOT_CONFIGURED`, not success. Generated artifacts may be allowed only by explicit artifact policy and must not hide unrelated source/config changes.
