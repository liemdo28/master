# MI_DAILY_WORK_PIPELINE_INTEGRATION
**Generated:** 2026-06-09 | **Phase:** Daily Work Automation Phase 4

## Pipeline Architecture

```
CEO Message
    │
    ▼
chat.ts: processMessage()
    │
    ├── [FAST PATH] isActionMessage regex?
    │   └── YES → runPipeline({ intent: 'action' }) → return
    │
    ├── parseIntent() → intent
    │
    ├── [intent: visibility_calendar]
    │   ├── Action pattern in message? → runPipeline() → return
    │   └── No → return calendar snapshot
    │
    ├── [intent: visibility_dashboard]
    │   ├── Action pattern in message? → runPipeline() → return
    │   └── No → return dashboard snapshot
    │
    ├── [intent: task/post/seo pattern] → runPipeline() → return
    │
    └── Default → runPipeline({ intent })
                        │
                        ▼
            response-pipeline.ts: runPipeline()
                        │
                        ├── Section 0: isDailyWorkAction(message)?
                        │   └── YES → handleDailyWorkAction() → return
                        │
                        ├── Section 1: Intent routing (visibility, knowledge, etc.)
                        ├── Section 2: Federated context (getFederatedContext)
                        ├── Section 4b: Knowledge federation
                        ├── Section 4b2: Store + people context injection
                        ├── Section 4b3: Local file search context
                        ├── Section 4c: Platform health
                        ├── Section 4d: Task creation
                        └── Section 4e: Content scheduling + AI generate
```

## Integration Points

| Module | Integration File | Section |
|---|---|---|
| `isDailyWorkAction` + `handleDailyWorkAction` | `response-pipeline.ts` | Section 0 |
| `resolveStore` + `resolvePerson` | `response-pipeline.ts` | Section 4b2 |
| `searchLocalFiles` + `formatFileResults` | `response-pipeline.ts` | Section 4b3 |
| `getFederatedContext` | `response-pipeline.ts` | Section 2 |
| `getPlatformHealthText` | `response-pipeline.ts` | Section 4c |
| `createTaskDraft` | `response-pipeline.ts` | Section 4d |
| `draftContent` | `response-pipeline.ts` | Section 4e |

## isActionMessage Fast-path Patterns

```typescript
const isActionMessage = /
  tìm file|find file|
  tìm.*rồi gửi|gửi file.*cho|
  find.*then send|send.*file|
  upload.*drive|lên drive|
  tạo meeting|create meeting|tạo lịch họp|
  raw là|bakudan ở|store nào|
  ở đâu.*(?:raw|bakudan)|(?:raw|bakudan).*ở đâu
/i.test(message);
```

## Key Engineering Decisions

### 1. Dual-layer action dispatch
- `isDailyWorkAction` in pipeline Section 0 catches action messages from any intent path
- `isActionMessage` in `chat.ts` catches action messages before intent parsing
- Both layers together ensure nothing falls through to wrong handler

### 2. Vietnamese regex robustness
- Use `.` wildcards in place of specific diacritics (e.g., `t.o` matches both `tạo` and `tao`)
- Encoding-independent matching across all pipeline entry points
- Tested on real Qwen3 tokenizer output

### 3. Calendar/Dashboard intent override
- When intent is `visibility_calendar` or `visibility_dashboard`, check action patterns INSIDE the handler
- This handles the case where `parseIntent` correctly identifies a calendar/dashboard action but the handler would have returned a static snapshot
- Routing logic: if action pattern → pipeline; else → snapshot

### 4. Stale process management (Windows)
- `kill <bash-pid>` only kills the bash wrapper, not the Windows node.exe
- Use `netstat -ano | grep ":4001"` → get Windows PID → `taskkill //F //PID <win-pid>`

---
MI_DAILY_WORK_PIPELINE_INTEGRATION_COMPLETE
