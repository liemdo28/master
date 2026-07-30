<?php
/**
 * EmailNotificationService — high-level email notification orchestrator.
 *
 * All sends are QUEUED via EmailQueueService (async).
 * The actual delivery is handled by ProcessEmailQueueJob (run via cron).
 *
 * Dedup flow:
 *   1. Check EmailLog::hasSentForEvent / hasSentToday  →  skip if already sent
 *   2. Check EmailQueue::hasEventKey                   →  skip if already queued
 *   3. EmailQueueService::enqueue()                    →  insert into email_queue
 */
class EmailNotificationService {
    private EmailQueueService  $queueService;
    private EmailTemplateService $templateService;
    private EmailLog           $emailLog;
    private $db;

    public function __construct() {
        $this->queueService    = new EmailQueueService();
        $this->templateService = new EmailTemplateService();
        $this->emailLog        = new EmailLog();
        $this->db              = Database::getInstance();
    }

    // ── sendTaskAssignedEmail ──────────────────────────────────────────────────

    /**
     * Queue a "task assigned" email to the assignee.
     * Idempotent: skips if already queued or sent for this task+assignee.
     *
     * @return bool  true if queued (or already sent), false on error
     */
    public function sendTaskAssignedEmail(int $taskId, int $assigneeId): bool {
        $eventKey = "task_assigned_{$taskId}_{$assigneeId}";

        // Idempotency — already sent
        if ($this->emailLog->hasSentForEvent($eventKey)) {
            return false;
        }

        // Fetch task with project + stores
        $task = $this->db->fetch(
            "SELECT t.*,
                    p.name AS project_name,
                    GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') AS store_names
             FROM tasks t
             LEFT JOIN projects p ON p.id = t.project_id
             LEFT JOIN task_stores ts ON ts.task_id = t.id
             LEFT JOIN stores s ON s.id = ts.store_id
             WHERE t.id = ?
             GROUP BY t.id",
            [$taskId]
        );

        if (!$task) {
            error_log('[EmailNotificationService] sendTaskAssignedEmail: task not found: ' . $taskId);
            return false;
        }

        // Assignee must be active, have email, and have notifications on
        $assignee = $this->db->fetch(
            "SELECT * FROM users
             WHERE id = ? AND is_active = 1 AND email != '' AND email_notifications = 1",
            [$assigneeId]
        );

        if (!$assignee) {
            return false;
        }

        $template = $this->templateService->renderTaskAssigned($task, $assignee);

        $queued = $this->queueService->enqueue(
            $assignee['email'],
            $assignee['name'],
            $template['subject'],
            $template['html'],
            'task_assigned',
            $assigneeId,
            $eventKey,
            ['task_id' => $taskId]
        );

        return $queued > 0;
    }

    // ── sendDueTodaySummary ────────────────────────────────────────────────────

    /**
     * Queue "due today" summary emails for all eligible users.
     * One email per user — skipped if already sent today.
     *
     * @return int  Number of emails queued
     */
    public function sendDueTodaySummary(): int {
        $today = function_exists('app_today') ? app_today() : date('Y-m-d');
        $queued = 0;

        $users = $this->db->fetchAll(
            "SELECT * FROM users
             WHERE is_active = 1 AND email != '' AND email_notifications = 1
             ORDER BY id ASC"
        );

        foreach ($users as $user) {
            $userId = (int)$user['id'];

            if ($this->emailLog->hasSentToday($userId, 'due_today')) {
                continue;
            }

            $tasks = $this->db->fetchAll(
                "SELECT t.*,
                        p.name AS project_name,
                        GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') AS store_names
                 FROM tasks t
                 LEFT JOIN projects p ON p.id = t.project_id
                 LEFT JOIN task_stores ts ON ts.task_id = t.id
                 LEFT JOIN stores s ON s.id = ts.store_id
                 WHERE t.assignee_id = ? AND t.due_date = ? AND t.is_completed = 0
                 GROUP BY t.id
                 ORDER BY FIELD(t.priority,'urgent','high','medium','low'), t.title ASC",
                [$userId, $today]
            );

            if (empty($tasks)) {
                continue;
            }

            $template = $this->templateService->renderDueTodaySummary($tasks, $user);

            $id = $this->queueService->enqueue(
                $user['email'],
                $user['name'],
                $template['subject'],
                $template['html'],
                'due_today',
                $userId,
                '',  // no event_key for daily summaries — dedup via hasSentToday
                ['task_count' => count($tasks), 'date' => $today]
            );

            if ($id > 0) {
                $queued++;
            }
        }

        return $queued;
    }

    // ── sendOverdueEscalation ──────────────────────────────────────────────────

    /**
     * Queue overdue escalation emails.
     *   - Assignees always notified (if eligible and not already sent today).
     *   - Managers notified if max days_overdue >= EMAIL_OVERDUE_L1_DAYS.
     *   - Admins    notified if max days_overdue >= EMAIL_OVERDUE_L2_DAYS.
     *
     * @return int  Total emails queued
     */
    public function sendOverdueEscalation(): int {
        $today  = function_exists('app_today') ? app_today() : date('Y-m-d');
        $queued = 0;

        $l1Days = defined('EMAIL_OVERDUE_L1_DAYS') ? (int)EMAIL_OVERDUE_L1_DAYS : 3;
        $l2Days = defined('EMAIL_OVERDUE_L2_DAYS') ? (int)EMAIL_OVERDUE_L2_DAYS : 7;

        // One query for all overdue tasks
        $overdueTasks = $this->db->fetchAll(
            "SELECT t.*,
                    u.name AS assignee_name,
                    u.email AS assignee_email,
                    u.is_active AS assignee_is_active,
                    u.email_notifications AS assignee_email_notifications,
                    p.name AS project_name,
                    GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') AS store_names,
                    DATEDIFF(?, t.due_date) AS days_overdue
             FROM tasks t
             LEFT JOIN users u ON u.id = t.assignee_id
             LEFT JOIN projects p ON p.id = t.project_id
             LEFT JOIN task_stores ts ON ts.task_id = t.id
             LEFT JOIN stores s ON s.id = ts.store_id
             WHERE t.due_date < ? AND t.is_completed = 0 AND t.assignee_id IS NOT NULL
             GROUP BY t.id
             ORDER BY t.assignee_id ASC, t.due_date ASC",
            [$today, $today]
        );

        if (empty($overdueTasks)) {
            return 0;
        }

        // Group by assignee in PHP
        $byAssignee = [];
        foreach ($overdueTasks as $task) {
            $aid = (int)$task['assignee_id'];
            if (!isset($byAssignee[$aid])) {
                $byAssignee[$aid] = [
                    'assignee_id'                  => $aid,
                    'assignee_name'                => $task['assignee_name'],
                    'assignee_email'               => $task['assignee_email'],
                    'assignee_is_active'           => (int)$task['assignee_is_active'],
                    'assignee_email_notifications' => (int)$task['assignee_email_notifications'],
                    'tasks'                        => [],
                ];
            }
            $byAssignee[$aid]['tasks'][] = $task;
        }

        // Load managers and admins once
        $managers = $this->db->fetchAll(
            "SELECT * FROM users
             WHERE role IN ('manager','admin') AND is_active = 1 AND email != ''
             ORDER BY id ASC"
        );
        $admins = $this->db->fetchAll(
            "SELECT * FROM users
             WHERE role = 'admin' AND is_active = 1 AND email != ''
             ORDER BY id ASC"
        );

        foreach ($byAssignee as $assigneeId => $group) {
            $tasks       = $group['tasks'];
            $maxDaysOver = (int)max(array_column($tasks, 'days_overdue'));

            $groupedForTemplate = [[
                'assignee_name' => $group['assignee_name'],
                'tasks'         => $tasks,
            ]];

            // 1. Notify the assignee
            if (
                $group['assignee_is_active'] &&
                !empty($group['assignee_email']) &&
                $group['assignee_email_notifications'] &&
                !$this->emailLog->hasSentToday($assigneeId, 'overdue')
            ) {
                $recipient = ['name' => $group['assignee_name'], 'email' => $group['assignee_email']];
                $tpl = $this->templateService->renderOverdueEscalation($groupedForTemplate, $recipient, 'user');
                $id  = $this->queueService->enqueue(
                    $group['assignee_email'],
                    $group['assignee_name'],
                    $tpl['subject'],
                    $tpl['html'],
                    'overdue',
                    $assigneeId,
                    '',
                    ['assignee_id' => $assigneeId, 'task_count' => count($tasks), 'max_days_overdue' => $maxDaysOver]
                );
                if ($id > 0) $queued++;
            }

            // 2. Notify managers (L1: >= 3 days)
            if ($maxDaysOver >= $l1Days) {
                foreach ($managers as $manager) {
                    $managerId = (int)$manager['id'];
                    if ($this->emailLog->hasSentToday($managerId, 'overdue')) continue;

                    $tpl = $this->templateService->renderOverdueEscalation($groupedForTemplate, $manager, 'manager');
                    $id  = $this->queueService->enqueue(
                        $manager['email'],
                        $manager['name'],
                        $tpl['subject'],
                        $tpl['html'],
                        'overdue',
                        $managerId,
                        '',
                        ['for_assignee_id' => $assigneeId, 'task_count' => count($tasks), 'max_days_overdue' => $maxDaysOver]
                    );
                    if ($id > 0) $queued++;
                }
            }

            // 3. Notify admins (L2: >= 7 days)
            if ($maxDaysOver >= $l2Days) {
                foreach ($admins as $admin) {
                    $adminId = (int)$admin['id'];
                    if ($this->emailLog->hasSentToday($adminId, 'overdue')) continue;

                    $tpl = $this->templateService->renderOverdueEscalation($groupedForTemplate, $admin, 'admin');
                    $id  = $this->queueService->enqueue(
                        $admin['email'],
                        $admin['name'],
                        $tpl['subject'],
                        $tpl['html'],
                        'overdue',
                        $adminId,
                        '',
                        ['for_assignee_id' => $assigneeId, 'task_count' => count($tasks), 'max_days_overdue' => $maxDaysOver]
                    );
                    if ($id > 0) $queued++;
                }
            }
        }

        return $queued;
    }
}
