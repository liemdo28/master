# DRIVE_ACTION_WORKFLOW_REPORT
**Generated:** 2026-06-09

## Test: T6 — "Upload latest Raw report lên Drive"

```
Input: "Upload latest Raw report len Drive"
Route: isActionMessage fast-path → pipeline → isDailyWorkAction check
Action: handleDailyWorkAction → DriveActionService.uploadFile

Flow:
1. Extract file query: "Raw report" (latest)
2. searchLocalFiles("Raw report") → find most recent by mtime
3. checkFileBlocked(path) → not blocked
4. prepareUpload(path, "Mi Uploads")
5. ApprovalRequiredAction.create({
     type: 'upload-file',
     risk: RISK.WRITE,
     rollback: 'Delete from Drive'
   })

Response:
"☁️ Upload: [Raw_QA_Report_June.pdf]
  → Google Drive / Mi Uploads
  [Approve] [Edit] [Reject]"

Model: action-layer/action
✅ PASS
```

## DriveActionService Methods

| Method | Level | Notes |
|---|---|---|
| `searchDrive(query)` | L1 auto | Reads from files_cache.json |
| `getRecent(limit)` | L1 auto | Last N files from cache |
| `uploadFile(localPath, folder)` | L2 | Needs approval |
| `createFolder(name)` | L2 | Needs approval |
| `shareFile(fileId, email, role)` | L2 | Default role: reader |
| `moveFile(fileId, targetFolder)` | L2 | Needs approval |

## Security Rules
- Any file matching BLOCKED_PATTERNS → upload rejected immediately
- CEO sees exactly what will be uploaded before approval
- Rollback plan: "Delete [filename] from Google Drive folder [X]"
- No public share links created without explicit CEO approval

## Upload Approval Format
```
☁️ Xếp hàng upload:
  📄 File: [filename] ([size])
  📁 Destination: Google Drive / [folder]
  🔒 Security: cleared
  ↩️ Rollback: Delete from Drive
  [Approve ✅] [Edit ✏️] [Reject ❌]
```

## Connector Fallback
When Google Drive not configured:
```
{
  status: 'CONNECTOR_NOT_CONFIGURED',
  message: 'Google Drive chưa được kết nối.',
  setup: 'Truy cập http://localhost:4001/api/auth/google/start'
}
```

---
DRIVE_ACTION_WORKFLOW_COMPLETE
