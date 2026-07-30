# ENGINEERING_OPERATOR_CERTIFICATION.md
> Phase 9 — Engineering & Project Operator
> Date: 2026-06-18
> Target: ENGINEERING_OPERATOR_READY

---

## Engineering Department Capabilities

| Capability | Implementation | Status |
|-----------|---------------|--------|
| mi-core audit | executeEngineeringRequest() → action_type: audit | ✅ |
| Dashboard 404 investigation | action_type: debug + file read | ✅ |
| Bug fixes | action_type: debug → qwen2.5-coder:7b | ✅ |
| Feature build | action_type: build → REQUIRES_APPROVAL | ✅ |
| File read into context | readTargetFile() up to 3000 chars | ✅ |
| Recent pipeline evidence | recentPipelineRuns() for context | ✅ |
| Screenshots | Playwright tool (Phase 10 dependency) | 🔲 |

---

## Safety: Code Changes Require Approval

- Safety policy: `REQUIRES_APPROVAL`
- Brain: `qwen2.5-coder:7b` (specialized coding model)
- Fallback: `qwen3:14b` if coder model unavailable
- Every engineering action creates evidence in evidence-store
- QA gate runs independently after each engineering run

---

## mi-core Audit Workflow

```
CEO: "audit mi-core"
  ↓ intent: audit_project
  ↓ executeEngineeringRequest({ action_type: 'audit' })
  ↓ reads: recent pipeline runs, git status, PM2 status
  ↓ qwen2.5-coder:7b analyzes and summarizes
  ↓ CEO gets: what's working, what's broken, what needs attention
```

---

## Dashboard 404 Investigation

```
CEO: "dashboard 404 tại sao"
  ↓ intent: fix_bug
  ↓ executeEngineeringRequest({ action_type: 'debug', target_file: 'routes/...' })
  ↓ reads target route file + recent PM2 logs
  ↓ qwen2.5-coder:7b identifies likely cause
  ↓ CEO gets: probable cause + fix recommendation
```

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Coder brain assigned | ✅ qwen2.5-coder:7b |
| Approval required for execution | ✅ |
| Evidence per engineering run | ✅ |
| Audit mode | ✅ |
| Debug mode | ✅ |
| File context reading | ✅ |

## Status: ENGINEERING_OPERATOR_READY ✅
