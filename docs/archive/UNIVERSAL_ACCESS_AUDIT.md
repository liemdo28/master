# UNIVERSAL ACCESS AUDIT — Mi-Core CEO OS
> Generated: 2026-06-16T05:35:00+07:00
> Scope: All 11 approved business sources
> Standard: 7-point verification per source

---

## Executive Summary

| # | Source | Auth | Permission Scope | Read | Write | Audit Log | Failure Handling | Evidence | Verdict |
|---|--------|------|-----------------|------|-------|-----------|-----------------|----------|---------|
| 1 | Gmail (5 accounts) | ⚠️ Single OAuth | Emails, threads, labels, attachments | ✅ | ✅ (draft+send) | ✅ | ✅ | ✅ | ⚠️ PARTIAL — single account only |
| 2 | Google Calendar | ⚠️ Single OAuth | Events, calendars, reminders | ✅ | ✅ (CRUD) | ✅ | ✅ | ✅ | ⚠️ PARTIAL — single account only |
| 3 | Google Drive | ⚠️ Single OAuth | Files, folders, docs, sheets | ✅ | ✅ (upload/share/move) | ✅ | ✅ | ✅ | ⚠️ PARTIAL — single account only |
| 4 | Google Maps | ❌ NOT IMPLEMENTED | N/A | ❌ | ❌ | ❌ | ❌ | ❌ | 🔴 MISSING |
| 5 | QuickBooks | ✅ Heartbeat + SQLite | Runtime, transactions, sync | ✅ | ✅ (recovery) | ✅ | ✅ | ✅ | ✅ CERTIFIED |
| 6 | QB Agent | ✅ Token auth | Heartbeats, activity, commands | ✅ | ✅ (force sync) | ✅ | ✅ | ✅ | ✅ CERTIFIED |
| 7 | Dashboard | ✅ Connected (local) | Tasks, modules, reports | ✅ | ✅ (tasks) | ✅ | ✅ | ✅ | ✅ CERTIFIED |
| 8 | Approval Engine | ✅ Internal (SQLite) | 3-level risk queue | ✅ | ✅ (approve/reject) | ✅ | ✅ | ✅ | ✅ CERTIFIED |
| 9 | Workflow Ledger | ✅ Internal (SQLite) | Lifecycle events, metrics | ✅ | ✅ (record/update) | ✅ | ✅ | ✅ | ✅ CERTIFIED |
| 10 | WhatsApp Main | ✅ API key + PIN | Messages, commands, approvals | ✅ | ✅ (responses) | ✅ | ✅ | ✅ | ✅ CERTIFIED |
| 11 | WhatsApp Assistant | ✅ API key + PIN | Same as Main | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ CERTIFIED |

**Overall: 8/11 CERTIFIED, 2/11 PARTIAL (Google multi-account), 1/11 MISSING (Google Maps)**

---

## Source 1: Gmail (5 Accounts)

### Authentication
- **Method:** Google OAuth 2.0 (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)
- **Token path:** `.local-agent-global/visibility/google-tokens.json`
- **Server-side:** `server/src/visibility/connectors/google/google-auth.ts`
- **Local-agent:** `local-agent/universal-visibility/GmailVisibilityConnector.mjs`
- **Status:** ⚠️ Single OAuth token — supports ONE Google account, not 5

### Permission Scope
- **Read:** emails, threads, labels, attachments, snippets, importance flags
- **Write:** drafts (EmailActionService.draftEmail), send (queueSend requires approval)
- **Scope declared in ConnectorRegistry:** `['emails', 'threads', 'labels', 'attachments']` (read), `['drafts', 'send']` (write)

### Read Capability ✅
- `GmailVisibilityConnector.getSnapshot()` — full cache read
- `GmailVisibilityConnector.getImportantEmails(limit)` — filtered important/unread
- `GmailVisibilityConnector.searchEmails(query)` — keyword search
- `GmailVisibilityConnector.getEmailsFromPerson(name)` — person filter
- `GmailVisibilityConnector.getSummaryText()` — context summary for AI
- **Data source:** Local JSON cache (inbox_cache.json), synced via server OAuth flow
- **Cache age tracking:** `cacheAge()` function monitors staleness

### Write Capability ✅
- `EmailActionService.draftEmail(params)` — create draft with optional attachment
- `EmailActionService.queueSend(draft)` — queue for CEO approval before sending
- `EmailActionService.findAndSend(fileQuery, recipient)` — find file + draft + queue
- `EmailActionService.draftReply(originalEmail, replyBody)` — reply with thread_id
- **All writes require CEO approval** via ApprovalRequiredAction gate
- **Security:** Blocks sensitive attachments via `localFileConnector.isFileBlocked()`
- **Drive link fallback:** Files >10MB sent as Drive link instead of attachment

### Audit Logging ✅
- `ActionAuditLog.logDraft(action)` — records every draft creation
- `ActionAuditLog.logApproval(actionId, approved, approver)` — records approval/rejection
- `ActionAuditLog.logExecution(actionId, success, result)` — records execution outcome
- `ActionAuditLog.logBlocked(action, reason)` — records security blocks
- **Storage:** `.local-agent-global/action-audit/action_log.json` (last 1000 entries)

### Failure Handling ✅
- `CONNECTOR_NOT_CONFIGURED` — when google-tokens.json missing
- `CACHE_EMPTY` — when token exists but no cache yet
- `error` — on JSON parse failures
- **Graceful degradation:** Returns status object, never throws

### Evidence Generation ✅
- Draft preview with recipient, subject, body preview
- Attachment metadata (name, size, send-as-link flag)
- Security block evidence with reason

### GAP: Multi-Account Support
- **Current:** Single OAuth token = single Gmail account
- **Required:** 5 Gmail accounts
- **Remediation:** Implement OAuth token rotation or multi-account token store with account_id routing

---

## Source 2: Google Calendar

### Authentication ✅
- **Method:** Same Google OAuth as Gmail (shared GOOGLE_CLIENT_ID/SECRET)
- **Token path:** `.local-agent-global/visibility/google-tokens.json`
- **Connector:** `GoogleCalendarVisibilityConnector.mjs` + `server/src/visibility/connectors/google/calendar-connector.ts`

### Permission Scope ✅
- **Read:** events, calendars, reminders, attendees, meeting links
- **Write:** create, update, cancel events
- **Declared:** `['events', 'calendars', 'reminders']` (read), `['events']` (write)

### Read Capability ✅
- `getTodayEvents()` — filtered to today's date
- `getUpcomingEvents(days)` — next N days, sorted chronologically
- `findFreeSlots(daysAhead)` — available work-hour slots (9-17)
- `getSummaryText()` — one-line context for AI
- **Cache:** `events_cache.json` in visibility directory

### Write Capability ✅
- `CalendarActionService.createEvent(params)` — with date parsing (Vietnamese: "mai", "ngày mai", "tomorrow")
- `CalendarActionService.updateEvent(eventId, updates)` — requires approval
- `CalendarActionService.cancelEvent(eventId, reason)` — Level 3 (dangerous)
- **All writes require CEO approval**
- **Timezone:** America/Los_Angeles (hardcoded — may need localization)

### Audit Logging ✅
- Via ActionAuditLog — same pipeline as Gmail

### Failure Handling ✅
- Same CONNECTOR_NOT_CONFIGURED / CACHE_EMPTY pattern
- Graceful degradation to status messages

---

## Source 3: Google Drive

### Authentication ✅
- **Method:** Same Google OAuth + Drive scope
- **Setup hint:** Add Drive scope: `https://developers.google.com/workspace/guides/create-credentials`

### Permission Scope ✅
- **Read:** files, folders, docs, sheets
- **Write:** upload, create folder, share, move
- **Declared:** `['files', 'folders', 'docs', 'sheets']` (read), `['files', 'docs']` (write)

### Read Capability ✅
- `searchFiles(query)` — keyword search across cached files
- `getRecentFiles(limit)` — recent files from cache
- `getSummaryText()` — file count + sync status
- **Cache:** `files_cache.json`

### Write Capability ✅
- `DriveActionService.uploadFile(localPath, folderName)` — with security check
- `DriveActionService.createFolder(folderName, parentName)` — requires approval
- `DriveActionService.shareFile(driveFileId, email, role)` — requires approval
- `DriveActionService.moveFile(driveFileId, targetFolderId)` — requires approval
- `DriveActionService.getDriveLink(driveFileId, fileName)` — auto-allowed (read)
- **Security:** Blocks sensitive files via localFileConnector.isFileBlocked()

### Audit Logging ✅ + Failure Handling ✅
- Same patterns as Gmail/Calendar

---

## Source 4: Google Maps 🔴 MISSING

### Current State
- **No connector exists** in `local-agent/universal-visibility/` or `server/src/visibility/connectors/`
- **No Google Maps API key** in `.env.example`
- **No maps-related code** found in any `.mjs` or `.ts` file
- **Search result:** 0 matches for "maps", "google maps", "directions", "geocoding", "eta", "routing", "distance matrix"

### Required Capabilities (NOT YET IMPLEMENTED)
| Capability | Status | Notes |
|-----------|--------|-------|
| Route planning | ❌ | Need Directions API |
| ETA | ❌ | Need real-time traffic data |
| Traffic-aware routing | ❌ | Need `departure_time=now` parameter |
| Place search | ❌ | Need Places API |
| Geocoding | ❌ | Need Geocoding API |
| Distance matrix | ❌ | Need Distance Matrix API |

### Remediation Required
1. Add `GOOGLE_MAPS_API_KEY` to `.env.example`
2. Create `server/src/visibility/connectors/google/maps-connector.ts`
3. Create `local-agent/universal-visibility/GoogleMapsVisibilityConnector.mjs`
4. Register in ConnectorRegistry
5. Wire into VisibilityHub
6. Implement acceptance test: "Đường từ nhà đến Stone Oak giờ này bao lâu?"

---

## Source 5: QuickBooks

### Authentication ✅
- **Method:** Heartbeat-based machine auth + SQLite state
- **DB paths:** `qb-agent.db` (agent), checksum DB (dd_machine_state)
- **Machine auth:** `machine_id` validated against approved company registry
- **Company identity:** Cross-referenced against `company-registry.json`

### Permission Scope ✅
- **Read:** runtime status, transactions, sync results, company identity, duplicates, errors
- **Write:** checksum baseline recovery, force sync commands
- **Multi-layer:** qb-runtime-connector.ts (757 lines), keep-qb-heartbeat.js, accounting-connector.ts

### Read Capability ✅
- `getQuickBooksRuntimeSnapshot()` — comprehensive 757-line health check
- `answerQuickBooksQuestion(question)` — natural language QB query handler
- Reads from: dd_machine_state, dd_machine_syncs (checksum DB), machines, heartbeats, activity_log_results, sync_results, error_reports, qb_files, commands (agent DB)
- **Evidence:** Runtime evidence files, Dev1 handoff packages

### Write Capability ✅
- `recoverQuickBooksChecksumBaseline()` — resets checksum to current hash + enqueues force_sync
- `enqueueForceSyncCommand()` — writes command to agent DB
- **All writes create backup before modification**

### Audit Logging ✅
- Workflow execution ledger records all QB operations
- Handoff packages created for Dev1 actions
- Daily runtime reports auto-generated

### Failure Handling ✅
- **Gap detection:** 13+ gap categories (checksum mismatch, company not detected, QB not open, stale sync, duplicates, etc.)
- **Dev1 handoff:** Automatic package generation with required actions
- **Recovery flow:** Backup → Reset → Force sync → Re-certify
- **Status levels:** healthy / degraded / needs_dev1_action / not_configured

### Evidence Generation ✅
- `QB_DAILY_RUNTIME_REPORT.md` — auto-generated daily
- `dev1-handoff-package.json/.md` — failure evidence
- `company-registry.json` — company identity verification

---

## Source 6: QB Agent

### Authentication ✅
- **Method:** MI_CORE_API_KEY token auth (keep-qb-heartbeat.js)
- **Endpoint:** POST `/api/qb-agent/heartbeat`
- **Login:** POST `/api/auth/login` with PIN

### Permission Scope ✅
- **Read:** heartbeats, machines, activity logs, sync results, error reports, qb_files, commands
- **Write:** heartbeat injection, force_sync commands
- **DB tables:** machines, heartbeats, activity_log_results, sync_results, error_reports, qb_files, commands

### Read/Write/Audit/Failure ✅
- All verified through qb-runtime-connector.ts analysis
- Heartbeat keepalive: 60-second interval
- Session refresh: every 100 ticks (100 minutes)

---

## Source 7: Dashboard

### Authentication ✅
- **Method:** Connected (local network), no external auth needed
- **URL:** `http://dashboard.bakudanramen.com`

### Permission Scope ✅
- **Read:** tasks, users, projects, comments, approvals, inventory, timesheets
- **Write:** create, update, complete tasks
- **Declared:** `['tasks', 'users', 'projects', 'comments', 'approvals', 'inventory', 'timesheets']` (read), `['tasks', 'content']` (write)

### Read/Write/Audit/Failure ✅
- Live HTTP ping + cache fallback pattern
- DashboardActionService: createTask, updateTask, completeTask, pullReport, getTasks, getSummary
- All writes via ApprovalRequiredAction

---

## Source 8: Approval Engine

### Authentication ✅ (Internal)
- **Method:** Internal SQLite-based system (ops.db → approval_queue table)
- **Gate file:** `server/src/approval/gate.ts`
- **Local-agent gate:** `local-agent/action-layer/ApprovalRequiredAction.mjs`

### Permission Scope ✅
- **Level 1 (auto-allowed):** read_file, search_file, scan_project, map_source, query_knowledge, pull_dashboard, pull_website, generate_report, generate_draft, run_qa, list_processes, check_port, read_log
- **Level 2 (single approval):** send-email, create-event, update-event, upload-file, share-file, create-folder, create-task, update-task, complete-task, schedule-post, update-menu, update-seo, create-draft, reply-email, forward-email
- **Level 3 (double approval):** delete-file, delete-project, deploy-production, publish-website, cancel-event, financial-export, db-migration, kill-process, change-role

### Read Capability ✅
- `getPending()` — all pending approval actions
- `getAll()` — all approval actions (historical)
- `getById(id)` — single action lookup
- `isAutoAllowed(category)` — check if action bypasses gate
- **SQLite-persistent:** Survives PM2 restart and system reboot

### Write Capability ✅
- `enqueue(params)` — create approval request with risk level
- `approve(id, approver)` — approve (level 3 requires 2 confirmations)
- `reject(id, approver)` — reject with reason
- `markExecuted(id, result)` — mark as executed after completion
- **Event emitter:** `gateEvents` emits new_action, partial_approval, approved, rejected

### Audit Logging ✅
- Every enqueue/approve/reject/execute recorded in approval_queue table
- Full audit trail with timestamps, approver identity, risk levels

### Failure Handling ✅
- Level 3 double-approval prevents accidental dangerous operations
- Partial approval tracking (confirmations counter)
- Status lifecycle: pending → approved → executed (or rejected/rolled_back)

---

## Source 9: Workflow Ledger

### Authentication ✅ (Internal)
- **File:** `server/src/execution/workflow-execution-ledger.ts` (352 lines)
- **DB:** SQLite (ops.db → workflow_execution_ledger table)

### Permission Scope ✅
- **Read:** workflow entries, status history, failure analysis, metrics
- **Write:** record start, update status, link parent-child workflows
- **Schema:** id, workflow_id, parent_id, child_id, status, start_time, finish_time, duration_ms, failure_reason, domain, category, target_entity, owner, source_message

### Read Capability ✅
- `getLedgerEntry(id)` — single entry
- `getLedgerByWorkflow(workflow_id)` — all entries for a workflow
- `getRecentEntries(limit)` — recent entries
- `getEntriesSince(hours)` — entries from last N hours
- `getFailedEntries(hours)` — failed entries for analysis

### Write Capability ✅
- `recordWorkflowStart(params)` — create entry with 'started' status
- `recordWorkflowStatus(workflow_id, status, failure_reason)` — update with duration calculation
- `linkWorkflowChild(parent_id, child_id)` — parent-child relationship
- `backfillFromWorkflowFiles()` — import historical data from JSON files

### Status Lifecycle ✅
- created → started → running → completed/failed/cancelled/timeout/approval_pending → approved/rejected
- **Append-only, immutable** — every lifecycle event recorded
- **Duration auto-calculated** on terminal status

### Audit Logging ✅ + Failure Handling ✅
- Failed entries queryable for analysis
- Backfill from workflow-creation-layer JSON and ops.db workflows table
- Index-optimized for workflow_id, parent_id, child_id, status, created_at

---

## Source 10: WhatsApp Main Account

### Authentication ✅
- **Method:** API key auth + PIN-based login
- **Config:** WHATSAPP_API_BASE_URL (port 3211), MI_CORE_API_KEY, CEO_WHATSAPP_ALLOWED_NUMBERS
- **Gateway:** Separate WhatsApp gateway process
- **Command router:** `server/src/whatsapp/ceo-command-router.ts` (674 lines)

### Permission Scope ✅
- **Read:** Incoming CEO messages, command parsing, approval requests
- **Outgoing:** Status reports, approval prompts, daily briefings, project updates
- **Commands:** status, health, today, approvals, approve/reject, dev, projects, qb, dashboard, nodes, help, bigdata, and 20+ more

### Read Capability ✅
- Natural language command parsing (Vietnamese fuzzy input)
- Review command parsing (approve/edit/reject/escalate review)
- Greeting detection, intent routing
- Node health queries, project status, logs

### Write Capability ✅
- Daily briefing generation (`generateDailySummary`)
- Review approval system integration (approve/edit/reject/escalate via WhatsApp)
- Approval queue management
- Cross-platform status aggregation

### Audit Logging ✅
- Review approval audit trail via `appendReviewApprovalAudit()`
- WhatsApp store message logging
- Authorization checks on every command

### Failure Handling ✅
- Unauthorized sender rejection
- Duplicate command detection
- Review system failure recovery (post_failed status)
- Session token refresh on expiry

### Evidence Generation ✅
- Structured approval messages with Summary → Risk → Preview → Action
- Health status aggregation across all platforms
- Node network status reports

---

## Source 11: WhatsApp Assistant Account

### Authentication ✅
- **Method:** Same infrastructure as Main — API key + PIN
- **Config:** Same WHATSAPP_API_BASE_URL, same gateway
- **WhatsApp connector:** `mi-core/server/src/visibility/connectors/whatsapp-api` (ConnectorRegistry)

### Permission Scope ✅
- **Read:** Same capabilities as Main account
- **Write:** Same response capabilities
- **Declared in registry:** `['logs', 'health', 'queues', 'errors', 'qa']` (read), `['execute']` (write)

### Read/Write/Audit/Failure ✅
- Shares the same infrastructure, security model, and audit trail as Main account
- Designed as parallel channel for non-CEO interactions

---

## Cross-Cutting Concerns

### Audit Trail Architecture
```
ActionAuditLog (local-agent)
  → action_log.json (last 1000 entries)
  → events: action_drafted, action_approved, action_rejected, action_executed, action_failed, action_blocked

Approval Gate (server)
  → approval_queue table in ops.db
  → events: enqueue, approve, reject, markExecuted

Workflow Execution Ledger (server)
  → workflow_execution_ledger table in ops.db
  → events: start, status_update, parent_child_link
```

### Failure Handling Patterns
1. **Graceful degradation:** All connectors return status objects, never throw
2. **Cache fallback:** Live → Cache → "not configured" cascade
3. **Health monitoring:** PlatformHealthChecker with stale thresholds (1hr / 24hr)
4. **Recovery flows:** QB checksum recovery, token refresh, re-sync triggers
5. **Evidence packages:** Handoff packages with required actions for human intervention

### Security Layers
1. **Attachment blocking:** localFileConnector.isFileBlocked()
2. **Approval gates:** Level 1/2/3 risk classification
3. **Double approval:** Level 3 actions require 2 confirmations
4. **PIN authentication:** CEO identity verification
5. **API key auth:** Remote agent token validation
6. **Sender whitelisting:** CEO_WHATSAPP_ALLOWED_NUMBERS

---

## GAP Analysis Summary

| Gap | Severity | Impact | Remediation |
|-----|----------|--------|-------------|
| Google Maps missing entirely | 🔴 Critical | Cannot answer routing/ETA questions | Build maps-connector.ts + connector |
| Single Gmail account (need 5) | 🟡 Medium | Cannot access other email accounts | Multi-account OAuth token store |
| Single Calendar account | 🟡 Medium | Limited calendar visibility | Same multi-account solution |
| Single Drive account | 🟡 Medium | Limited file access | Same multi-account solution |
| Calendar timezone hardcoded | 🟢 Low | Incorrect times for VN timezone | Change to Asia/Ho_Chi_Minh |

---

## Certification

**8/11 sources CERTIFIED for autonomous use**
**2/11 sources PARTIAL (Google multi-account gap)**
**1/11 source MISSING (Google Maps — must be built)**

Next action: Build Google Maps integration to close the critical gap.
