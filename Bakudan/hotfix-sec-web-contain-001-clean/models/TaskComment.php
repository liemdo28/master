<?php
/**
 * TaskComment — rich comment model with @mention parsing
 * Replaces the basic Comment model for the reviewer workspace.
 */
class TaskComment {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    public function getByTask(int $taskId): array {
        if (!$this->db->tableExists('task_comments')) return [];
        return $this->db->fetchAll(
            "SELECT tc.*,
                    u.name  AS user_name,
                    u.avatar AS user_avatar,
                    u.role   AS user_role
             FROM task_comments tc
             JOIN users u ON tc.user_id = u.id
             WHERE tc.task_id = ? AND tc.parent_id IS NULL
             ORDER BY tc.created_at ASC",
            [$taskId]
        );
    }

    public function getReplies(int $parentId): array {
        if (!$this->db->tableExists('task_comments')) return [];
        return $this->db->fetchAll(
            "SELECT tc.*,
                    u.name  AS user_name,
                    u.avatar AS user_avatar
             FROM task_comments tc
             JOIN users u ON tc.user_id = u.id
             WHERE tc.parent_id = ?
             ORDER BY tc.created_at ASC",
            [$parentId]
        );
    }

    public function findById(int $id): ?array {
        if (!$this->db->tableExists('task_comments')) return null;
        return $this->db->fetch("SELECT * FROM task_comments WHERE id = ?", [$id]) ?: null;
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /**
     * Create comment and extract @mentions.
     * Returns ['comment_id' => int, 'mentioned_ids' => int[]]
     */
    public function create(int $taskId, int $userId, string $content, string $type = 'comment', ?int $parentId = null): array {
        if (!$this->db->tableExists('task_comments')) {
            return ['comment_id' => 0, 'mentioned_ids' => []];
        }
        $id = $this->db->insert(
            "INSERT INTO task_comments (task_id, user_id, content, comment_type, parent_id)
             VALUES (?, ?, ?, ?, ?)",
            [$taskId, $userId, $content, $type, $parentId]
        );

        // Extract mentions from content
        $mentionedIds = $this->processMentions($taskId, (int)$id, $userId, $content, 'task_comment');

        return ['comment_id' => (int)$id, 'mentioned_ids' => $mentionedIds];
    }

    public function update(int $id, string $content): bool {
        if (!$this->db->tableExists('task_comments')) return false;
        return $this->db->update(
            "UPDATE task_comments SET content = ?, is_edited = 1, updated_at = NOW() WHERE id = ?",
            [$content, $id]
        ) > 0;
    }

    public function delete(int $id): bool {
        if (!$this->db->tableExists('task_comments')) return false;
        return $this->db->delete("DELETE FROM task_comments WHERE id = ?", [$id]) > 0;
    }

    // ── Mention parsing ───────────────────────────────────────────────────────

    /**
     * Parse @mentions in content and insert task_mentions rows.
     * Supports @username and @Full Name (matched against users table).
     * Returns array of mentioned user IDs.
     */
    public function processMentions(int $taskId, int $commentId, int $mentionedBy, string $content, string $context = 'task_comment'): array {
        // Match @word or @"Full Name" or @Full Name (greedy for multi-word)
        preg_match_all('/@([A-Za-z0-9_\.]+(?:\s+[A-Za-z0-9_\.]+)*)/', $content, $matches);
        if (empty($matches[1])) return [];

        $hasMentionsTable = $this->db->tableExists('task_mentions');

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
            if ($uid === $mentionedBy) continue; // don't notify yourself

            if ($hasMentionsTable) {
                // Prevent duplicate mention records per comment
                $exists = $this->db->fetch(
                    "SELECT id FROM task_mentions WHERE task_id=? AND comment_id=? AND mentioned_user_id=?",
                    [$taskId, $commentId, $uid]
                );
                if ($exists) continue;

                $this->db->insert(
                    "INSERT INTO task_mentions (task_id, comment_id, mentioned_user_id, mentioned_by, mention_context)
                     VALUES (?, ?, ?, ?, ?)",
                    [$taskId, $commentId, $uid, $mentionedBy, $context]
                );
            }
            $mentionedIds[] = $uid;
        }
        return $mentionedIds;
    }

    // ── Render @mentions as highlighted HTML ──────────────────────────────────

    public static function renderMentions(string $content): string {
        return preg_replace_callback(
            '/@([A-Za-z0-9_\.]+(?:\s+[A-Za-z0-9_\.]+)*)/',
            function ($m) {
                return '<span class="mention-chip">@' . htmlspecialchars($m[1], ENT_QUOTES, 'UTF-8') . '</span>';
            },
            htmlspecialchars($content, ENT_QUOTES, 'UTF-8')
        );
    }
}
