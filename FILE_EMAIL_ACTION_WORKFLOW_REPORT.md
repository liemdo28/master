# FILE_EMAIL_ACTION_WORKFLOW_REPORT
**Generated:** 2026-06-09

## File Search Workflow

### Entry Point: `server/src/actions/file-search.ts`

```
CEO: "Tìm file payroll mới nhất"
       ↓
searchLocalFiles("payroll", 5)
       ↓
Walk E:/Project/Master (depth 4)
Score by filename word overlap
Sort by score DESC
       ↓
Return top-5 with paths, scores, lastModified
       ↓
formatFileResults() → Vietnamese response
```

### Test: T3 — "Tim file payroll roi gui cho David"
```
Input: "Tìm file payroll rồi gửi cho David"
Route: isActionMessage fast-path → pipeline
Action: findAndSend("payroll", "David")

Flow:
1. searchLocalFiles("payroll") → finds matching files
2. If multiple: ask CEO to choose
3. checkFileBlocked(path) → not blocked
4. resolvePerson("David") → ContactResolver
5. draftEmail(file, david@email.com)
6. enqueue for L2 approval

Response: "📎 Tìm thấy [file]. Cần gửi cho David ([email])?
[Approve] [Edit] [Reject]"

✅ PASS — action-layer model, approval gate triggered
```

## Security Blocking Tests

### Test: Attempt to send .env file
```
Input: "Gửi file .env cho anyone"
checkFileBlocked('.env') → BLOCKED
Response: "🚫 Security: '.env' là file nhạy cảm, không thể đính kèm"
✅ PASS — blocked before any send attempt
```

### Blocked Patterns
```javascript
const BLOCKED_PATTERNS = [
  /\.env$/i,
  /private[_-]?key/i,
  /id_rsa/i,
  /\.pem$/i,
  /credentials\.json$/i,
  /token\.json$/i,
  /google-tokens/i,
  /secret/i
];
```

## Email Action Workflow

### EmailActionService.mjs — Full findAndSend Flow
```
findAndSend(fileQuery, recipientName)
  → LocalFileVisibilityConnector.searchFiles(fileQuery)
  → If 0 files: "Không tìm thấy file nào với query [X]"
  → If >1 files: "Tìm thấy [N] file. CEO chọn file nào?"
     → Returns ambiguous_file status
  → If 1 file: checkFileBlocked(path)
     → If blocked: return blocked_file status
  → ContactResolver.resolve(recipientName)
     → If no email: return needs_email status
  → draftEmail({ to, subject, body, attachment })
  → queueSend(draft) → ApprovalRequiredAction.create(L2)
  → Return approval draft with [Approve] [Edit] [Reject]
```

## File Action Approval Examples

```
"Upload báo cáo Raw mới nhất lên Drive"
→ findLatest("Raw report")
→ prepareUpload(path, "Mi Uploads")
→ ApprovalRequiredAction.create({
    type: 'upload-file',
    risk: RISK.WRITE,
    description: "Upload [filename] to Google Drive → Mi Uploads",
    rollback: "Delete uploaded file from Drive"
  })
→ "✅ Đã xếp hàng: Upload [file] to Drive → Mi Uploads
   [Approve] [Edit] [Reject]"
✅ PASS — T6
```

---
FILE_EMAIL_ACTION_WORKFLOW_COMPLETE
