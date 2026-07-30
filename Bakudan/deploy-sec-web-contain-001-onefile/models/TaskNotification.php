<?php
/**
 * TaskNotification — In-app inbox + email notification dispatcher
 * for the Reviewer Workspace feature.
 *
 * Uses the task_notifications table (new, richer than legacy notifications).
 */
class TaskNotification {
    private $db;
    private bool $hasInboxCategory;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->hasInboxCategory = $this->db->tableExists('task_notifications')
            && $this->db->columnExists('task_notifications', 'inbox_category');
    }

    // ── Create ────────────────────────────────────────────────────────────────

    /**
     * Fire a notification (in-app) and optionally queue an email.
     */
    public function notify(array $data): int {
        if (!$this->db->tableExists('task_notifications')) return 0;
        $baseParams = [
            $data['user_id'],
            $data['task_id'] ?? null,
            $data['type'],
            $data['title'],
            $data['message'] ?? '',
            $data['from_user_id'] ?? null,
            $data['action_url'] ?? (!empty($data['task_id']) ? rtrim(APP_URL, '/') . '/tasks/' . $data['task_id'] : null),
            isset($data['metadata']) ? json_encode($data['metadata']) : null,
        ];
        if ($this->hasInboxCategory) {
            $sql    = "INSERT INTO task_notifications
                           (user_id, task_id, notification_type, title, message, from_user_id, action_url, metadata, inbox_category)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            $params = array_merge($baseParams, [$data['inbox_category'] ?? $this->inferCategory($data['type'])]);
        } else {
            $sql    = "INSERT INTO task_notifications
                           (user_id, task_id, notification_type, title, message, from_user_id, action_url, metadata)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            $params = $baseParams;
        }
        $id = (int)$this->db->insert($sql, $params);

        // Queue email if user has email_notifications enabled
        $this->queueEmail($data);

        return $id;
    }

    /**
     * Notify multiple users at once (e.g. task participants when a comment is added).
     */
    public function notifyMany(array $userIds, array $data): void {
        foreach (array_unique($userIds) as $uid) {
            if ((int)$uid === (int)($data['from_user_id'] ?? 0)) continue; // skip self
            $this->notify(array_merge($data, ['user_id' => (int)$uid]));
        }
    }

    /**
     * Notify all task participants (assignee, reviewer, approver, creator, watchers).
     * Excludes the acting user.
     */
    public function notifyTaskParticipants(int $taskId, int $fromUserId, array $data): void {
        $task = $this->db->fetch(
            "SELECT assignee_id, reviewer_id, approver_id, created_by FROM tasks WHERE id = ?",
            [$taskId]
        );
        if (!$task) return;

        $candidates = array_filter([
            (int)($task['assignee_id']  ?? 0),
            (int)($task['reviewer_id']  ?? 0),
            (int)($task['approver_id']  ?? 0),
            (int)($task['created_by']   ?? 0),
        ]);

        // Include watchers
        $watchers = $this->db->fetchAll(
            "SELECT user_id FROM task_watchers WHERE task_id = ?",
            [$taskId]
        );
        foreach ($watchers as $w) {
            $candidates[] = (int)$w['user_id'];
        }

        $this->notifyMany(array_unique($candidates), array_merge($data, [
            'task_id'      => $taskId,
            'from_user_id' => $fromUserId,
        ]));
    }

    // ── Mention notification ──────────────────────────────────────────────────

    public function notifyMentions(int $taskId, array $mentionedUserIds, int $fromUserId, string $context, string $excerpt): void {
        if (empty($mentionedUserIds)) return;

        $typeMap = [
            'task_comment'      => 'mentioned_in_comment',
            'reviewer_note'     => 'mentioned_in_reviewer_note',
            'approval_note'     => 'mentioned_in_approval_note',
        ];
        $type = $typeMap[$context] ?? 'mentioned_in_comment';

        $fromUser = $this->db->fetch("SELECT name FROM users WHERE id = ?", [$fromUserId]);
        $fromName = $fromUser['name'] ?? 'Someone';
        $task = $this->db->fetch("SELECT title FROM tasks WHERE id = ?", [$taskId]);
        $taskTitle = $task['title'] ?? 'a task';

        foreach ($mentionedUserIds as $uid) {
            $this->notify([
                'user_id'        => (int)$uid,
                'task_id'        => $taskId,
                'type'           => $type,
                'title'          => "{$fromName} mentioned you",
                'message'        => mb_substr($excerpt, 0, 200) . ' — ' . $taskTitle,
                'from_user_id'   => $fromUserId,
                'inbox_category' => 'mention',
                'metadata'       => ['context' => $context, 'excerpt' => mb_substr($excerpt, 0, 500)],
            ]);
        }
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    public function getInbox(int $userId, int $limit = 30, int $offset = 0, string $filter = 'all'): array {
        if (!$this->db->tableExists('task_notifications')) return [];
        $where = 'WHERE n.user_id = ?';
        $params = [$userId];

        if ($filter === 'unread') {
            $where .= ' AND n.is_read = 0';
        } elseif ($this->hasInboxCategory && $filter === 'mentions') {
            $where .= " AND n.inbox_category = 'mention'";
        } elseif ($this->hasInboxCategory && $filter === 'review') {
            $where .= " AND n.inbox_category = 'review'";
        } elseif ($this->hasInboxCategory && $filter === 'approval') {
            $where .= " AND n.inbox_category = 'approval'";
        }

        return $this->db->fetchAll(
            "SELECT n.*, u.name AS from_name, u.avatar AS from_avatar,
                    t.title AS task_title
             FROM task_notifications n
             LEFT JOIN users u ON n.from_user_id = u.id
             LEFT JOIN tasks t ON n.task_id = t.id
             {$where}
             ORDER BY n.created_at DESC
             LIMIT ? OFFSET ?",
            array_merge($params, [$limit, $offset])
        );
    }

    public function getUnreadCount(int $userId): int {
        if (!$this->db->tableExists('task_notifications')) return 0;
        $r = $this->db->fetch(
            "SELECT COUNT(*) AS c FROM task_notifications WHERE user_id = ? AND is_read = 0",
            [$userId]
        );
        return (int)($r['c'] ?? 0);
    }

    public function getCounts(int $userId): array {
        if (!$this->db->tableExists('task_notifications')) {
            return ['total'=>0,'unread'=>0,'mentions_unread'=>0,'review_unread'=>0,'approval_unread'=>0];
        }
        if ($this->hasInboxCategory) {
            $r = $this->db->fetch(
                "SELECT
                    COUNT(*) AS total,
                    SUM(is_read = 0) AS unread,
                    SUM(inbox_category = 'mention' AND is_read = 0) AS mentions_unread,
                    SUM(inbox_category = 'review' AND is_read = 0) AS review_unread,
                    SUM(inbox_category = 'approval' AND is_read = 0) AS approval_unread
                 FROM task_notifications WHERE user_id = ?",
                [$userId]
            );
        } else {
            $r = $this->db->fetch(
                "SELECT COUNT(*) AS total, SUM(is_read = 0) AS unread FROM task_notifications WHERE user_id = ?",
                [$userId]
            );
        }
        return [
            'total'           => (int)($r['total'] ?? 0),
            'unread'          => (int)($r['unread'] ?? 0),
            'mentions_unread' => (int)($r['mentions_unread'] ?? 0),
            'review_unread'   => (int)($r['review_unread'] ?? 0),
            'approval_unread' => (int)($r['approval_unread'] ?? 0),
        ];
    }

    public function markRead(int $id, int $userId): void {
        if (!$this->db->tableExists('task_notifications')) return;
        $this->db->update(
            "UPDATE task_notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?",
            [$id, $userId]
        );
    }

    public function markAllRead(int $userId): void {
        if (!$this->db->tableExists('task_notifications')) return;
        $this->db->update(
            "UPDATE task_notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0",
            [$userId]
        );
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function inferCategory(string $type): string {
        if (in_array($type, ['mentioned_in_comment','mentioned_in_reviewer_note','mentioned_in_approval_note'])) {
            return 'mention';
        }
        if (in_array($type, ['review_requested','review_approved','review_rejected','request_changes'])) {
            return 'review';
        }
        if (in_array($type, ['approval_requested','approval_approved','approval_rejected','task_completed_final'])) {
            return 'approval';
        }
        return 'task';
    }

    private function queueEmail(array $data): void {
        $userId = (int)($data['user_id'] ?? 0);
        if (!$userId) return;

        $user = $this->db->fetch(
            "SELECT name, email, email_notifications FROM users WHERE id = ? AND is_active = 1",
            [$userId]
        );
        if (!$user || empty($user['email_notifications']) || empty($user['email'])) return;

        $taskTitle  = '';
        $taskUrl    = '';
        if (!empty($data['task_id'])) {
            $task = $this->db->fetch("SELECT title FROM tasks WHERE id = ?", [$data['task_id']]);
            $taskTitle = $task['title'] ?? '';
            $taskUrl   = rtrim(APP_URL, '/') . '/tasks/' . $data['task_id'];
        }

        $fromUser = !empty($data['from_user_id'])
            ? $this->db->fetch("SELECT name FROM users WHERE id = ?", [$data['from_user_id']])
            : null;
        $fromName = $fromUser['name'] ?? 'System';

        $subject = APP_NAME . ' — ' . ($data['title'] ?? 'New notification');
        $body    = $this->buildEmailHtml($user, $data, $taskTitle, $taskUrl, $fromName);

        $this->db->insert(
            "INSERT INTO email_queue (to_email, to_name, subject, body) VALUES (?, ?, ?, ?)",
            [$user['email'], $user['name'], $subject, $body]
        );
    }

    private function buildEmailHtml(array $user, array $data, string $taskTitle, string $taskUrl, string $fromName): string {
        $name      = htmlspecialchars($user['name']);
        $title     = htmlspecialchars($data['title'] ?? '');
        $message   = htmlspecialchars($data['message'] ?? '');
        $taskHtml  = $taskTitle ? '<p style="font-size:13px;color:#a1a1aa;margin:4px 0 0">Task: <strong style="color:#e4e4e7">' . htmlspecialchars($taskTitle) . '</strong></p>' : '';
        $fromHtml  = '<p style="font-size:12px;color:#71717a;margin:4px 0 0">From: ' . htmlspecialchars($fromName) . '</p>';
        $btnHtml   = $taskUrl
            ? '<p style="margin:20px 0 0"><a href="' . htmlspecialchars($taskUrl) . '" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:600;font-size:14px">Open Task →</a></p>'
            : '';

        return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:520px;margin:30px auto;background:#18181b;border:1px solid #27272a;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:800">TaskFlow</h1>
    <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:12px">Reviewer Workspace Notification</p>
  </div>
  <div style="padding:24px 32px">
    <p style="font-size:15px;color:#e4e4e7;margin:0 0 8px">Hi <strong>{$name}</strong>,</p>
    <div style="background:#0a0a0b;border-left:4px solid #dc2626;padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0">
      <p style="font-size:15px;font-weight:600;color:#fca5a5;margin:0 0 4px">{$title}</p>
      <p style="font-size:13px;color:#a1a1aa;margin:0">{$message}</p>
      {$taskHtml}
      {$fromHtml}
    </div>
    {$btnHtml}
  </div>
  <div style="padding:16px 32px;background:#09090b;text-align:center;border-top:1px solid #27272a">
    <p style="font-size:11px;color:#52525b;margin:0">TaskFlow — You're receiving this because you're part of this task workflow.</p>
  </div>
</div>
</body></html>
HTML;
    }
}
