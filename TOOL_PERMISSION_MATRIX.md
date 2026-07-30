# TOOL_PERMISSION_MATRIX.md
> Phase 2 — Tool Permission Matrix
> Date: 2026-06-18

## Permission Matrix (31 tools)

| Tool ID | Dept | Method | Credential | Approval Req | Evidence Out | Failure Policy |
|---------|------|--------|-----------|:---:|:---:|----------------|
| task-snapshot | executive-assistant | HTTP_API | CONFIGURED | ○ | ● | SKIP |
| task-today | executive-assistant | HTTP_API | CONFIGURED | ○ | ● | SKIP |
| task-approvals | executive-assistant | HTTP_API | CONFIGURED | ○ | ● | SKIP |
| health-intel | executive-assistant | HTTP_API | CONFIGURED | ○ | ○ | SKIP |
| gmail | executive-assistant | EXTERNAL_API | CONFIGURED | ○ | ● | ALERT_CEO |
| calendar | executive-assistant | EXTERNAL_API | CONFIGURED | ○ | ● | SKIP |
| quickbooks | finance | EXTERNAL_API | CONFIGURED | ● | ● | ABORT |
| toast-pos | finance | EXTERNAL_API | CONFIGURED | ○ | ● | FALLBACK |
| accounting-engine | finance | HTTP_API | CONFIGURED | ○ | ● | ALERT_CEO |
| pdf-evidence | finance | REQUIRE_MODULE | CONFIGURED | ● | ● | ABORT |
| visibility-dashboard | technical-operations | HTTP_API | CONFIGURED | ○ | ● | SKIP |
| food-safety | restaurant-intelligence | HTTP_API | CONFIGURED | ○ | ● | SKIP |
| doordash | restaurant-intelligence | EXTERNAL_API | CONFIGURED | ○ | ● | FALLBACK |
| review-system | marketing | HTTP_API | CONFIGURED | ○ | ● | SKIP |
| git | engineering | CLI | CONFIGURED | ○ | ● | SKIP |
| build | engineering | CLI | CONFIGURED | ● | ● | ABORT |
| logs | engineering | CLI | CONFIGURED | ○ | ● | SKIP |
| pm2-status | infrastructure | HTTP_API | CONFIGURED | ○ | ● | SKIP |
| node-registry | infrastructure | HTTP_API | CONFIGURED | ○ | ○ | SKIP |
| health-checks | infrastructure | HTTP_API | CONFIGURED | ○ | ● | ALERT_CEO |
| docker | infrastructure | CLI | CONFIGURED | ○ | ● | SKIP |
| briefing-latest | report-center | HTTP_API | CONFIGURED | ○ | ○ | SKIP |
| strategic-memory | report-center | HTTP_API | CONFIGURED | ○ | ○ | SKIP |
| agenview-snapshot | report-center | HTTP_API | CONFIGURED | ○ | ○ | SKIP |
| pipeline-history | qa | HTTP_API | CONFIGURED | ○ | ○ | SKIP |
| evidence-reader | qa | SQLITE_DIRECT | CONFIGURED | ○ | ○ | ABORT |
| dept-definitions | dispatch | REQUIRE_MODULE | CONFIGURED | ○ | ○ | SKIP |
| source-inventory-reader | library | REQUIRE_MODULE | CONFIGURED | ○ | ○ | SKIP |
| rag-search | library | HTTP_API | CONFIGURED | ○ | ○ | SKIP |
| document-search | library | HTTP_API | CONFIGURED | ○ | ○ | SKIP |
| comfyui | brand-creative | HTTP_API | MISSING | ● | ● | ALERT_CEO |
| flux | brand-creative | HTTP_API | MISSING | ● | ● | ALERT_CEO |
| restaurant-creative-engine | brand-creative | HTTP_API | MISSING | ● | ● | SKIP |

**Legend:** ● = Yes / Required, ○ = No / Not Required

---

## Safety Rules

1. **ABORT tools** (quickbooks, pdf-evidence, build, evidence-reader) — pipeline stops if these fail. No partial results.
2. **ALERT_CEO tools** (gmail, accounting-engine, health-checks, comfyui, flux) — CEO notified immediately if unavailable.
3. **FALLBACK tools** (toast-pos, doordash) — fallback source tried; report degraded data if both fail.
4. **SKIP tools** — silent skip; pipeline continues without their data.
5. **APPROVAL_REQUIRED tools** — pipeline cannot call these without CEO approval flag in work order.
6. **MISSING credentials** — tool returns status message, never blocks. Phase 10 will install.

---

## Approval Flow

```
CEO Command → Intent Router → Dispatch
  ↓
Work Order created
  ↓ [if tool.approval_required]
Approval Engine: REQUIRES_APPROVAL → pause → CEO confirmation
  ↓ [after approval or no approval needed]
Tool executes → result in context for Brain
```

## Status: TOOL_PERMISSION_MATRIX_COMPLETE ✅
