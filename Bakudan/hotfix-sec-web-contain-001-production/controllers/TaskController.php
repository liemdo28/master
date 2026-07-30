<?php
class TaskController {
    private $taskModel;

    /** Allowed upload extensions and their MIME types */
    private const ALLOWED_EXT = ['jpg','jpeg','png','gif','webp','pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','zip','mp4','mov'];
    private const ALLOWED_MIME = [
        'image/jpeg','image/png','image/gif','image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain','text/csv',
        'application/zip','application/x-zip-compressed',
        'video/mp4','video/quicktime',
    ];

    public function __construct() { $this->taskModel = new Task(); }

    private function buildRepeatConfigFromPost(array $post): ?string {
        $repeatType = $post['repeat_type'] ?? 'none';
        if (!$repeatType || $repeatType === 'none') {
            return null;
        }

        $cfg = [];
        if ($repeatType === 'daily') {
            $cfg['interval'] = max(1, (int)($post['repeat_interval_daily'] ?? $post['repeat_interval'] ?? 1));
        } elseif ($repeatType === 'weekly') {
            $cfg['interval'] = max(1, (int)($post['repeat_interval_weekly'] ?? $post['repeat_interval'] ?? 1));
            $days = $post['repeat_days'] ?? [];
            if (is_string($days)) {
                $days = $days !== '' ? explode(',', $days) : [];
            }
            $cfg['days'] = array_values(array_filter(array_map('intval', (array)$days), fn($d) => $d >= 1 && $d <= 7));
        } elseif ($repeatType === 'monthly') {
            $cfg['interval'] = max(1, (int)($post['repeat_interval_monthly'] ?? $post['repeat_months'] ?? 1));
            $cfg['by'] = $post['repeat_by'] ?? 'day_of_month';
            $cfg['day_of_month'] = max(1, min(31, (int)($post['repeat_day_of_month'] ?? date('j'))));
        } elseif ($repeatType === 'yearly') {
            $cfg['interval'] = max(1, (int)($post['repeat_interval_yearly'] ?? $post['repeat_interval'] ?? 1));
        }

        return json_encode($cfg, JSON_UNESCAPED_UNICODE);
    }

    private function parseJsonListFromPost($value): ?string {
        if (is_array($value)) {
            $items = array_values(array_filter(array_map(fn($v) => trim((string)$v), $value), fn($v) => $v !== ''));
            return empty($items) ? null : json_encode($items, JSON_UNESCAPED_UNICODE);
        }
        $raw = trim((string)$value);
        if ($raw === '') return null;
        $lines = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $raw)), fn($v) => $v !== ''));
        return empty($lines) ? null : json_encode($lines, JSON_UNESCAPED_UNICODE);
    }

    private function parseChecklistFromPost($value): ?string {
        $raw = trim((string)$value);
        if ($raw === '') return null;
        $lines = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $raw)), fn($v) => $v !== ''));
        if (empty($lines)) return null;
        $items = array_map(fn($line) => ['text' => $line, 'done' => false], $lines);
        return json_encode($items, JSON_UNESCAPED_UNICODE);
    }

    private function canAccessTask($task): bool {
        if (!$task) return false;
        if (canAdmin()) return true;
        $uid = $_SESSION['user_id'];
        // Direct ownership or watching
        if (($task['assignee_id'] == $uid)
            || ($task['created_by'] == $uid)
            || $this->taskModel->isWatcher($task['id'], $uid)) {
            return true;
        }
        // Manager: can access any task in projects they are a member of
        if (isManager() && !empty($task['project_id'])) {
            return (new Project())->isMember($task['project_id'], $uid);
        }
        return false;
    }

    public function show($id) {
        $task = $this->taskModel->findById($id);
        if (!$task || !is_array($task)) {
            flash('error', 'Task not found.');
            redirect('dashboard');
            return;
        }

        if (!$this->canAccessTask($task)) {
            flash('error', t('task.no_permission_view'));
            redirect('dashboard');
        }

        $canEditTask    = $this->taskModel->canEdit($id, (int)$_SESSION['user_id']);
        $comments       = (new Comment())->getByTask($id);
        $attachments    = $this->taskModel->getAttachments($id);
        $users          = (new User())->getActive();
        $sections       = (new Project())->getSections($task['project_id']);
        $projectMembers = (new Project())->getMembers($task['project_id'] ?? 0);

        // commentTypeIcons: used by tab-comments partial
        $commentTypeIcons = [
            'comment'     => '💬',
            'instruction' => '📋',
            'question'    => '❓',
            'checklist'   => '✅',
            'note'        => '📝',
        ];

        // ── CEO Update: Reviewer Workspace data ──────────────────────────────────────
        // Rich task comments (with @mentions)
        if (class_exists('TaskComment')) {
            $taskCommentModel = new TaskComment();
            $taskComments = $taskCommentModel->getByTask((int)$id);
            // Load replies for each comment
            foreach ($taskComments as &$c) {
                $c['replies'] = $taskCommentModel->getReplies((int)$c['id']);
                $c['content_html'] = TaskComment::renderMentions($c['content']);
            }
            unset($c);
        } else {
            $taskComments = [];
        }

        // Reviewer notes
        if (class_exists('ReviewerNote')) {
            $reviewerNoteModel = new ReviewerNote();
            $reviewerNotes = $reviewerNoteModel->getByTask((int)$id);
            $pendingCount = $reviewerNoteModel->countPending((int)$id);
        } else {
            $reviewerNotes = [];
            $pendingCount = 0;
        }

        // Can reviewer add notes? (reviewer or approver or admin)
        $currentUid = (int)($_SESSION['user_id'] ?? 0);
        $canAddReviewerNote = canAdmin()
            || $currentUid === (int)($task['reviewer_id'] ?? 0)
            || $currentUid === (int)($task['approver_id'] ?? 0);

        // Can user acknowledge reviewer notes? (assignee or admin)
        $canAcknowledgeNote = canAdmin()
            || $currentUid === (int)($task['assignee_id'] ?? 0);

        // Approval notes
        if (class_exists('ApprovalNote')) {
            $approvalNotes = (new ApprovalNote())->getByTask((int)$id);
        } else {
            $approvalNotes = [];
        }

        // Can user add approval notes? (reviewer or approver or admin)
        $canAddApprovalNote = canAdmin()
            || $currentUid === (int)($task['reviewer_id'] ?? 0)
            || $currentUid === (int)($task['approver_id'] ?? 0);

        // Load store relations (many-to-many)
        $taskStoreService = new TaskStoreService();
        $taskStores  = $taskStoreService->getForTask((int)$id);   // [{id, name, color}]
        $taskStoreIds = array_column($taskStores, 'id');
        $allStores   = (new Store())->allActive();

        // Deadline extension usage + history
        $extModel         = new DeadlineExtension();
        $extensionUsage   = $extModel->getMonthlyUsage((int)$_SESSION['user_id']);
        $extensionHistory = $extModel->getForTask($id);

        // Approval workflow history — only load if column + table both exist
        $approvalHistory = [];
        if (!empty($task['approval_required']) && Database::getInstance()->tableExists('task_approval_events')) {
            $approvalHistory = $this->taskModel->getApprovalHistory((int)$id);
        }

        require __DIR__ . '/../views/tasks/detail.php';
    }

    public function getJson($id) {
        $task = $this->taskModel->findById($id);
        if (!$task) json_response(['error' => 'Not found'], 404);
        if (!$this->canAccessTask($task)) json_response(['error' => 'Forbidden'], 403);
        json_response(['task' => $task, 'comments' => (new Comment())->getByTask($id), 'attachments' => $this->taskModel->getAttachments($id)]);
    }

    public function store() {
        if (!verify_csrf($_POST['csrf'] ?? '')) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Invalid security token.'], 403);
            flash('error', 'Invalid security token.'); redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard');
        }
        $title = trim($_POST['title'] ?? '');
        if (empty($title)) { flash('error', t('task.title_required')); redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard'); }

        $assigneeId = $_POST['assignee_id'] ?: null;
        $projectId = (int)($_POST['project_id'] ?? 0);
        $sectionModel = new Section();
        $safeSectionId = $sectionModel->normalizeSectionId($_POST['section_id'] ?? null, $projectId);

        // Build repeat config (supports both create modal and task detail edit field names)
        $repeatType = $_POST['repeat_type'] ?? 'none';
        $repeatConfig = $this->buildRepeatConfigFromPost($_POST);

        $taskPayload = [
            'project_id' => $projectId,
            'section_id' => $safeSectionId,
            'title' => $title,
            'description' => $_POST['description'] ?? '',
            'assignee_id' => $assigneeId,
            'priority' => $_POST['priority'] ?? 'medium',
            'status' => $_POST['status'] ?? 'todo',
            'due_date' => $_POST['due_date'] ?: null,
            'start_date' => $_POST['start_date'] ?: null,
            'visibility' => $_POST['visibility'] ?? 'private',
            'private_by_user_id' => $_SESSION['user_id'],
            'created_by' => $_SESSION['user_id'],
            'repeat_type' => $repeatType,
            'repeat_config' => $repeatConfig,
            'repeat_from_mode' => $_POST['repeat_from_mode'] ?? 'due_date',
            'repeat_end_type' => $_POST['repeat_end_type'] ?? 'never',
            'repeat_end_date' => !empty($_POST['repeat_end_date']) ? $_POST['repeat_end_date'] : null,
            'repeat_end_count' => !empty($_POST['repeat_end_count']) ? (int)$_POST['repeat_end_count'] : null,
        ];

        // Creator-defined reviewer/approver workspace spec (if schema exists)
        $db = Database::getInstance();
        if ($db->columnExists('tasks', 'review_instructions')) {
            $taskPayload['review_instructions'] = trim((string)($_POST['review_instructions'] ?? '')) ?: null;
        }
        if ($db->columnExists('tasks', 'review_checklist')) {
            $taskPayload['review_checklist'] = $this->parseChecklistFromPost($_POST['review_checklist'] ?? '');
        }
        if ($db->columnExists('tasks', 'reviewer_due_date')) {
            $taskPayload['reviewer_due_date'] = !empty($_POST['reviewer_due_date']) ? $_POST['reviewer_due_date'] : null;
        }
        if ($db->columnExists('tasks', 'required_evidence')) {
            $taskPayload['required_evidence'] = $this->parseJsonListFromPost($_POST['required_evidence'] ?? '');
        }
        if ($db->columnExists('tasks', 'required_files')) {
            $taskPayload['required_files'] = $this->parseJsonListFromPost($_POST['required_files'] ?? '');
        }
        if ($db->columnExists('tasks', 'approver_instructions')) {
            $taskPayload['approver_instructions'] = trim((string)($_POST['approver_instructions'] ?? '')) ?: null;
        }

        // Split into separate tasks when multiple stores are selected
        $rawStoreIds = isset($_POST['store_ids']) ? array_values(array_filter(array_map('intval', (array)$_POST['store_ids']), fn($s) => $s > 0)) : [];
        $taskCategories = $this->parseTaskCategoriesFromPost();
        $createdIds = [];
        $taskStoreService = new TaskStoreService();

        if (count($rawStoreIds) > 1) {
            // Create one task per store
            foreach ($rawStoreIds as $storeId) {
                $storePayload = $taskPayload; // shallow copy — all fields same
                $tid = $this->taskModel->create($storePayload);
                $createdIds[] = $tid;
                try {
                    $taskStoreService->sync((int)$tid, [$storeId], (int)$_SESSION['user_id']);
                } catch (\Throwable $e) { /* non-fatal */ }
                $this->taskModel->syncCategories((int)$tid, $taskCategories);

                // Notify assignee for each task
                if ($assigneeId && $assigneeId != $_SESSION['user_id']) {
                    $proj = (new Project())->findById($projectId);
                    notifyUser([
                        'user_id' => $assigneeId,
                        'type' => 'task_assigned',
                        'title' => t('notif.task_assigned'),
                        'message' => $title . ' — ' . ($proj['name'] ?? ''),
                        'task_id' => $tid,
                        'project_id' => $projectId,
                        'from_user_id' => $_SESSION['user_id'],
                    ]);
                    $this->insertTaskAssignedNotification((int)$tid, (int)$assigneeId, $title, $storePayload);
                }
                if (!empty($assigneeId)) {
                    try {
                        (new EmailNotificationService())->sendTaskAssignedEmail($tid, (int)$assigneeId);
                    } catch (\Throwable $e) {
                        error_log('[Email] Task assigned email failed: ' . $e->getMessage());
                    }
                }
                if (canAdmin()) {
                    $approvalMode = $_POST['approval_mode'] ?? 'none';
                    $this->taskModel->update($tid, [
                        'approval_required' => ($approvalMode !== 'none') ? 1 : 0,
                        'reviewer_id'  => ($approvalMode !== 'none' && !empty($_POST['reviewer_id']))  ? (int)$_POST['reviewer_id']  : null,
                        'approver_id'  => ($approvalMode === 'review_acceptance' && !empty($_POST['approver_id'])) ? (int)$_POST['approver_id'] : null,
                        'reviewer_due_date' => !empty($_POST['reviewer_due_date']) ? $_POST['reviewer_due_date'] : null,
                    ]);
                    (new TaskReviewService($this->taskModel))->syncForTask((int)$tid, (int)$_SESSION['user_id']);
                }
            }
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['success' => true, 'task_ids' => $createdIds, 'split' => true]);
            flash('success', count($createdIds) . ' ' . t('task.create_success'));
            redirect($_SERVER['HTTP_REFERER'] ?? 'projects/' . $projectId);
        }

        // Single store (or no store) — original behaviour: one task
        $id = $this->taskModel->create($taskPayload);

        // Notify assignee
        if ($assigneeId && $assigneeId != $_SESSION['user_id']) {
            $proj = (new Project())->findById($projectId);
            notifyUser([
                'user_id' => $assigneeId,
                'type' => 'task_assigned',
                'title' => t('notif.task_assigned'),
                'message' => $title . ' — ' . ($proj['name'] ?? ''),
                'task_id' => $id,
                'project_id' => $projectId,
                'from_user_id' => $_SESSION['user_id'],
            ]);
            $this->insertTaskAssignedNotification((int)$id, (int)$assigneeId, $title, $taskPayload);
        }

        if (!empty($assigneeId)) {
            try {
                (new EmailNotificationService())->sendTaskAssignedEmail($id, (int)$assigneeId);
            } catch (\Throwable $e) {
                error_log('[Email] Task assigned email failed: ' . $e->getMessage());
            }
        }

        if ($id) {
            try {
                $taskStoreService->sync((int)$id, $rawStoreIds, (int)$_SESSION['user_id']);
            } catch (\Throwable $e) { /* non-fatal */ }
            $this->taskModel->syncCategories((int)$id, $taskCategories);
        }

        if ($id && canAdmin()) {
            $approvalMode = $_POST['approval_mode'] ?? 'none';
            $this->taskModel->update($id, [
                'approval_required' => ($approvalMode !== 'none') ? 1 : 0,
                'reviewer_id'  => ($approvalMode !== 'none' && !empty($_POST['reviewer_id']))  ? (int)$_POST['reviewer_id']  : null,
                'approver_id'  => ($approvalMode === 'review_acceptance' && !empty($_POST['approver_id'])) ? (int)$_POST['approver_id'] : null,
                'reviewer_due_date' => !empty($_POST['reviewer_due_date']) ? $_POST['reviewer_due_date'] : null,
            ]);
            (new TaskReviewService($this->taskModel))->syncForTask((int)$id, (int)$_SESSION['user_id']);
        }

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['success' => true, 'task_id' => $id, 'split' => false]);
        flash('success', t('task.create_success'));
        redirect($_SERVER['HTTP_REFERER'] ?? 'projects/' . $projectId);
    }

    public function update($id) {
        if (!verify_csrf($_POST['csrf'] ?? '')) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Invalid security token.'], 403);
            flash('error', 'Invalid security token.'); redirect('tasks/' . $id);
        }
        $task = $this->taskModel->findById($id);
        if (!$task) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Not found'], 404);
            flash('error', t('task.not_found')); redirect('dashboard');
        }
        if (!$this->canAccessTask($task)) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Forbidden'], 403);
            flash('error', t('task.no_permission_edit'));
            redirect('tasks/' . $id);
        }
        $oldAssigneeId = $task['assignee_id'] ?? null;
        $data = [];
        foreach (['title','description','assignee_id','priority','status','visibility','due_date','start_date','section_id','repeat_type','repeat_config'] as $f) {
            if (isset($_POST[$f])) $data[$f] = $_POST[$f];
        }
        $db = Database::getInstance();
        $taskCategories = $this->parseTaskCategoriesFromPost();
        if ($db->columnExists('tasks', 'review_instructions')) {
            $data['review_instructions'] = trim((string)($_POST['review_instructions'] ?? '')) ?: null;
        }
        if ($db->columnExists('tasks', 'review_checklist')) {
            $data['review_checklist'] = $this->parseChecklistFromPost($_POST['review_checklist'] ?? '');
        }
        if ($db->columnExists('tasks', 'reviewer_due_date')) {
            $data['reviewer_due_date'] = !empty($_POST['reviewer_due_date']) ? $_POST['reviewer_due_date'] : null;
        }
        if ($db->columnExists('tasks', 'required_evidence')) {
            $data['required_evidence'] = $this->parseJsonListFromPost($_POST['required_evidence'] ?? '');
        }
        if ($db->columnExists('tasks', 'required_files')) {
            $data['required_files'] = $this->parseJsonListFromPost($_POST['required_files'] ?? '');
        }
        if ($db->columnExists('tasks', 'approver_instructions')) {
            $data['approver_instructions'] = trim((string)($_POST['approver_instructions'] ?? '')) ?: null;
        }
        if (array_key_exists('section_id', $data)) {
            $sectionModel = new Section();
            $data['section_id'] = $sectionModel->normalizeSectionId($data['section_id'], (int)($task['project_id'] ?? 0));
        }
        // Rebuild repeat_config when repeat_type is present (handles modal vs detail form field names)
        if (isset($_POST['repeat_type']) && $_POST['repeat_type'] !== '') {
            $data['repeat_config'] = $this->buildRepeatConfigFromPost($_POST);
        }
        // Approval workflow fields (admin/CEO only)
        if (canAdmin()) {
            $data['approval_required'] = isset($_POST['approval_required']) ? 1 : 0;
            $data['reviewer_id']  = !empty($_POST['reviewer_id'])  ? (int)$_POST['reviewer_id']  : null;
            $data['approver_id']  = !empty($_POST['approver_id'])  ? (int)$_POST['approver_id']  : null;
        }
        // Support new recurrence fields
        foreach (['repeat_from_mode','repeat_end_type','repeat_end_date','repeat_end_count'] as $f) {
            if (isset($_POST[$f]) && $_POST[$f] !== '') $data[$f] = $_POST[$f];
        }
        if (isset($data['visibility']) && $data['visibility'] === 'private') {
            $data['private_by_user_id'] = $_SESSION['user_id'];
        }
        if (isset($_POST['is_completed'])) {
            $data['is_completed'] = $_POST['is_completed'] ? 1 : 0;
            $data['status'] = $_POST['is_completed'] ? 'done' : 'todo';
        }

        $newAssigneeId = isset($data['assignee_id']) && $data['assignee_id'] !== '' ? (int)$data['assignee_id'] : null;

        // Notify on reassignment
        if (isset($data['assignee_id']) && $data['assignee_id'] != ($task['assignee_id'] ?? '') && $data['assignee_id'] && $data['assignee_id'] != $_SESSION['user_id']) {
            notifyUser([
                'user_id' => $data['assignee_id'],
                'type' => 'task_assigned',
                'title' => t('notif.task_assigned'),
                'message' => ($data['title'] ?? $task['title']),
                'task_id' => $id,
                'project_id' => $task['project_id'],
                'from_user_id' => $_SESSION['user_id'],
            ]);
        }

        $this->taskModel->update($id, $data);
        if (array_key_exists('task_categories', $_POST) || array_key_exists('task_category', $_POST)) {
            $this->taskModel->syncCategories((int)$id, $taskCategories);
        }
        if (array_key_exists('reviewer_id', $data) || array_key_exists('reviewer_due_date', $data) || array_key_exists('review_instructions', $data)) {
            (new TaskReviewService($this->taskModel))->syncForTask((int)$id, (int)$_SESSION['user_id']);
        }

        // Send task assigned email if assignee changed
        if (!empty($newAssigneeId) && (int)$newAssigneeId !== (int)$oldAssigneeId) {
            try {
                (new EmailNotificationService())->sendTaskAssignedEmail((int)$id, (int)$newAssigneeId);
            } catch (\Throwable $e) {
                error_log('[Email] Task assigned email failed: ' . $e->getMessage());
            }
        }

        // Sync store relations (many-to-many); store_ids[] must be present in POST even if empty
        if (array_key_exists('store_ids', $_POST)) {
            try {
                $rawStoreIds = (array)$_POST['store_ids'];
                (new TaskStoreService())->sync((int)$id, $rawStoreIds, (int)$_SESSION['user_id']);
            } catch (\Throwable $e) { /* non-fatal */ }
        }

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['success' => true]);
        flash('success', t('task.update_success'));
        redirect('tasks/' . $id);
    }

    public function delete($id) {
        $task = $this->taskModel->findById($id);
        if (!$task) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Not found'], 404);
            flash('error', t('task.not_found')); redirect('dashboard');
        }
        // Delete requires admin/CEO, or the original task creator — managers cannot delete others' tasks
        $canDelete = canAdmin() || ($task['created_by'] == $_SESSION['user_id']);
        if (!$canDelete) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Forbidden'], 403);
            flash('error', t('task.no_permission_delete'));
            redirect('tasks/' . $id);
        }
        $this->taskModel->delete($id);
        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['success' => true]);
        flash('success', t('task.delete_success'));
        redirect('projects/' . ($task['project_id'] ?? ''));
    }

    public function toggleComplete($id) {
        $task = $this->taskModel->findById($id);
        if (!$this->canAccessTask($task)) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Forbidden'], 403);
            flash('error', t('task.no_permission_status'));
            redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard');
        }

        // CONSOLIDATED: All completion goes through TaskCompletionService
        // This ensures recurrence generation is always handled consistently.
        $service = new TaskCompletionService($this->taskModel);
        $result = $service->complete((int)$id, (int)$_SESSION['user_id']);

        // Notify creator when assignee completes task (only on completion, not reopen)
        if ($result['completed'] && $task && $task['created_by'] != $_SESSION['user_id']) {
            notifyUser([
                'user_id' => $task['created_by'],
                'type' => 'task_completed',
                'title' => t('task.completed_notification'),
                'message' => $task['title'],
                'task_id' => $id,
                'project_id' => $task['project_id'],
                'from_user_id' => $_SESSION['user_id'],
            ]);
        }

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['success' => true, 'result' => $result]);
        redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard');
    }

    public function accept($id) {
        $task = $this->taskModel->findById($id);
        if (!$task || (!canManage() && $task['assignee_id'] != $_SESSION['user_id'])) {
            flash('error', t('task.no_permission_accept'));
            redirect('new-tasks');
        }

        // Update due_date if provided
        if (!empty($_POST['due_date'])) {
            $this->taskModel->update($id, ['due_date' => $_POST['due_date']]);
        }

        // Check required fields
        $task = $this->taskModel->findById($id);
        if (empty($task['due_date'])) {
            flash('error', t('task.due_date_required'));
            redirect('tasks/' . $id);
        }

        $this->taskModel->acceptAssignedTask($id);

        // Notify watchers
        $user = currentUser();
        $notif = new Notification();
        $notif->notifyWatchers($id, $_SESSION['user_id'], 'task_assigned',
            t('task.accepted_notification', ['name' => $user['name']]),
            $task['title'],
            $_SESSION['user_id']
        );

        flash('success', t('task.accept_success', ['title' => $task['title']]));
        redirect('new-tasks');
    }

    public function reschedule($id) {
        $task = $this->taskModel->findById($id);
        if (!$task) { flash('error', t('task.not_found')); redirect('dashboard'); }
        if (!$this->canAccessTask($task)) {
            flash('error', t('task.no_permission_reschedule'));
            redirect('dashboard');
        }

        $newDueDate = $_POST['new_due_date'] ?? '';
        if (empty($newDueDate)) { flash('error', t('task.reschedule_date_required')); redirect('tasks/' . $id); }

        $newId = $this->taskModel->reschedule($id, $newDueDate);
        if ($newId) {
            $newTask = $this->taskModel->findById($newId);
            $user = currentUser();
            $notif = new Notification();
            $notif->notifyWatchers($id, $_SESSION['user_id'], 'task_assigned',
                t('task.rescheduled_notification', ['name' => $user['name']]),
                $task['title'] . ' → ' . date('d/m/Y', strtotime($newDueDate)),
                $_SESSION['user_id']
            );
            flash('success', t('task.reschedule_success', ['title' => $newTask['title']]));
            redirect('tasks/' . $newId);
        }
        flash('error', t('task.reschedule_failed'));
        redirect('tasks/' . $id);
    }

    public function duplicate($id) {
        $task = $this->taskModel->findById($id);
        if (!$this->canAccessTask($task)) {
            flash('error', t('task.no_permission_duplicate'));
            redirect('dashboard');
        }
        $newId = $this->taskModel->duplicate($id, $_SESSION['user_id']);
        if ($newId) {
            flash('success', t('task.duplicate_success'));
            redirect('tasks/' . $newId);
        }
        flash('error', t('task.duplicate_failed'));
        redirect('tasks/' . $id);
    }

    public function updateWatchers($id) {
        $task = $this->taskModel->findById($id);
        if (!$task) json_response(['error' => 'Not found'], 404);
        if (!$this->canAccessTask($task)) json_response(['error' => 'Forbidden'], 403);

        $watcherIds = $_POST['watcher_ids'] ?? [];
        if (is_string($watcherIds)) $watcherIds = array_filter(explode(',', $watcherIds));

        // Get current watchers
        $current = array_column($this->taskModel->getWatchers($id), 'id');

        // Add new watchers
        foreach ($watcherIds as $uid) {
            if (!in_array($uid, $current)) {
                $this->taskModel->addWatcher($id, $uid);
            }
        }

        // Remove unchecked watchers (but keep assignee and creator)
        foreach ($current as $uid) {
            if (!in_array($uid, $watcherIds) && $uid != $task['assignee_id'] && $uid != $task['created_by']) {
                $this->taskModel->removeWatcher($id, $uid);
            }
        }

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['success' => true]);
        redirect('tasks/' . $id);
    }

    public function move($id) {
        $task = $this->taskModel->findById($id);
        if (!$this->canAccessTask($task)) json_response(['error' => 'Forbidden'], 403);
        $input = json_decode(file_get_contents('php://input'), true);
        $this->taskModel->move($id, $input['section_id'] ?? $_POST['section_id'] ?? null, $input['position'] ?? $_POST['position'] ?? 0);
        json_response(['success' => true]);
    }

    public function reorder() {
        $input = json_decode(file_get_contents('php://input'), true);
        $tasks = $input['tasks'] ?? [];
        $allowed = [];
        foreach ($tasks as $t) {
            $task = $this->taskModel->findById($t['id'] ?? 0);
            if ($this->canAccessTask($task)) {
                $allowed[] = $t;
            }
        }
        $this->taskModel->reorder($allowed);
        json_response(['success' => true]);
    }

    public function upload($taskId) {
        $task = $this->taskModel->findById($taskId);
        if (!$this->canAccessTask($task)) json_response(['error' => 'Forbidden'], 403);

        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            json_response(['error' => t('upload.failed')], 400);
        }

        $file = $_FILES['file'];

        // Size check
        if ($file['size'] > MAX_UPLOAD_SIZE) {
            json_response(['error' => t('upload.too_large', ['limit' => '10MB'])], 400);
        }

        // Extension whitelist
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, self::ALLOWED_EXT)) {
            json_response(['error' => t('upload.type_not_allowed')], 400);
        }

        // Real MIME type check via finfo
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
        if (!in_array($mime, self::ALLOWED_MIME)) {
            json_response(['error' => t('upload.type_not_allowed')], 400);
        }

        // Sanitize original filename for storage
        $safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
        $safeName = substr($safeName, 0, 80);

        if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0755, true);
        $filename = uniqid() . '_' . time() . '_' . $safeName . '.' . $ext;

        if (move_uploaded_file($file['tmp_name'], UPLOAD_DIR . $filename)) {
            $id = $this->taskModel->addAttachment([
                'task_id' => $taskId,
                'user_id' => $_SESSION['user_id'],
                'filename' => $filename,
                'original_name' => $file['name'],
                'file_size' => $file['size'],
                'mime_type' => $mime, // use detected MIME, not client-supplied
            ]);
            json_response(['success' => true, 'id' => $id, 'filename' => $file['name']]);
        }
        json_response(['error' => t('upload.failed')], 500);
    }

    public function deleteAttachment($id) {
        $att = $this->taskModel->findAttachment($id);
        if (!$att) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Not found'], 404);
            redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard');
        }
        $task = $this->taskModel->findById($att['task_id']);
        if (!$this->canAccessTask($task)) {
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['error' => 'Forbidden'], 403);
            flash('error', t('task.no_permission_attachment'));
            redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard');
        }
        $this->taskModel->deleteAttachment($id);
        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) json_response(['success' => true]);
        redirect($_SERVER['HTTP_REFERER'] ?? 'dashboard');
    }

    public function downloadAttachment($id) {
        $att = $this->taskModel->findAttachment($id);
        if (!$att) redirect('dashboard');
        $task = $this->taskModel->findById($att['task_id']);
        if (!$this->canAccessTask($task)) {
            flash('error', t('task.no_permission_download'));
            redirect('dashboard');
        }
        $fp = UPLOAD_DIR . $att['filename'];
        if (!file_exists($fp)) redirect('dashboard');
        header('Content-Type: ' . ($att['mime_type'] ?? 'application/octet-stream'));
        header('Content-Disposition: attachment; filename="' . addslashes($att['original_name']) . '"');
        header('Content-Length: ' . filesize($fp));
        readfile($fp);
        exit;
    }

    /**
     * POST /api/tasks/reassign/preview
     * Simulate reassignment — reads DB but makes NO changes.
     * Returns impact stats + warnings. Admin / Manager only.
     */
    public function previewReassign() {
        header('Content-Type: application/json');
        $fromId  = (int)($_POST['from_user_id'] ?? 0);
        $toId    = (int)($_POST['to_user_id']   ?? 0);
        $taskIds = $_POST['task_ids'] ?? [];

        if (!$fromId || !$toId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Missing user IDs']);
            exit;
        }
        if ($fromId === $toId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Source and destination are the same user']);
            exit;
        }

        $db = Database::getInstance();

        $fromUser = $db->fetch("SELECT id, name FROM users WHERE id = ? AND is_active = 1", [$fromId]);
        $toUser   = $db->fetch("SELECT id, name FROM users WHERE id = ? AND is_active = 1", [$toId]);
        if (!$fromUser || !$toUser) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'User not found']);
            exit;
        }

        // Determine the tasks that WOULD be moved
        if (!empty($taskIds)) {
            $taskIds = array_map('intval', $taskIds);
            $placeholders = implode(',', array_fill(0, count($taskIds), '?'));
            $params = array_merge([$fromId], $taskIds);
            $movingTasks = $db->fetchAll(
                "SELECT t.id, t.title, t.priority, t.due_date, t.is_completed,
                        p.name AS project_name, s.name AS store_name
                 FROM tasks t
                 LEFT JOIN projects p ON p.id = t.project_id
                 LEFT JOIN stores s ON s.id = p.store_id
                 WHERE t.assignee_id = ? AND t.is_completed = 0 AND t.id IN ($placeholders)",
                $params
            );
        } else {
            $movingTasks = $db->fetchAll(
                "SELECT t.id, t.title, t.priority, t.due_date, t.is_completed,
                        p.name AS project_name, s.name AS store_name
                 FROM tasks t
                 LEFT JOIN projects p ON p.id = t.project_id
                 LEFT JOIN stores s ON s.id = p.store_id
                 WHERE t.assignee_id = ? AND t.is_completed = 0",
                [$fromId]
            );
        }

        $movingCount  = count($movingTasks);
        $urgentCount  = count(array_filter($movingTasks, fn($t) => in_array($t['priority'], ['urgent','high'])));
        $overdueCount = count(array_filter($movingTasks, fn($t) => !empty($t['due_date']) && $t['due_date'] < date('Y-m-d')));

        // Current open-task counts
        $fromCurrent = (int)($db->fetch("SELECT COUNT(*) AS cnt FROM tasks WHERE assignee_id=? AND is_completed=0", [$fromId])['cnt'] ?? 0);
        $toCurrent   = (int)($db->fetch("SELECT COUNT(*) AS cnt FROM tasks WHERE assignee_id=? AND is_completed=0", [$toId])['cnt'] ?? 0);

        $fromAfter = $fromCurrent - $movingCount;
        $toAfter   = $toCurrent + $movingCount;

        $warnings = [];
        if ($toAfter > 20) $warnings[] = "{$toUser['name']} will be overloaded ({$toAfter} open tasks)";
        if ($urgentCount > 0) $warnings[] = "{$urgentCount} urgent/high-priority tasks included";
        if ($overdueCount > 0) $warnings[] = "{$overdueCount} already-overdue tasks will transfer";

        echo json_encode([
            'success'            => true,
            'moving_count'       => $movingCount,
            'urgent_count'       => $urgentCount,
            'overdue_count'      => $overdueCount,
            'from_user'          => ['id'=>$fromId,'name'=>$fromUser['name'],'before'=>$fromCurrent,'after'=>$fromAfter],
            'to_user'            => ['id'=>$toId,  'name'=>$toUser['name'],  'before'=>$toCurrent,  'after'=>$toAfter],
            'warnings'           => $warnings,
            'tasks'              => array_map(fn($t) => [
                'id'           => (int)$t['id'],
                'title'        => $t['title'],
                'priority'     => $t['priority'],
                'due_date'     => $t['due_date'],
                'project_name' => $t['project_name'],
                'store_name'   => $t['store_name'],
            ], $movingTasks),
        ]);
        exit;
    }

    /**
     * POST /api/tasks/reassign
     * Body: from_user_id, to_user_id, task_ids[] (optional — if omitted, move ALL open tasks)
     * Admin / Manager only (enforced in index.php route)
     */
    public function bulkReassign() {
        header('Content-Type: application/json');
        $fromId  = (int)($_POST['from_user_id'] ?? 0);
        $toId    = (int)($_POST['to_user_id']   ?? 0);
        $taskIds = $_POST['task_ids'] ?? [];   // optional array of specific task IDs

        if (!$fromId || !$toId || $fromId === $toId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid user IDs']);
            exit;
        }

        $db = Database::getInstance();

        // Verify both users exist
        $fromUser = $db->fetch("SELECT id, name FROM users WHERE id = ? AND is_active = 1", [$fromId]);
        $toUser   = $db->fetch("SELECT id, name FROM users WHERE id = ? AND is_active = 1", [$toId]);
        if (!$fromUser || !$toUser) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'User not found']);
            exit;
        }

        if (!empty($taskIds)) {
            // Reassign specific tasks only
            $taskIds = array_map('intval', $taskIds);
            $placeholders = implode(',', array_fill(0, count($taskIds), '?'));
            $params = array_merge([$toId, $fromId], $taskIds);
            $moved = $db->execute(
                "UPDATE tasks SET assignee_id = ? WHERE assignee_id = ? AND id IN ($placeholders) AND is_completed = 0",
                $params
            );
        } else {
            // Reassign ALL open tasks from → to
            $moved = $db->execute(
                "UPDATE tasks SET assignee_id = ? WHERE assignee_id = ? AND is_completed = 0",
                [$toId, $fromId]
            );
        }

        // Return updated open-task counts for both users
        $fromCount = $db->fetch("SELECT COUNT(*) AS cnt FROM tasks WHERE assignee_id = ? AND is_completed = 0", [$fromId]);
        $toCount   = $db->fetch("SELECT COUNT(*) AS cnt FROM tasks WHERE assignee_id = ? AND is_completed = 0", [$toId]);

        echo json_encode([
            'success'    => true,
            'moved'      => $moved,
            'from_user'  => ['id' => $fromId,  'name' => $fromUser['name'], 'open_tasks' => (int)$fromCount['cnt']],
            'to_user'    => ['id' => $toId,    'name' => $toUser['name'],   'open_tasks' => (int)$toCount['cnt']],
        ]);
        exit;
    }

    // ── Task duplicate check API ──────────────────────────────────────────────

    /**
     * POST /api/tasks/check-duplicate
     */
    public function apiCheckDuplicate() {
        if (!isLoggedIn()) { json_response(['error' => 'Unauthorized'], 401); return; }

        $data = [
            'title'       => trim($_POST['title'] ?? ''),
            'store_id'    => (int)($_POST['store_id'] ?? 0),
            'due_date'    => $_POST['due_date'] ?? '',
            'assignee_id' => (int)($_POST['assignee_id'] ?? 0),
            'category'    => trim($_POST['category'] ?? ''),
        ];

        $existing = DuplicateDetector::checkTaskDuplicate($data);
        if (!$existing) {
            json_response(['duplicate' => false, 'match' => null, 'score' => 0]);
            return;
        }

        $score = DuplicateDetector::scoreMatch($existing, $data);

        json_response([
            'duplicate' => $score >= 70,
            'score'     => $score,
            'match'     => [
                'id'       => (int)$existing['id'],
                'title'    => $existing['title'],
                'store'    => $existing['store_name'] ?? null,
                'due_date' => substr($existing['due_date'] ?? '', 0, 10),
                'status'   => $existing['status'],
                'assignee' => $existing['assignee_name'] ?? null,
            ],
        ]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Insert a task_notifications row for popup display on assignment.
     */
    private function insertTaskAssignedNotification(int $taskId, int $assigneeId, string $taskTitle, array $taskPayload): void
    {
        $db = Database::getInstance();
        if (!$db->tableExists('task_notifications')) return;

        $assignedByUser = $db->fetch("SELECT name FROM users WHERE id = ?", [(int)$_SESSION['user_id']]);
        $assignedByName = $assignedByUser['name'] ?? 'System';

        // Get store name via project
        $storeName = null;
        if (!empty($taskPayload['project_id'])) {
            $proj = $db->fetch(
                "SELECT s.name FROM projects p LEFT JOIN stores s ON s.id = p.store_id WHERE p.id = ?",
                [(int)$taskPayload['project_id']]
            );
            $storeName = $proj['name'] ?? null;
        }

        $metadata = json_encode([
            'store'       => $storeName,
            'due_date'    => $taskPayload['due_date'] ?? null,
            'priority'    => $taskPayload['priority'] ?? 'medium',
            'assigned_by' => $assignedByName,
        ]);

        // Check which columns exist
        $hasInboxCat  = $db->columnExists('task_notifications', 'inbox_category');
        $hasFromUser  = $db->columnExists('task_notifications', 'from_user_id');
        $hasMetadata  = $db->columnExists('task_notifications', 'metadata');
        $hasType      = $db->columnExists('task_notifications', 'notification_type');

        // Build insert dynamically
        $cols   = ['user_id', 'task_id', 'title', 'message'];
        $values = [(int)$assigneeId, $taskId, 'New Task Assigned', "{$assignedByName} assigned you: {$taskTitle}"];

        if ($hasType)     { $cols[] = 'notification_type'; $values[] = 'task_assigned'; }
        if ($hasInboxCat) { $cols[] = 'inbox_category';    $values[] = 'task'; }
        if ($hasFromUser) { $cols[] = 'from_user_id';      $values[] = (int)$_SESSION['user_id']; }
        if ($hasMetadata) { $cols[] = 'metadata';          $values[] = $metadata; }

        $placeholders = implode(', ', array_fill(0, count($cols), '?'));
        $colList      = implode(', ', $cols);

        try {
            $db->execute(
                "INSERT INTO task_notifications ({$colList}) VALUES ({$placeholders})",
                $values
            );

            // Mark assignment_notified_at if column exists
            if ($db->columnExists('tasks', 'assignment_notified_at')) {
                $db->execute("UPDATE tasks SET assignment_notified_at = NOW() WHERE id = ?", [$taskId]);
            }
        } catch (\Throwable $e) {
            error_log('[TaskController] insertTaskAssignedNotification failed: ' . $e->getMessage());
        }
    }

    private function parseTaskCategoriesFromPost(): array
    {
        $raw = $_POST['task_categories'] ?? ($_POST['task_category'] ?? []);
        if (!is_array($raw)) {
            $raw = [$raw];
        }
        $allowed = $this->taskModel->allowedCategories();
        $clean = [];
        foreach ($raw as $category) {
            $category = strtolower(trim((string)$category));
            if ($category !== '' && in_array($category, $allowed, true)) {
                $clean[$category] = $category;
            }
        }
        return array_values($clean);
    }
}
