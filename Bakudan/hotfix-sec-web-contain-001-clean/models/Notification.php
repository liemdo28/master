<?php
class Notification {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function create($data) {
        $id = $this->db->insert(
            "INSERT INTO notifications (user_id, type, title, message, task_id, project_id, from_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                $data['user_id'],
                $data['type'],
                $data['title'],
                $data['message'] ?? '',
                $data['task_id'] ?? null,
                $data['project_id'] ?? null,
                $data['from_user_id'] ?? null,
            ]
        );

        // Also queue email if user has email_notifications enabled
        $this->queueEmailNotification($data);

        // F3: Push to Telegram if user is linked and preference allows it
        $this->triggerTelegramNotification($data);

        return $id;
    }

    private function triggerTelegramNotification(array $data): void {
        if (!class_exists('TelegramBot')) return;
        try {
            $notifType = match ($data['type'] ?? '') {
                'task_assigned'     => 'assign',
                'mention'           => 'mention',
                'task_updated',
                'task_commented'    => 'task_update',
                'task_due_soon',
                'task_overdue'      => 'deadline',
                default             => null,
            };
            if ($notifType === null) return;

            (new TelegramBot())->triggerNotification(
                (int)$data['user_id'],
                $notifType,
                $data['title']   ?? '',
                $data['message'] ?? '',
                !empty($data['task_id']) ? (int)$data['task_id'] : null
            );
        } catch (\Throwable $e) {
            // Never let Telegram errors break the notification pipeline
            error_log('Notification::triggerTelegramNotification failed: ' . $e->getMessage());
        }
    }

    private function queueEmailNotification($data) {
        $user = $this->db->fetch("SELECT name, email, email_notifications FROM users WHERE id = ?", [$data['user_id']]);
        if (!$user || !$user['email_notifications']) return;

        $subject = APP_NAME . ' - ' . $data['title'];
        $body = $this->buildEmailBody($data, $user);

        $this->db->insert(
            "INSERT INTO email_queue (to_email, to_name, subject, body) VALUES (?, ?, ?, ?)",
            [$user['email'], $user['name'], $subject, $body]
        );
    }

    private function buildEmailBody($data, $user) {
        $name    = htmlspecialchars($user['name']);
        $title   = htmlspecialchars($data['title']);
        $message = htmlspecialchars(isset($data['message']) ? $data['message'] : '');
        $hello   = t('email.hello');
        $footer  = t('email.footer');
        $taskButton = '';
        if (!empty($data['task_id'])) {
            $taskUrl    = APP_URL . '/tasks/' . $data['task_id'];
            $viewLabel  = htmlspecialchars(t('email.view_task'));
            $taskButton = '<p style="margin:20px 0 0"><a href="'.$taskUrl.'" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:600;font-size:14px">'.$viewLabel.' →</a></p>';
        }

        return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:520px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 32px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;letter-spacing:-.3px">TaskFlow</h1>
  </div>
  <div style="padding:28px 32px">
    <p style="font-size:15px;color:#333;margin:0 0 8px">{$hello} <strong>{$name}</strong>,</p>
    <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0">
      <p style="font-size:15px;font-weight:600;color:#991b1b;margin:0 0 4px">{$title}</p>
      <p style="font-size:13px;color:#666;margin:0">{$message}</p>
    </div>
    {$taskButton}
  </div>
  <div style="padding:16px 32px;background:#f9fafb;text-align:center">
    <p style="font-size:11px;color:#9ca3af;margin:0">{$footer}</p>
  </div>
</div>
</body></html>
HTML;
    }

    public function getByUser($userId, $limit = 30, $offset = 0) {
        return $this->db->fetchAll(
            "SELECT n.*, u.name as from_user_name
             FROM notifications n
             LEFT JOIN users u ON n.from_user_id = u.id
             WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT ? OFFSET ?",
            [$userId, $limit, $offset]
        );
    }

    public function countByUser($userId) {
        $r = $this->db->fetch(
            "SELECT COUNT(*) as c FROM notifications WHERE user_id = ?",
            [$userId]
        );
        return (int)($r['c'] ?? 0);
    }

    public function getUnreadCount($userId) {
        $r = $this->db->fetch(
            "SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0",
            [$userId]
        );
        return $r['c'] ?? 0;
    }

    /**
     * Counts shaped like TaskNotification::getCounts() so InboxController can merge them.
     * Legacy notifications have no review/approval concept — only total/unread/mentions.
     */
    public function getCounts(int $userId): array {
        $r = $this->db->fetch(
            "SELECT COUNT(*) AS total, SUM(is_read = 0) AS unread,
                    SUM(type = 'mention' AND is_read = 0) AS mentions_unread
             FROM notifications WHERE user_id = ?",
            [$userId]
        );
        return [
            'total'           => (int)($r['total'] ?? 0),
            'unread'          => (int)($r['unread'] ?? 0),
            'mentions_unread' => (int)($r['mentions_unread'] ?? 0),
        ];
    }

    /**
     * Rows for the merged Inbox page, normalized to the same shape as
     * TaskNotification::getInbox() (see InboxController::mergedInbox()).
     */
    public function getByUserFiltered(int $userId, string $filter = 'all', int $limit = 200): array {
        $where  = 'WHERE n.user_id = ?';
        $params = [$userId];

        if ($filter === 'unread') {
            $where .= ' AND n.is_read = 0';
        } elseif ($filter === 'mentions') {
            $where .= " AND n.type = 'mention'";
        } elseif ($filter === 'review' || $filter === 'approval') {
            // Legacy notifications table has no review/approval concept
            return [];
        }

        return $this->db->fetchAll(
            "SELECT n.*, u.name as from_user_name
             FROM notifications n
             LEFT JOIN users u ON n.from_user_id = u.id
             {$where}
             ORDER BY n.created_at DESC
             LIMIT ?",
            array_merge($params, [$limit])
        );
    }

    public function markRead($id, $userId) {
        $this->db->update(
            "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
            [$id, $userId]
        );
    }

    public function markAllRead($userId) {
        $this->db->update(
            "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
            [$userId]
        );
    }

    // Called by cron: notify users about tasks due tomorrow
    public function checkDueSoon() {
        $tasks = $this->db->fetchAll(
            "SELECT t.id, t.title, t.assignee_id, t.project_id, p.name as project_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.due_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
             AND t.is_completed = 0 AND t.assignee_id IS NOT NULL"
        );
        foreach ($tasks as $t) {
            // Check if we already notified today
            $existing = $this->db->fetch(
                "SELECT id FROM notifications WHERE task_id = ? AND user_id = ? AND type = 'task_due_soon' AND DATE(created_at) = CURDATE()",
                [$t['id'], $t['assignee_id']]
            );
            if (!$existing) {
                $this->create([
                    'user_id' => $t['assignee_id'],
                    'type' => 'task_due_soon',
                    'title' => t('notif.task_due_soon'),
                    'message' => $t['title'] . ' - ' . ($t['project_name'] ?? ''),
                    'task_id' => $t['id'],
                    'project_id' => $t['project_id'],
                ]);
            }
        }
    }

    // Called by cron: notify users about overdue tasks (escalation)
    public function checkOverdue() {
        $tasks = $this->db->fetchAll(
            "SELECT t.id, t.title, t.assignee_id, t.project_id, p.name as project_name,
                    DATEDIFF(CURDATE(), t.due_date) as days_overdue
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.due_date < CURDATE()
             AND t.is_completed = 0 AND t.assignee_id IS NOT NULL"
        );
        foreach ($tasks as $t) {
            $daysOverdue = (int)$t['days_overdue'];

            // Always notify assignee (daily)
            $existing = $this->db->fetch(
                "SELECT id FROM notifications WHERE task_id = ? AND user_id = ? AND type = 'task_overdue' AND DATE(created_at) = CURDATE()",
                [$t['id'], $t['assignee_id']]
            );
            if (!$existing) {
                $urgency = $daysOverdue >= 3 ? ' (CRITICAL - ' . $daysOverdue . ' days!)' : '';
                $this->create([
                    'user_id' => $t['assignee_id'],
                    'type' => 'task_overdue',
                    'title' => t('notif.task_overdue') . $urgency,
                    'message' => $t['title'] . ' - ' . ($t['project_name'] ?? ''),
                    'task_id' => $t['id'],
                    'project_id' => $t['project_id'],
                ]);
            }

            // Overdue > 3 days: notify ALL watchers
            if ($daysOverdue >= 3 && $this->db->tableExists('task_watchers')) {
                $watchers = $this->db->fetchAll(
                    "SELECT tw.user_id FROM task_watchers tw WHERE tw.task_id = ? AND tw.user_id != ?",
                    [$t['id'], $t['assignee_id']]
                );
                foreach ($watchers as $w) {
                    $wExisting = $this->db->fetch(
                        "SELECT id FROM notifications WHERE task_id = ? AND user_id = ? AND type = 'task_overdue' AND DATE(created_at) = CURDATE()",
                        [$t['id'], $w['user_id']]
                    );
                    if (!$wExisting) {
                        $this->create([
                            'user_id' => $w['user_id'],
                            'type' => 'task_overdue',
                            'title' => t('notif.task_overdue_critical', ['days' => $daysOverdue]),
                            'message' => $t['title'] . ' - ' . ($t['project_name'] ?? ''),
                            'task_id' => $t['id'],
                            'project_id' => $t['project_id'],
                        ]);
                    }
                }
            }
        }
    }

    // Notify all watchers of a task
    public function notifyWatchers($taskId, $excludeUserId, $type, $title, $message, $fromUserId = null) {
        if (!$this->db->tableExists('task_watchers')) return;
        $task = $this->db->fetch("SELECT project_id FROM tasks WHERE id = ?", [$taskId]);
        $watchers = $this->db->fetchAll(
            "SELECT tw.user_id FROM task_watchers tw WHERE tw.task_id = ? AND tw.user_id != ?",
            [$taskId, $excludeUserId]
        );
        foreach ($watchers as $w) {
            $this->create([
                'user_id' => $w['user_id'],
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'task_id' => $taskId,
                'project_id' => $task['project_id'] ?? null,
                'from_user_id' => $fromUserId,
            ]);
        }
    }

    // Called by cron: weekly summary email (Sundays only)
    public function sendWeeklyReports() {
        if ((int)date('w') !== 0) return; // Only on Sundays

        // Ensure column exists
        if (!$this->db->columnExists('users', 'last_weekly_report_at')) return;

        $users = $this->db->fetchAll(
            "SELECT id, name, email FROM users
             WHERE is_active = 1 AND email_notifications = 1
             AND (last_weekly_report_at IS NULL OR DATE(last_weekly_report_at) < CURDATE())"
        );

        $weekStart = date('Y-m-d', strtotime('next Monday'));
        $weekEnd = date('Y-m-d', strtotime('next Sunday'));

        foreach ($users as $user) {
            $userId = $user['id'];

            // Tasks due next week (user is assignee, project member, or project owner)
            $dueThisWeek = $this->db->fetchAll(
                "SELECT DISTINCT t.id, t.title, t.due_date, t.priority, t.status, p.name as project_name
                 FROM tasks t
                 LEFT JOIN projects p ON t.project_id = p.id
                 LEFT JOIN project_members pm ON p.id = pm.project_id
                 WHERE t.is_completed = 0
                 AND t.due_date BETWEEN ? AND ?
                 AND (t.assignee_id = ? OR pm.user_id = ? OR p.owner_id = ?)
                 ORDER BY t.due_date ASC",
                [$weekStart, $weekEnd, $userId, $userId, $userId]
            );

            // Overdue tasks
            $overdueTasks = $this->db->fetchAll(
                "SELECT DISTINCT t.id, t.title, t.due_date, t.priority, p.name as project_name
                 FROM tasks t
                 LEFT JOIN projects p ON t.project_id = p.id
                 LEFT JOIN project_members pm ON p.id = pm.project_id
                 WHERE t.is_completed = 0 AND t.due_date < CURDATE()
                 AND (t.assignee_id = ? OR pm.user_id = ? OR p.owner_id = ?)
                 ORDER BY t.due_date ASC",
                [$userId, $userId, $userId]
            );

            // New tasks assigned this past week
            $newTasks = $this->db->fetchAll(
                "SELECT t.id, t.title, t.due_date, t.priority, p.name as project_name
                 FROM tasks t
                 LEFT JOIN projects p ON t.project_id = p.id
                 WHERE t.assignee_id = ? AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                 ORDER BY t.created_at DESC",
                [$userId]
            );

            // Skip if nothing to report
            if (empty($dueThisWeek) && empty($overdueTasks) && empty($newTasks)) {
                $this->db->update("UPDATE users SET last_weekly_report_at = NOW() WHERE id = ?", [$userId]);
                continue;
            }

            $subject = APP_NAME . ' - Weekly Task Summary';
            $body = $this->buildWeeklySummaryEmail($user, $dueThisWeek, $overdueTasks, $newTasks, $weekStart, $weekEnd);

            $this->db->insert(
                "INSERT INTO email_queue (to_email, to_name, subject, body) VALUES (?, ?, ?, ?)",
                [$user['email'], $user['name'], $subject, $body]
            );

            $this->db->update("UPDATE users SET last_weekly_report_at = NOW() WHERE id = ?", [$userId]);
        }
    }

    private function buildWeeklySummaryEmail($user, $dueThisWeek, $overdueTasks, $newTasks, $weekStart, $weekEnd) {
        $name = htmlspecialchars($user['name']);
        $weekLabel = date('d/m', strtotime($weekStart)) . ' - ' . date('d/m', strtotime($weekEnd));

        $taskRows = function($tasks, $showDue = true) {
            if (empty($tasks)) return '<p style="color:#9ca3af;font-size:13px;margin:8px 0">No tasks</p>';
            $html = '<table style="width:100%;border-collapse:collapse;font-size:13px">';
            foreach ($tasks as $t) {
                $title = htmlspecialchars($t['title']);
                $project = htmlspecialchars($t['project_name'] ?? '');
                $due = $showDue && !empty($t['due_date']) ? date('d/m', strtotime($t['due_date'])) : '';
                $url = APP_URL . '/tasks/' . $t['id'];
                $priColor = ['urgent'=>'#dc2626','high'=>'#f59e0b','medium'=>'#3b82f6','low'=>'#71717a'][$t['priority']] ?? '#71717a';
                $html .= '<tr style="border-bottom:1px solid #f3f4f6">';
                $html .= '<td style="padding:8px 4px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'.$priColor.'"></span></td>';
                $html .= '<td style="padding:8px 4px"><a href="'.$url.'" style="color:#111;text-decoration:none;font-weight:500">'.$title.'</a>';
                if ($project) $html .= '<br><span style="color:#9ca3af;font-size:11px">'.$project.'</span>';
                $html .= '</td>';
                if ($due) $html .= '<td style="padding:8px 4px;text-align:right;color:#6b7280;white-space:nowrap">'.$due.'</td>';
                $html .= '</tr>';
            }
            $html .= '</table>';
            return $html;
        };

        $sections = '';

        if (!empty($overdueTasks)) {
            $sections .= '<div style="margin-bottom:20px">';
            $sections .= '<h3 style="font-size:14px;color:#dc2626;margin:0 0 8px">⚠️ Overdue Tasks (' . count($overdueTasks) . ')</h3>';
            $sections .= $taskRows($overdueTasks);
            $sections .= '</div>';
        }

        if (!empty($dueThisWeek)) {
            $sections .= '<div style="margin-bottom:20px">';
            $sections .= '<h3 style="font-size:14px;color:#2563eb;margin:0 0 8px">📅 Due This Week (' . count($dueThisWeek) . ')</h3>';
            $sections .= $taskRows($dueThisWeek);
            $sections .= '</div>';
        }

        if (!empty($newTasks)) {
            $sections .= '<div style="margin-bottom:20px">';
            $sections .= '<h3 style="font-size:14px;color:#16a34a;margin:0 0 8px">🆕 Newly Assigned (' . count($newTasks) . ')</h3>';
            $sections .= $taskRows($newTasks, false);
            $sections .= '</div>';
        }

        return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 32px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">TaskFlow</h1>
    <p style="color:rgba(255,255,255,.8);margin:8px 0 0;font-size:13px">Weekly Task Summary</p>
  </div>
  <div style="padding:28px 32px">
    <p style="font-size:15px;color:#333;margin:0 0 4px">Hi <strong>{$name}</strong>,</p>
    <p style="font-size:13px;color:#6b7280;margin:0 0 20px">Here's your week ahead: <strong>{$weekLabel}</strong></p>
    {$sections}
    <p style="margin:24px 0 0;text-align:center">
      <a href="{APP_URL}/dashboard" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:10px 28px;border-radius:8px;font-weight:600;font-size:14px">Open Dashboard →</a>
    </p>
  </div>
  <div style="padding:16px 32px;background:#f9fafb;text-align:center">
    <p style="font-size:11px;color:#9ca3af;margin:0">You receive this email because email notifications are enabled on TaskFlow.</p>
  </div>
</div>
</body></html>
HTML;
    }

    // Process email queue (called by cron)
    public static function processEmailQueue($limit = 20) {
        $db = Database::getInstance();
        $emails = $db->fetchAll(
            "SELECT * FROM email_queue WHERE status = 'pending' AND attempts < 3 ORDER BY created_at ASC LIMIT ?",
            [$limit]
        );

        foreach ($emails as $email) {
            $headers = "MIME-Version: 1.0\r\n";
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
            $headers .= "From: " . APP_NAME . " <noreply@" . parse_url(APP_URL, PHP_URL_HOST) . ">\r\n";

            $sent = @mail($email['to_email'], $email['subject'], $email['body'], $headers);

            if ($sent) {
                $db->update("UPDATE email_queue SET status = 'sent', sent_at = NOW() WHERE id = ?", [$email['id']]);
            } else {
                $db->update(
                    "UPDATE email_queue SET attempts = attempts + 1, last_error = ?, status = IF(attempts >= 2, 'failed', 'pending') WHERE id = ?",
                    [error_get_last()['message'] ?? 'Unknown error', $email['id']]
                );
            }
        }
    }
}
