# PHASE_1C_PROVIDER_EXECUTOR_ADAPTER_BACKLOG

> Created: 2026-06-26 12:08 Asia/Saigon
> Classification: BACKLOG — Do Not Build Yet
> Repository: `d:\Project\Master\mi-core`

---

## Purpose

Document the future implementation backlog for Provider Executor Adapters — enabling each supported coding provider to automatically generate patches, branches, commits, and PRs without human intervention.

This document exists so that the full autonomous coding pipeline is defined and ready for implementation when the Engineering Division is promoted from `PARTIAL` to `FULL AUTONOMY`.

---

## Current State (Phase 1B)

```text
Engineering Division Governance = OPERATIONAL
Engineering Live Execution Proof = PASS
Engineering Full Autonomy         = PARTIAL
```

The provider execution path is still `human-required` because `provider-layer.ts` only registers the `human` executor.

### Existing Scaffolding

| Component | File | Status |
| --- | --- | --- |
| `ProviderExecutor` type | `server/src/engineering-division/provider-layer.ts` | ✅ Complete |
| `registerProvider()` | `server/src/engineering-division/provider-layer.ts` | ✅ Complete |
| `dispatchToProvider()` | `server/src/engineering-division/provider-layer.ts` | ✅ Complete |
| `CodingProvider` type | `server/src/engineering-division/types.ts` | ✅ `'qwen' \| 'deepseek' \| 'claude' \| 'gpt' \| 'kimi' \| 'human'` |
| `human` executor (stub) | `server/src/engineering-division/provider-layer.ts` | ✅ Returns `human-required` |
| `qwen` executor | — | ❌ NOT IMPLEMENTED |
| `deepseek` executor | — | ❌ NOT IMPLEMENTED |
| `kimi` executor | — | ❌ NOT IMPLEMENTED |
| `claude` executor | — | ❌ NOT IMPLEMENTED |
| `gpt` executor | — | ❌ NOT IMPLEMENTED |

### Why This Is Deferred

Engineering is "good enough to support company work" as-is. The human-required fallback works, and the Git workflow (branch → commit → push → PR → approval) was fully proven in Phase 1B. Provider executors add automation but are not blocking other divisions.

---

## Target Providers

| Provider | CodingProvider Key | Expected Capability |
| --- | --- | --- |
| Qwen Coder | `qwen` | TypeScript/NodeJS documentation, code fixes, refactoring |
| DeepSeek | `deepseek` | Multi-language code generation, complex reasoning |
| Kimi | `kimi` | Large-repo analysis, research, documentation |
| Claude (Anthropic) | `claude` | General-purpose coding, code review, architecture |
| GPT (OpenAI) | `gpt` | General-purpose coding, completion, test generation |
| Human Dev | `human` | Fallback — already implemented |

---

## Future Pipeline Flow

```text
Task
  ↓
Executive Coordination
  ↓
Engineering Division Classifier
  ↓
Model Router (score → select provider/model)
  ↓
Provider Executor (generate patch)
  ↓
Review Engine (lint, AST, heuristic safety)
  ↓
Test Orchestrator (run available test suites)
  ↓
Branch (create feature branch)
  ↓
Commit (commit patch with metadata)
  ↓
PR (open pull request)
  ↓
Approval (human or automated gate)
```

---

## Backlog Items

### 1. Provider Executor Adapters (per provider)

Each adapter must implement `ProviderExecutor`:

```typescript
type ProviderExecutor = (task: EngineeringTask) => ProviderResult;
```

And must return a complete `ProviderResult`:

```typescript
interface ProviderResult {
  provider: CodingProvider;
  status: 'success' | 'partial' | 'failed' | 'human-required';
  summary: string;
  filesChanged: string[];
  patch?: string;
  branch?: string;
  commitHash?: string;
  prUrl?: string;
  capturedAt: string;
}
```

#### 1a. Qwen Coder Executor

- [ ] Create `server/src/engineering-division/executors/qwen-executor.ts`
- [ ] Implement API call to Qwen Coder endpoint
- [ ] Map `EngineeringTask` → Qwen Coder prompt
- [ ] Parse response → patch diff
- [ ] Return `ProviderResult`
- [ ] Register via `registerProvider('qwen', qwenExecutor)`
- [ ] Add unit test in `tests/`

#### 1b. DeepSeek Executor

- [ ] Create `server/src/engineering-division/executors/deepseek-executor.ts`
- [ ] Implement API call to DeepSeek endpoint
- [ ] Map `EngineeringTask` → DeepSeek prompt
- [ ] Parse response → patch diff
- [ ] Return `ProviderResult`
- [ ] Register via `registerProvider('deepseek', deepseekExecutor)`
- [ ] Add unit test in `tests/`

#### 1c. Kimi Executor

- [ ] Create `server/src/engineering-division/executors/kimi-executor.ts`
- [ ] Implement API call to Kimi endpoint
- [ ] Map `EngineeringTask` → Kimi prompt
- [ ] Parse response → patch diff
- [ ] Return `ProviderResult`
- [ ] Register via `registerProvider('kimi', kimiExecutor)`
- [ ] Add unit test in `tests/`

#### 1d. Claude (Anthropic) Executor

- [ ] Create `server/src/engineering-division/executors/claude-executor.ts`
- [ ] Implement API call to Anthropic Messages API
- [ ] Map `EngineeringTask` → Claude prompt
- [ ] Parse response → patch diff
- [ ] Return `ProviderResult`
- [ ] Register via `registerProvider('claude', claudeExecutor)`
- [ ] Add unit test in `tests/`

#### 1e. GPT (OpenAI) Executor

- [ ] Create `server/src/engineering-division/executors/gpt-executor.ts`
- [ ] Implement API call to OpenAI Chat Completions API
- [ ] Map `EngineeringTask` → GPT prompt
- [ ] Parse response → patch diff
- [ ] Return `ProviderResult`
- [ ] Register via `registerProvider('gpt', gptExecutor)`
- [ ] Add unit test in `tests/`

### 2. Review Engine

- [ ] Create `server/src/engineering-division/review-engine.ts`
- [ ] Implement lint check on generated patch
- [ ] Implement AST-level safety check (no dangerous mutations)
- [ ] Implement heuristic safety gate (no `rm -rf`, no secrets, no env vars)
- [ ] Return `ReviewResult { passed: boolean; reasons: string[] }`

### 3. Test Orchestrator Integration

- [ ] Create `server/src/engineering-division/test-orchestrator.ts`
- [ ] Auto-detect test command from `package.json`
- [ ] Run tests against patched code
- [ ] Return `TestResult { passed: number; failed: number; output: string }`
- [ ] Block PR if tests fail

### 4. Git Automation Layer

- [ ] Create `server/src/engineering-division/git-automation.ts`
- [ ] Implement `createBranch(name)` → branch from main
- [ ] Implement `commitPatch(files, message)` → stage + commit
- [ ] Implement `pushBranch(branch)` → push to origin
- [ ] Implement `createPR(branch, title, body)` → open PR
- [ ] Integrate with existing `git` CLI or `simple-git` library

### 5. Unified Provider Executor Orchestrator

- [ ] Create `server/src/engineering-division/executor-orchestrator.ts`
- [ ] Wire: task → router → executor → review → test → git → PR
- [ ] Add retry/fallback logic (if provider fails → try next)
- [ ] Add evidence capture at each step
- [ ] Add execution timing metrics

### 6. Environment & Configuration

- [ ] Document required API keys per provider in `.env.example`
- [ ] Add provider health-check endpoint
- [ ] Add provider cost/quota tracking
- [ ] Rate limit configuration per provider

---

## Implementation Priority (Future)

| Priority | Item | Rationale |
| --- | --- | --- |
| P0 | Review Engine | Safety gate — must exist before any provider goes live |
| P0 | Git Automation Layer | Already proven in Phase 1B — just needs code extraction |
| P1 | Claude Executor | Best general-purpose model; highest adoption expected |
| P1 | GPT Executor | Strong general-purpose alternative |
| P2 | Qwen Coder Executor | Default for TypeScript/docs (already routed) |
| P2 | Kimi Executor | Default for large-repo analysis |
| P3 | DeepSeek Executor | Specialized use cases |
| P3 | Test Orchestrator Integration | Depends on project having tests |
| P4 | Unified Orchestrator | Compose all pieces |
| P4 | Environment & Configuration | Production hardening |

---

## Acceptance Criteria (When Implemented)

- [ ] Each provider executor can generate a patch for a low-risk docs task
- [ ] Generated patch passes review engine safety check
- [ ] Generated patch passes existing test suite
- [ ] Branch is created automatically
- [ ] Commit includes provider metadata
- [ ] PR is created with provider attribution
- [ ] Full pipeline runs end-to-end without human intervention
- [ ] Human fallback works if all providers fail
- [ ] Provider execution status changes from `PARTIAL` to `FULL`

---

## Dependency on Other Phases

This backlog depends on:

1. **Executive Coordination** — ✅ Operational (Phase 1B)
2. **Engineering Division Classification** — ✅ Operational (Phase 1B)
3. **Model Router** — ✅ Operational (Phase 1B)
4. **Marketing Intelligence Foundation** — 🔜 In Progress (Phase 4)
5. **Financial Intelligence Foundation** — ✅ Complete (Phase 3)

No dependency blocks this backlog. It can be started at any time after Phase 4 is sufficient to support the company.

---

## Decision Record

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-06-26 | Defer to backlog | Engineering good enough; Marketing Foundation takes priority |
| 2026-06-26 | Do not create live executors | Risk management; human-required fallback is safe and proven |
| 2026-06-26 | Document full target flow | Ensure future implementation is well-specified |

---

## Final Status

```text
PHASE_1C_BACKLOG_CREATED
```

This document is a **backlog only**. No code was implemented, no providers were registered, no autonomous code generation was attempted.

---

*Next: Phase 4 — Marketing Intelligence Foundation continuation.*
