# Controllers

Total: 128 controllers

### ActionCenterController
- **File**: `controllers\ActionCenterController.php`
- **Type**: php
- **Methods**: `index`, `getPendingApprovals`, `getNeedsReview`, `getNeedsEscalation`, `getNeedsAttention`, `renderView`

### ActivityFeedController
- **File**: `controllers\ActivityFeedController.php`
- **Type**: php
- **Methods**: `index`, `apiActivity`, `getActivities`, `getActivityCount`

### AdminDeadlineExtensionController
- **File**: `controllers\AdminDeadlineExtensionController.php`
- **Type**: php
- **Methods**: `index`, `apiApprove`, `apiReject`, `apiPending`

### AdminTaskAuditController
- **File**: `controllers\AdminTaskAuditController.php`
- **Type**: php
- **Methods**: `duplicates`, `duplicateGroup`, `archiveDuplicate`, `mergeDuplicates`, `allTasks`, `byStore`, `workflow`, `workflowCheck`, `workflowAccept`, `workflowReject`, `workflowReopen`, `verifyCsrfOrExit`

### AdoptionMetricsController
- **File**: `controllers\AdoptionMetricsController.php`
- **Type**: php
- **Methods**: `index`, `apiMetrics`, `computeKPIs`

### AiTaskController
- **File**: `controllers\AiTaskController.php`
- **Type**: php
- **Methods**: `index`, `storeIndex`, `billIndex`, `createStoreForProjects`, `createStoreForBills`, `storeProjects`, `createProjectForStore`, `billImport`, `analyzeBill`, `saveBill`, `discardBill`, `show`, `analyze`, `create`, `discard`, `createStoreFromRequest`, `loadProjectContext`, `loadStoreContext`, `getTaskPreview`, `saveTaskPreview`, `clearTaskPreview`, `getBillPreview`, `saveBillPreview`, `clearBillPreview`, `cleanupPreviewFile`, `detectMimeType`, `isAllowedMimeType`, `storeUploadedFile`, `attachStoredFileToBill`, `mapSuggestedTask`, `buildTasksFromRequest`, `mapSuggestedBill`, `buildBillFromRequest`, `matchByName`, `normalizeLookup`, `normalizePriority`, `normalizeStatus`, `normalizeBillStatus`, `normalizeDate`, `normalizeAmount`, `normalizeColor`, `normalizeConfidence`

### ApprovalNoteController
- **File**: `controllers\ApprovalNoteController.php`
- **Type**: php
- **Methods**: `uid`, `store`, `delete`

### AsanaController
- **File**: `controllers\AsanaController.php`
- **Type**: php
- **Methods**: `index`, `fetchWorkspaces`, `saveSettings`, `updateTargetProject`, `disconnect`, `executeImport`, `cronSync`, `syncMyTasksFromAsana`, `syncFromAsana`, `resolveStoreId`, `ensureSection`, `ensureTable`, `emptySyncResult`, `resolveDashboardUserId`, `ensureAsanaMyTasksProject`, `mapAsanaTaskToLocal`, `inferPriorityFromAsana`, `persistAsanaTaskMirror`, `normalizeAsanaDateTime`, `asanaGet`

### AuthController
- **File**: `controllers\AuthController.php`
- **Type**: php
- **Methods**: `showLogin`, `login`, `showRegister`, `register`, `logout`, `requireAdminAccess`, `verifyAdminUserCsrf`, `adminUserFormData`, `validateAdminUserData`, `loadStores`, `listUsers`, `showCreateUser`, `createUser`, `editUser`, `updateUser`, `showUser`, `toggleUser`, `deactivateUser`, `deleteUser`, `resetUserPassword`, `settings`, `adminUpdateUser`, `updateSettings`

### BillController
- **File**: `controllers\BillController.php`
- **Type**: php
- **Methods**: `templates`, `createTemplate`, `generateTemplate`, `index`, `apiDetail`, `storeView`, `createStore`, `updateStore`, `deleteStore`, `createBill`, `updateBill`, `deleteBill`, `markPaid`, `apiMarkPaid`, `duplicateBill`, `uploadBillFile`, `deleteBillAttachment`, `downloadBillAttachment`, `handleBillFileUpload`, `convertProjectsToBills`, `seedRawStocktonBills`, `extractRepeatSettings`, `recordPayment`, `apiPayments`

### CommandCenterController
- **File**: `controllers\CommandCenterController.php`
- **Type**: php
- **Methods**: `index`, `predictions`, `runPredictions`, `acknowledgePrediction`, `recommendations`, `acceptRecommendation`, `scores`, `workflows`, `createWorkflow`, `notifications`, `simulations`, `runSimulation`, `memory`, `aiDecisions`, `apiSummary`, `getModuleStatus`, `calculateOverallHealth`

### CommentController
- **File**: `controllers\CommentController.php`
- **Type**: php
- **Methods**: `store`, `delete`

### CompanyCalendarController
- **File**: `controllers\CompanyCalendarController.php`
- **Type**: php
- **Methods**: `index`, `getCalendarEvents`, `billCategoryColor`, `renderView`

### ControlTowerController
- **File**: `controllers\ControlTowerController.php`
- **Type**: php
- **Methods**: `index`, `getOverallHealth`, `getStoreHealth`, `getEmployeeStatus`, `getPayrollStatus`, `getReleaseStatus`, `getAuditStatus`, `getIncidentStatus`, `getTrainingStatus`, `renderView`

### CredentialController
- **File**: `controllers\CredentialController.php`
- **Type**: php
- **Methods**: `requireAdmin`, `requireCanViewCredential`, `ip`, `ua`, `index`, `create`, `store`, `show`, `edit`, `update`, `delete`, `viewPassword`, `copyPassword`, `grantAccess`, `revokeAccess`, `createRotationTask`, `rotation`, `auditLogs`

### DashboardController
- **File**: `controllers\DashboardController.php`
- **Type**: php
- **Methods**: `index`, `calendar`, `inbox`, `apiFocusNext`, `myTasks`, `relatedTasks`, `newTasks`, `overview`, `commandCenterPage`, `businessDetail`, `memberDetail`, `team`, `ceo`

### DashboardCustomizationController
- **File**: `controllers\DashboardCustomizationController.php`
- **Type**: php
- **Methods**: `getLayout`, `saveLayout`, `resetLayout`

### DeadlineExtensionController
- **File**: `controllers\DeadlineExtensionController.php`
- **Type**: php
- **Methods**: `selfExtend`, `requestExtend`, `approve`, `reject`, `pendingCount`, `adminIndex`, `verifyCsrf`, `validDate`

### FavoritesController
- **File**: `controllers\FavoritesController.php`
- **Type**: php
- **Methods**: `index`, `store`, `destroy`, `reorder`

### FranchiseController
- **File**: `controllers\FranchiseController.php`
- **Type**: php
- **Methods**: `orgChart`, `scorecard`, `benchmarks`, `goals`, `createGoal`, `budget`, `createBudgetRequest`, `approveBudget`, `apiRegions`, `apiCreateRegion`, `apiDistricts`, `apiCreateDistrict`, `apiHierarchy`, `apiOrgChart`, `apiScorecard`, `apiBenchmarks`, `apiStoreKpi`, `cronKpiSnapshot`

### FranchisePlaybooksController
- **File**: `controllers\FranchisePlaybooksController.php`
- **Type**: php
- **Methods**: `index`, `show`, `run`, `getPlaybooks`, `getPlaybookByKey`, `getComplianceStatus`, `renderView`

### GoogleController
- **File**: `controllers\GoogleController.php`
- **Type**: php
- **Methods**: `connect`, `callback`

### HealthMonitorController
- **File**: `controllers\HealthMonitorController.php`
- **Type**: php
- **Methods**: `index`, `apiStatus`, `runHealthChecks`, `checkDatabase`, `checkScheduler`, `checkNotifications`, `checkReleases`, `checkEmailQueue`, `checkDiskSpace`, `checkErrorRate`

### InboxController
- **File**: `controllers\InboxController.php`
- **Type**: php
- **Methods**: `index`, `markRead`, `markAllRead`, `apiList`

### IncidentController
- **File**: `controllers\IncidentController.php`
- **Type**: php
- **Methods**: `requireAuth`, `requireRole`, `index`, `show`, `create`, `store`, `update`, `acknowledge`, `investigate`, `resolve`, `close`, `cancel`, `escalate`, `assign`, `addComment`, `deleteAttachment`, `apiList`, `apiStats`, `handleAttachments`, `render`

### ManagerCommandController
- **File**: `controllers\ManagerCommandController.php`
- **Type**: php
- **Methods**: `command`, `getTeamStatus`, `getStoreOverview`, `getPayrollPending`, `getActionItems`, `renderView`

### MyDayController
- **File**: `controllers\MyDayController.php`
- **Type**: php
- **Methods**: `index`

### MyWorkspaceController
- **File**: `controllers\MyWorkspaceController.php`
- **Type**: php
- **Methods**: `index`

### NotificationCenterController
- **File**: `controllers\NotificationCenterController.php`
- **Type**: php
- **Methods**: `index`, `markRead`, `snooze`

### ObligationController
- **File**: `controllers\ObligationController.php`
- **Type**: php
- **Methods**: `index`, `show`, `store`, `update`, `delete`, `generate`, `apiKpis`, `apiWidget`, `reviewerQueue`, `apiReview`, `approverQueue`, `apiApprove`, `apiPayment`, `paymentDetail`

### OperationsController
- **File**: `controllers\OperationsController.php`
- **Type**: php
- **Methods**: `today`, `getOverdueTasks`, `getTodayTasks`, `getPendingAudits`, `getPendingPayroll`, `getPendingReleases`, `getStoreHealthIssues`, `getPayrollVariances`, `getRecentAuditFails`, `getNewIncidents`, `getOverloadedManagers`, `getLateEmployees`, `getStoreOverdueCounts`, `enrichTasks`, `renderView`

### PayrollController
- **File**: `controllers\PayrollController.php`
- **Type**: php
- **Methods**: `requireAdmin`, `index`, `create`, `store`, `show`, `process`, `complete`, `markPaid`, `addAdjustment`, `cancel`, `apiStats`, `render`

### PenaltyController
- **File**: `controllers\PenaltyController.php`
- **Type**: php
- **Methods**: `adminIndex`, `adminAdd`, `adminUpdate`, `adminRemove`, `adminToggle`, `adminDetail`, `adminSummaryApi`, `mySummaryApi`

### ProjectController
- **File**: `controllers\ProjectController.php`
- **Type**: php
- **Methods**: `index`, `showMergeForm`, `applyMerge`, `adminDelete`, `bulkComplete`, `classifyByStore`, `create`, `store`, `show`, `filterTasks`, `sortTasks`, `groupTasks`, `edit`, `update`, `delete`, `archive`, `renameSection`, `addMember`, `removeMember`, `addSection`, `deleteSection`, `migrateAsanaProjects`, `bulkAssignStores`, `cleanupOverdueTasks`, `resolveStoreByName`

### ReleaseArtifactsController
- **File**: `controllers\ReleaseArtifactsController.php`
- **Type**: php
- **Methods**: `index`, `store`, `destroy`

### ReleaseController
- **File**: `controllers\ReleaseController.php`
- **Type**: php
- **Methods**: `index`, `show`, `create`, `update`, `transition`, `schedule`, `cancelSchedule`, `addReview`, `createLink`, `deactivateLink`, `publicReview`, `updateWalkthrough`, `updateScores`, `createFreeze`, `endFreeze`, `apiStats`, `processScheduled`, `ceoReview`

### ReviewerNotesController
- **File**: `controllers\ReviewerNotesController.php`
- **Type**: php
- **Methods**: `uid`, `canManageNote`, `loadTask`, `store`, `acknowledge`, `toggleChecklistItem`, `delete`, `requestChanges`, `requestInfo`, `parseChecklist`

### SearchController
- **File**: `controllers\SearchController.php`
- **Type**: php
- **Methods**: `index`, `apiSearch`, `search`

### ShiftController
- **File**: `controllers\ShiftController.php`
- **Type**: php
- **Methods**: `requireAdmin`, `index`, `store`, `update`, `delete`, `apiStats`

### StoreChecklistController
- **File**: `controllers\StoreChecklistController.php`
- **Type**: php
- **Methods**: `open`, `submitOpen`, `close`, `submitClose`, `history`, `renderView`

### StoreCommandController
- **File**: `controllers\StoreCommandController.php`
- **Type**: php
- **Methods**: `requireManager`, `index`, `show`, `apiHealthScore`, `apiStats`, `render`

### StoreController
- **File**: `controllers\StoreController.php`
- **Type**: php
- **Methods**: `index`, `create`, `update`, `show`, `delete`, `dataHygiene`, `mergeStores`

### TaskApprovalController
- **File**: `controllers\TaskApprovalController.php`
- **Type**: php
- **Methods**: `uid`, `requireLogin`, `csrf`, `loadTask`, `notifyUser`, `submit`, `reviewApprove`, `reviewReject`, `accept`, `acceptReject`, `reopenApproval`

### TaskCommentController
- **File**: `controllers\TaskCommentController.php`
- **Type**: php
- **Methods**: `store`, `delete`, `getJson`, `mentionSearch`

### TaskController
- **File**: `controllers\TaskController.php`
- **Type**: php
- **Methods**: `buildRepeatConfigFromPost`, `parseJsonListFromPost`, `parseChecklistFromPost`, `canAccessTask`, `show`, `getJson`, `store`, `update`, `delete`, `toggleComplete`, `accept`, `reschedule`, `duplicate`, `updateWatchers`, `move`, `reorder`, `upload`, `deleteAttachment`, `downloadAttachment`, `previewReassign`, `bulkReassign`

### TeamController
- **File**: `controllers\TeamController.php`
- **Type**: php
- **Methods**: `guard`, `buildMembers`, `buildKpiAndRecs`, `index`, `memberDetail`, `apiSummary`, `apiMembers`, `apiRebalancePlan`, `apiRebalanceApply`, `apiRebalanceStatus`, `apiDecisionProblems`, `apiDecisionCompare`, `apiMemberDetail`, `apiDecisionRank`, `apiDecisionNext`, `apiDecisionSimulate`, `apiAutonomyDecisions`, `apiAutonomyApprove`, `apiAutonomyReject`, `apiAutonomyExecute`, `apiAutonomyLog`, `apiAutonomySettings`

### TelegramConnectController
- **File**: `controllers\TelegramConnectController.php`
- **Type**: php
- **Methods**: `settingsPage`, `initConnect`, `disconnect`, `status`, `testSend`, `setWebhook`

### TelegramController
- **File**: `controllers\TelegramController.php`
- **Type**: php
- **Methods**: `handleWebhook`, `handleMessage`, `handleCallbackQuery`, `handleAccountLink`, `initLink`, `unlink`, `savePreferences`, `setupWebhook`, `routeToAi`, `processTaskCreation`, `confirmCreateTask`, `processQa`, `sendUserStatus`, `sendTodayTasks`, `helpText`, `intentPrompt`, `taskParsePrompt`, `qaSystemPrompt`

### TelegramWebhookController
- **File**: `controllers\TelegramWebhookController.php`
- **Type**: php
- **Methods**: `handle`, `isTelegramIp`, `ipInCidr`

### VendorController
- **File**: `controllers\VendorController.php`
- **Type**: php
- **Methods**: `index`, `create`, `update`, `delete`, `upload`, `deleteAttachment`, `downloadAttachment`

### VerificationController
- **File**: `controllers\VerificationController.php`
- **Type**: php
- **Methods**: `apiSummary`, `rulesScreen`, `apiAccountingSummary`, `teamHealthScore`, `topRisks`

### WalkthroughLibraryController
- **File**: `controllers\WalkthroughLibraryController.php`
- **Type**: php
- **Methods**: `requireAdmin`, `index`, `apiSummary`, `render`

### WarRoomController
- **File**: `controllers\WarRoomController.php`
- **Type**: php
- **Methods**: `index`, `create`, `view`, `addTimeline`, `addAction`, `resolve`, `updateStatus`, `getActiveSessions`, `getAllSessions`, `getSession`, `getCriticalData`, `addTimelineEvent`

### WorkflowExecutionApiController
- **File**: `controllers\WorkflowExecutionApiController.php`
- **Type**: php
- **Methods**: `myWork`, `reviewerQueue`, `approverQueue`, `commandCenter`, `myWorkList`, `reviewerQueueList`, `approverQueueList`, `requireAuth`, `bearerToken`, `count`, `tryCount`

### __build
- **File**: `controllers\__build.py`
- **Type**: python

### __tmp
- **File**: `controllers\__tmp.py`
- **Type**: python

### ActionCenterController
- **File**: `controllers\ActionCenterController.php`
- **Type**: php
- **Methods**: `index`, `getPendingApprovals`, `getNeedsReview`, `getNeedsEscalation`, `getNeedsAttention`, `renderView`

### ActivityFeedController
- **File**: `controllers\ActivityFeedController.php`
- **Type**: php
- **Methods**: `index`, `apiActivity`, `getActivities`, `getActivityCount`

### AdminDeadlineExtensionController
- **File**: `controllers\AdminDeadlineExtensionController.php`
- **Type**: php
- **Methods**: `index`, `apiApprove`, `apiReject`, `apiPending`

### AdminTaskAuditController
- **File**: `controllers\AdminTaskAuditController.php`
- **Type**: php
- **Methods**: `duplicates`, `duplicateGroup`, `archiveDuplicate`, `mergeDuplicates`, `allTasks`, `byStore`, `workflow`, `workflowCheck`, `workflowAccept`, `workflowReject`, `workflowReopen`, `verifyCsrfOrExit`

### AdoptionMetricsController
- **File**: `controllers\AdoptionMetricsController.php`
- **Type**: php
- **Methods**: `index`, `apiMetrics`, `computeKPIs`

### AiTaskController
- **File**: `controllers\AiTaskController.php`
- **Type**: php
- **Methods**: `index`, `storeIndex`, `billIndex`, `createStoreForProjects`, `createStoreForBills`, `storeProjects`, `createProjectForStore`, `billImport`, `analyzeBill`, `saveBill`, `discardBill`, `show`, `analyze`, `create`, `discard`, `createStoreFromRequest`, `loadProjectContext`, `loadStoreContext`, `getTaskPreview`, `saveTaskPreview`, `clearTaskPreview`, `getBillPreview`, `saveBillPreview`, `clearBillPreview`, `cleanupPreviewFile`, `detectMimeType`, `isAllowedMimeType`, `storeUploadedFile`, `attachStoredFileToBill`, `mapSuggestedTask`, `buildTasksFromRequest`, `mapSuggestedBill`, `buildBillFromRequest`, `matchByName`, `normalizeLookup`, `normalizePriority`, `normalizeStatus`, `normalizeBillStatus`, `normalizeDate`, `normalizeAmount`, `normalizeColor`, `normalizeConfidence`

### ClientLogController
- **File**: `controllers\api\ClientLogController.php`
- **Type**: php
- **Methods**: `store`, `writeLog`, `sanitize`

### CredentialController
- **File**: `controllers\api\CredentialController.php`
- **Type**: php
- **Methods**: `getCurrentUser`, `getClientIp`, `getUserAgent`, `json`, `requireAuth`, `requireAdmin`, `index`, `show`, `store`, `update`, `destroy`, `viewPassword`, `grantAccess`, `revokeAccess`, `rotationStats`, `rotationDue`, `completeRotation`, `audit`, `credentialAudit`

### ApiController
- **File**: `controllers\api\v1\ApiController.php`
- **Type**: php
- **Methods**: `parseRequestHeaders`, `getJsonInput`, `getBearerToken`, `requireAuth`, `requireAdmin`, `validateRequired`, `validateEmail`, `safeInt`, `safeString`, `paginationParams`, `auditLog`, `broadcast`, `broadcastTaskEvent`, `userProfile`

### AuthApiController
- **File**: `controllers\api\v1\AuthApiController.php`
- **Type**: php
- **Methods**: `login`, `register`, `logout`, `refresh`, `me`, `forgotPassword`, `resetPassword`, `logoutAll`, `registerDevice`

### CalendarApiController
- **File**: `controllers\api\v1\CalendarApiController.php`
- **Type**: php
- **Methods**: `index`, `day`, `formatDayTask`, `recurrenceLabel`

### CommentApiController
- **File**: `controllers\api\v1\CommentApiController.php`
- **Type**: php
- **Methods**: `destroy`, `update`

### CredentialApiController
- **File**: `controllers\api\v1\CredentialApiController.php`
- **Type**: php
- **Methods**: `requireCredentialAdmin`, `requireCredentialPermission`, `sanitizeCredential`, `buildRotationStatus`, `index`, `show`, `store`, `update`, `destroy`, `viewPassword`, `grantAccess`, `revokeAccess`, `rotationStats`, `rotationDue`, `createRotationTask`, `completeRotation`, `audit`, `credentialAudit`

### DashboardApiController
- **File**: `controllers\api\v1\DashboardApiController.php`
- **Type**: php
- **Methods**: `summary`, `formatMiniTask`

### FocusApiController
- **File**: `controllers\api\v1\FocusApiController.php`
- **Type**: php
- **Methods**: `index`, `decisions`, `risk`, `activity`, `approvals`, `resolveApproval`, `buildRiskChips`, `riskLevel`

### MyTasksApiController
- **File**: `controllers\api\v1\MyTasksApiController.php`
- **Type**: php
- **Methods**: `myTasks`, `newTasks`, `acceptTask`

### NotificationApiController
- **File**: `controllers\api\v1\NotificationApiController.php`
- **Type**: php
- **Methods**: `index`, `markAllRead`, `unreadCount`, `formatNotification`

### PenaltyConfigApiController
- **File**: `controllers\api\v1\PenaltyConfigApiController.php`
- **Type**: php
- **Methods**: `show`, `update`, `isAdmin`

### ProjectApiController
- **File**: `controllers\api\v1\ProjectApiController.php`
- **Type**: php
- **Methods**: `index`, `show`, `store`, `update`, `formatProject`

### SyncApiController
- **File**: `controllers\api\v1\SyncApiController.php`
- **Type**: php
- **Methods**: `ensureTable`, `poll`, `stream`, `broadcast`, `status`, `formatEvent`

### TaskApiController
- **File**: `controllers\api\v1\TaskApiController.php`
- **Type**: php
- **Methods**: `index`, `store`, `show`, `update`, `changeStatus`, `assign`, `complete`, `moveDate`, `snooze`, `destroy`, `addComment`, `getComments`, `buildFilters`, `countTasks`, `fetchTasks`, `applyFilters`, `checkTaskAccess`, `checkTaskEditAccess`, `formatTask`, `formatComment`, `formatAttachment`

### TaskApprovalApiController
- **File**: `controllers\api\v1\TaskApprovalApiController.php`
- **Type**: php
- **Methods**: `ok`, `fail`, `requireAuth`, `loadTask`, `body`, `submit`, `reviewApprove`, `reviewReject`, `accept`, `acceptReject`, `reopenApproval`, `approvalHistory`

### UploadApiController
- **File**: `controllers\api\v1\UploadApiController.php`
- **Type**: php
- **Methods**: `upload`

### UserApiController
- **File**: `controllers\api\v1\UserApiController.php`
- **Type**: php
- **Methods**: `index`, `show`, `updateProfile`, `updatePassword`, `updatePushToken`

### ApprovalNoteController
- **File**: `controllers\ApprovalNoteController.php`
- **Type**: php
- **Methods**: `uid`, `store`, `delete`

### AsanaController
- **File**: `controllers\AsanaController.php`
- **Type**: php
- **Methods**: `index`, `fetchWorkspaces`, `saveSettings`, `updateTargetProject`, `disconnect`, `executeImport`, `cronSync`, `syncMyTasksFromAsana`, `syncFromAsana`, `resolveStoreId`, `ensureSection`, `ensureTable`, `emptySyncResult`, `resolveDashboardUserId`, `ensureAsanaMyTasksProject`, `mapAsanaTaskToLocal`, `inferPriorityFromAsana`, `persistAsanaTaskMirror`, `normalizeAsanaDateTime`, `asanaGet`

### AuthController
- **File**: `controllers\AuthController.php`
- **Type**: php
- **Methods**: `showLogin`, `login`, `showRegister`, `register`, `logout`, `requireAdminAccess`, `verifyAdminUserCsrf`, `adminUserFormData`, `validateAdminUserData`, `loadStores`, `listUsers`, `showCreateUser`, `createUser`, `editUser`, `updateUser`, `showUser`, `toggleUser`, `deactivateUser`, `deleteUser`, `resetUserPassword`, `settings`, `adminUpdateUser`, `updateSettings`

### BillController
- **File**: `controllers\BillController.php`
- **Type**: php
- **Methods**: `templates`, `createTemplate`, `generateTemplate`, `index`, `apiDetail`, `storeView`, `createStore`, `updateStore`, `deleteStore`, `createBill`, `updateBill`, `deleteBill`, `markPaid`, `apiMarkPaid`, `duplicateBill`, `uploadBillFile`, `deleteBillAttachment`, `downloadBillAttachment`, `handleBillFileUpload`, `convertProjectsToBills`, `seedRawStocktonBills`, `extractRepeatSettings`, `recordPayment`, `apiPayments`

### CommandCenterController
- **File**: `controllers\CommandCenterController.php`
- **Type**: php
- **Methods**: `index`, `predictions`, `runPredictions`, `acknowledgePrediction`, `recommendations`, `acceptRecommendation`, `scores`, `workflows`, `createWorkflow`, `notifications`, `simulations`, `runSimulation`, `memory`, `aiDecisions`, `apiSummary`, `getModuleStatus`, `calculateOverallHealth`

### CommentController
- **File**: `controllers\CommentController.php`
- **Type**: php
- **Methods**: `store`, `delete`

### CompanyCalendarController
- **File**: `controllers\CompanyCalendarController.php`
- **Type**: php
- **Methods**: `index`, `getCalendarEvents`, `billCategoryColor`, `renderView`

### ControlTowerController
- **File**: `controllers\ControlTowerController.php`
- **Type**: php
- **Methods**: `index`, `getOverallHealth`, `getStoreHealth`, `getEmployeeStatus`, `getPayrollStatus`, `getReleaseStatus`, `getAuditStatus`, `getIncidentStatus`, `getTrainingStatus`, `renderView`

### CredentialController
- **File**: `controllers\CredentialController.php`
- **Type**: php
- **Methods**: `requireAdmin`, `requireCanViewCredential`, `ip`, `ua`, `index`, `create`, `store`, `show`, `edit`, `update`, `delete`, `viewPassword`, `copyPassword`, `grantAccess`, `revokeAccess`, `createRotationTask`, `rotation`, `auditLogs`

### DashboardController
- **File**: `controllers\DashboardController.php`
- **Type**: php
- **Methods**: `index`, `calendar`, `inbox`, `apiFocusNext`, `myTasks`, `relatedTasks`, `newTasks`, `overview`, `commandCenterPage`, `businessDetail`, `memberDetail`, `team`, `ceo`

### DashboardCustomizationController
- **File**: `controllers\DashboardCustomizationController.php`
- **Type**: php
- **Methods**: `getLayout`, `saveLayout`, `resetLayout`

### DeadlineExtensionController
- **File**: `controllers\DeadlineExtensionController.php`
- **Type**: php
- **Methods**: `selfExtend`, `requestExtend`, `approve`, `reject`, `pendingCount`, `adminIndex`, `verifyCsrf`, `validDate`

### FavoritesController
- **File**: `controllers\FavoritesController.php`
- **Type**: php
- **Methods**: `index`, `store`, `destroy`, `reorder`

### FranchiseController
- **File**: `controllers\FranchiseController.php`
- **Type**: php
- **Methods**: `orgChart`, `scorecard`, `benchmarks`, `goals`, `createGoal`, `budget`, `createBudgetRequest`, `approveBudget`, `apiRegions`, `apiCreateRegion`, `apiDistricts`, `apiCreateDistrict`, `apiHierarchy`, `apiOrgChart`, `apiScorecard`, `apiBenchmarks`, `apiStoreKpi`, `cronKpiSnapshot`

### FranchisePlaybooksController
- **File**: `controllers\FranchisePlaybooksController.php`
- **Type**: php
- **Methods**: `index`, `show`, `run`, `getPlaybooks`, `getPlaybookByKey`, `getComplianceStatus`, `renderView`

### GoogleController
- **File**: `controllers\GoogleController.php`
- **Type**: php
- **Methods**: `connect`, `callback`

### HealthMonitorController
- **File**: `controllers\HealthMonitorController.php`
- **Type**: php
- **Methods**: `index`, `apiStatus`, `runHealthChecks`, `checkDatabase`, `checkScheduler`, `checkNotifications`, `checkReleases`, `checkEmailQueue`, `checkDiskSpace`, `checkErrorRate`

### InboxController
- **File**: `controllers\InboxController.php`
- **Type**: php
- **Methods**: `index`, `markRead`, `markAllRead`, `apiList`

### IncidentController
- **File**: `controllers\IncidentController.php`
- **Type**: php
- **Methods**: `requireAuth`, `requireRole`, `index`, `show`, `create`, `store`, `update`, `acknowledge`, `investigate`, `resolve`, `close`, `cancel`, `escalate`, `assign`, `addComment`, `deleteAttachment`, `apiList`, `apiStats`, `handleAttachments`, `render`

### ManagerCommandController
- **File**: `controllers\ManagerCommandController.php`
- **Type**: php
- **Methods**: `command`, `getTeamStatus`, `getStoreOverview`, `getPayrollPending`, `getActionItems`, `renderView`

### MyDayController
- **File**: `controllers\MyDayController.php`
- **Type**: php
- **Methods**: `index`

### MyWorkspaceController
- **File**: `controllers\MyWorkspaceController.php`
- **Type**: php
- **Methods**: `index`

### NotificationCenterController
- **File**: `controllers\NotificationCenterController.php`
- **Type**: php
- **Methods**: `index`, `markRead`, `snooze`

### ObligationController
- **File**: `controllers\ObligationController.php`
- **Type**: php
- **Methods**: `index`, `show`, `store`, `update`, `delete`, `generate`, `apiKpis`, `apiWidget`, `reviewerQueue`, `apiReview`, `approverQueue`, `apiApprove`, `apiPayment`, `paymentDetail`

### OperationsController
- **File**: `controllers\OperationsController.php`
- **Type**: php
- **Methods**: `today`, `getOverdueTasks`, `getTodayTasks`, `getPendingAudits`, `getPendingPayroll`, `getPendingReleases`, `getStoreHealthIssues`, `getPayrollVariances`, `getRecentAuditFails`, `getNewIncidents`, `getOverloadedManagers`, `getLateEmployees`, `getStoreOverdueCounts`, `enrichTasks`, `renderView`

### PayrollController
- **File**: `controllers\PayrollController.php`
- **Type**: php
- **Methods**: `requireAdmin`, `index`, `create`, `store`, `show`, `process`, `complete`, `markPaid`, `addAdjustment`, `cancel`, `apiStats`, `render`

### PenaltyController
- **File**: `controllers\PenaltyController.php`
- **Type**: php
- **Methods**: `adminIndex`, `adminAdd`, `adminUpdate`, `adminRemove`, `adminToggle`, `adminDetail`, `adminSummaryApi`, `mySummaryApi`

### ProjectController
- **File**: `controllers\ProjectController.php`
- **Type**: php
- **Methods**: `index`, `showMergeForm`, `applyMerge`, `adminDelete`, `bulkComplete`, `classifyByStore`, `create`, `store`, `show`, `filterTasks`, `sortTasks`, `groupTasks`, `edit`, `update`, `delete`, `archive`, `renameSection`, `addMember`, `removeMember`, `addSection`, `deleteSection`, `migrateAsanaProjects`, `bulkAssignStores`, `cleanupOverdueTasks`, `resolveStoreByName`

### ReleaseArtifactsController
- **File**: `controllers\ReleaseArtifactsController.php`
- **Type**: php
- **Methods**: `index`, `store`, `destroy`

### ReleaseController
- **File**: `controllers\ReleaseController.php`
- **Type**: php
- **Methods**: `index`, `show`, `create`, `update`, `transition`, `schedule`, `cancelSchedule`, `addReview`, `createLink`, `deactivateLink`, `publicReview`, `updateWalkthrough`, `updateScores`, `createFreeze`, `endFreeze`, `apiStats`, `processScheduled`, `ceoReview`

### ReviewerNotesController
- **File**: `controllers\ReviewerNotesController.php`
- **Type**: php
- **Methods**: `uid`, `canManageNote`, `loadTask`, `store`, `acknowledge`, `toggleChecklistItem`, `delete`, `requestChanges`, `requestInfo`, `parseChecklist`

### SearchController
- **File**: `controllers\SearchController.php`
- **Type**: php
- **Methods**: `index`, `apiSearch`, `search`

### ShiftController
- **File**: `controllers\ShiftController.php`
- **Type**: php
- **Methods**: `requireAdmin`, `index`, `store`, `update`, `delete`, `apiStats`

### StoreChecklistController
- **File**: `controllers\StoreChecklistController.php`
- **Type**: php
- **Methods**: `open`, `submitOpen`, `close`, `submitClose`, `history`, `renderView`

### StoreCommandController
- **File**: `controllers\StoreCommandController.php`
- **Type**: php
- **Methods**: `requireManager`, `index`, `show`, `apiHealthScore`, `apiStats`, `render`

### StoreController
- **File**: `controllers\StoreController.php`
- **Type**: php
- **Methods**: `index`, `create`, `update`, `show`, `delete`, `dataHygiene`, `mergeStores`

### TaskApprovalController
- **File**: `controllers\TaskApprovalController.php`
- **Type**: php
- **Methods**: `uid`, `requireLogin`, `csrf`, `loadTask`, `notifyUser`, `submit`, `reviewApprove`, `reviewReject`, `accept`, `acceptReject`, `reopenApproval`

### TaskCommentController
- **File**: `controllers\TaskCommentController.php`
- **Type**: php
- **Methods**: `store`, `delete`, `getJson`, `mentionSearch`

### TaskController
- **File**: `controllers\TaskController.php`
- **Type**: php
- **Methods**: `buildRepeatConfigFromPost`, `parseJsonListFromPost`, `parseChecklistFromPost`, `canAccessTask`, `show`, `getJson`, `store`, `update`, `delete`, `toggleComplete`, `accept`, `reschedule`, `duplicate`, `updateWatchers`, `move`, `reorder`, `upload`, `deleteAttachment`, `downloadAttachment`, `previewReassign`, `bulkReassign`

### TeamController
- **File**: `controllers\TeamController.php`
- **Type**: php
- **Methods**: `guard`, `buildMembers`, `buildKpiAndRecs`, `index`, `memberDetail`, `apiSummary`, `apiMembers`, `apiRebalancePlan`, `apiRebalanceApply`, `apiRebalanceStatus`, `apiDecisionProblems`, `apiDecisionCompare`, `apiMemberDetail`, `apiDecisionRank`, `apiDecisionNext`, `apiDecisionSimulate`, `apiAutonomyDecisions`, `apiAutonomyApprove`, `apiAutonomyReject`, `apiAutonomyExecute`, `apiAutonomyLog`, `apiAutonomySettings`

### TelegramConnectController
- **File**: `controllers\TelegramConnectController.php`
- **Type**: php
- **Methods**: `settingsPage`, `initConnect`, `disconnect`, `status`, `testSend`, `setWebhook`

### TelegramController
- **File**: `controllers\TelegramController.php`
- **Type**: php
- **Methods**: `handleWebhook`, `handleMessage`, `handleCallbackQuery`, `handleAccountLink`, `initLink`, `unlink`, `savePreferences`, `setupWebhook`, `routeToAi`, `processTaskCreation`, `confirmCreateTask`, `processQa`, `sendUserStatus`, `sendTodayTasks`, `helpText`, `intentPrompt`, `taskParsePrompt`, `qaSystemPrompt`

### TelegramWebhookController
- **File**: `controllers\TelegramWebhookController.php`
- **Type**: php
- **Methods**: `handle`, `isTelegramIp`, `ipInCidr`

### VendorController
- **File**: `controllers\VendorController.php`
- **Type**: php
- **Methods**: `index`, `create`, `update`, `delete`, `upload`, `deleteAttachment`, `downloadAttachment`

### VerificationController
- **File**: `controllers\VerificationController.php`
- **Type**: php
- **Methods**: `apiSummary`, `rulesScreen`, `apiAccountingSummary`, `teamHealthScore`, `topRisks`

### WalkthroughLibraryController
- **File**: `controllers\WalkthroughLibraryController.php`
- **Type**: php
- **Methods**: `requireAdmin`, `index`, `apiSummary`, `render`

### WarRoomController
- **File**: `controllers\WarRoomController.php`
- **Type**: php
- **Methods**: `index`, `create`, `view`, `addTimeline`, `addAction`, `resolve`, `updateStatus`, `getActiveSessions`, `getAllSessions`, `getSession`, `getCriticalData`, `addTimelineEvent`

### WorkflowExecutionApiController
- **File**: `controllers\WorkflowExecutionApiController.php`
- **Type**: php
- **Methods**: `myWork`, `reviewerQueue`, `approverQueue`, `commandCenter`, `myWorkList`, `reviewerQueueList`, `approverQueueList`, `requireAuth`, `bearerToken`, `count`, `tryCount`

