<?php
/**
 * ApprovalNote — Approver notes section on tasks
 */
class ApprovalNote {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function processMentions(int $taskId, int $noteId, int $mentionedBy, string $content, string $context = 'approval_note'): array {
        preg_match_all('/@([A-Za-z0-9_\.]+(?:\s+[A-Za-z0-9_\.]+)*)/', $content, $matches);
        if (empty($matches[1])) return [];

        $mentionedIds = [];
        foreach (array_unique($matches[1]) as $handle) {
            $handle = trim($handle);
            $user = $this->db->fetch(
                "SELECT id FROM users WHERE is_active = 1
                 AND (name = ? OR REPLACE(LOWER(name),' ','') = ? OR email = ?)
                 LIMIT 1",
                [$handle, strtolower(str_replace(' ', '', $handle)), $handle]
            );
            if (!$user) continue;
            $uid = (int)$user['id'];
            if ($uid === $mentionedBy) continue;

            if (!$this->db->tableExists('task_mentions')) { $mentionedIds[] = $uid; continue; }
            $exists = $this->db->fetch(
                "SELECT id FROM task_mentions WHERE task_id=? AND comment_id=? AND mentioned_user_id=? AND mention_context=?",
                [$taskId, $noteId, $uid, $context]
            );
            if ($exists) continue;

            $this->db->insert(
                "INSERT INTO task_mentions (task_id, comment_id, mentioned_user_id, mentioned_by, mention_context)
                 VALUES (?, ?, ?, ?, ?)",
                [$taskId, $noteId, $uid, $mentionedBy, $context]
            );
            $mentionedIds[] = $uid;
        }
        return $mentionedIds;
    }

    public static function renderMentions(string $content): string {
        return preg_replace_callback(
            '/@([A-Za-z0-9_\.]+(?:\s+[A-Za-z0-9_\.]+)*)/',
            function ($m) {
                return '<span class="mention-chip">@' . htmlspecialchars($m[1], ENT_QUOTES, 'UTF-8') . '</span>';
            },
            htmlspecialchars($content, ENT_QUOTES, 'UTF-8')
        );
    }

    public function getByTask(int $taskId): array {
        if (!$this->db->tableExists('task_approval_notes')) return [];
        return $this->db->fetchAll(
            "SELECT an.*, u.name AS approver_name, u.role AS approver_role, u.avatar AS approver_avatar
             FROM task_approval_notes an
             JOIN users u ON an.user_id = u.id
             WHERE an.task_id = ?
             ORDER BY an.created_at DESC",
            [$taskId]
        );
    }

    public function findById(int $id): ?array {
        if (!$this->db->tableExists('task_approval_notes')) return null;
        return $this->db->fetch("SELECT * FROM task_approval_notes WHERE id = ?", [$id]) ?: null;
    }

    public function create(int $taskId, int $userId, string $action, string $content, bool $isFinal = false): int {
        if (!$this->db->tableExists('task_approval_notes')) return 0;
        return (int)$this->db->insert(
            "INSERT INTO task_approval_notes (task_id, user_id, action, content, is_final)
             VALUES (?, ?, ?, ?, ?)",
            [$taskId, $userId, $action, $content, $isFinal ? 1 : 0]
        );
    }

    public function delete(int $id): bool {
        if (!$this->db->tableExists('task_approval_notes')) return false;
        return $this->db->delete("DELETE FROM task_approval_notes WHERE id = ?", [$id]) > 0;
    }

    /** Human-readable action label */
    public static function actionLabel(string $action): string {
        return match ($action) {
            'approved'           => '✅ Approved',
            'rejected'           => '❌ Rejected',
            'requested_changes'  => '🔁 Requested Changes',
            'info_requested'     => '❓ Information Requested',
            default              => ucfirst($action),
        };
    }

    public static function actionColor(string $action): string {
        return match ($action) {
            'approved'           => '#4ade80',
            'rejected'           => '#f87171',
            'requested_changes'  => '#fbbf24',
            'info_requested'     => '#60a5fa',
            default              => '#71717a',
        };
    }
}
