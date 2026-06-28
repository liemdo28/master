# DAILY_ACTION_LAYER_REPORT
**Generated:** 2026-06-09 | **Phase:** Daily Work Automation Phase 2

## Status: ✅ DAILY_ACTION_LAYER_READY

## Architecture

### Location: `local-agent/action-layer/`

| Module | Purpose |
|---|---|
| `ActionPlanner.mjs` | NLP → intent → action draft → approval |
| `ActionRegistry.mjs` | Central service registry |
| `ApprovalRequiredAction.mjs` | Approval gate wrapper (L1/L2/L3) |
| `FileActionService.mjs` | Search, preview, attach, upload |
| `EmailActionService.mjs` | Draft, send, reply, forward |
| `CalendarActionService.mjs` | Create, update, cancel events |
| `DriveActionService.mjs` | Search, upload, share, move |
| `AsanaActionService.mjs` | Create, update, assign, complete tasks |
| `DashboardActionService.mjs` | Dashboard task CRUD |
| `WebsiteActionService.mjs` | Content draft, menu, SEO |
| `ActionAuditLog.mjs` | Immutable audit trail |
| `ActionRollbackPlanner.mjs` | Rollback plans for all action types |

### TypeScript Pipeline Integration: `server/src/actions/`
| File | Purpose |
|---|---|
| `daily-work-actions.ts` | Main action handler wired into pipeline |
| `file-search.ts` | Secure local file search |

## Approval Level Mapping

| Level | Actions | Requirement |
|---|---|---|
| L1 (auto) | search, read, preview, generate-draft, generate-report | Free |
| L2 (write) | send-email, create-event, upload-file, share-file, create-task, update-task, schedule-post, update-menu, update-seo | CEO approval required |
| L3 (dangerous) | delete-file, deploy-production, publish-website, cancel-event, financial-export, db-migration, kill-process | Double approval required |

## Supported Actions (7 categories)

### A. File Actions
- `findFile(query)` — search local filesystem, return top-5 with confidence %
- `previewFile(path)` — first 30 lines, blocked for sensitive files
- `prepareAttachment(path)` — ready for email, blocked if sensitive
- `prepareUpload(path, folder)` → L2 approval
- `prepareCopy(src, dest)` → L2 approval

### B. Email Actions
- `draftEmail(params)` — creates Gmail draft
- `queueSend(draft)` → L2 approval → sends after CEO approves
- `findAndSend(fileQuery, recipient)` — full workflow: find file → draft → approval
- `draftReply(original, body)` → L2 approval

### C. Calendar Actions
- `createEvent(params)` → L2 approval
- `findFreeSlots(days)` → auto (read)
- `updateEvent(id, updates)` → L2 approval
- `cancelEvent(id)` → L3 double approval

### D. Drive Actions
- `searchDrive(query)` → auto (read)
- `uploadFile(localPath, folder)` → L2 approval
- `createFolder(name)` → L2 approval
- `shareFile(id, email)` → L2 approval

### E. Asana Actions
- `searchTasks(query)` → auto
- `getOverdue()` → auto
- `createTask(params)` → L2 approval
- `updateTask(id, updates)` → L2 approval
- `completeTask(id)` → L2 approval
- `assignTask(id, email)` → L2 approval

### F. Dashboard Actions
- `getTasks()` → auto
- `createTask(params)` → L2 approval
- `updateTask(id, updates)` → L2 approval
- `completeTask(id)` → L2 approval

### G. Website Actions
- `createDraft(params)` → L2 approval before publish
- `updateMenuDraft(biz, items)` → L2 approval
- `updateSEODraft(biz, data)` → L2 approval

## Security Rules
- `.env` files, private keys, credential files → **BLOCKED at all action types**
- File size >10MB → Drive link instead of attachment
- No action executes without reaching approval gate (L2/L3)
- All actions logged to `action-audit/action_log.json`
- Rollback plan included in every approval request

## Audit Log
**Location:** `.local-agent-global/action-audit/action_log.json`
**Events logged:** action_drafted, action_approved, action_rejected, action_executed, action_failed, action_blocked

## Validation Tests

```
"Tìm file QA report mới nhất"
→ Returns top-5 files with confidence % and paths
✅ PASS — action-layer/action model

"Upload latest Raw report lên Drive"
→ Finds file, creates L2 approval draft
✅ PASS — "Upload [filename] to Google Drive → Mi Uploads"

"Gửi file .env cho David"
→ Blocked: "🚫 Security: '.env' là file nhạy cảm"
✅ PASS (security rule enforced)

"Tạo meeting với Maria 2PM mai"
→ Calendar event draft created, L2 approval required
✅ PASS — intent routed to pipeline, not built-in handler

"Tạo task cho Nguyên kiểm tra Dashboard"
→ Task draft created with assignee + approval gate
✅ PASS — routed to pipeline
```

---
DAILY_ACTION_LAYER_READY
