<?php
/**
 * TelegramConversationService — conversation context + task reassignment.
 *
 * Responsibilities:
 *   - Save / retrieve last-referenced task per chat (TTL = 15 min)
 *   - Resolve a user name to a dashboard user (with ambiguity handling)
 *   - Reassign a task with permission validation
 *   - Find a task by title hint (for explicit references)
 */
class TelegramConversationService {
    private TelegramContext $ctx;
    private $db;

    /** Context TTL in minutes */
    private const CTX_TTL = 15;

    public function __construct() {
        $this->ctx = new TelegramContext();
        $this->db  = Database::getInstance();
    }

    // ── Context management ─────────────────────────────────────────────────────

    /**
     * Persist the last created / referenced task for a chat.
     */
    public function saveTaskContext(string $chatId, int $taskId, string $title): void {
        $this->ctx->save($chatId, $taskId, $title);
    }

    /**
     * Retrieve the last task for a chat, respecting the TTL.
     *
     * @return array|null  Task row (id, title) or null if expired / missing
     */
    public function getTaskContext(string $chatId): ?array {
        $row = $this->ctx->get($chatId);
        if (!$row || !$row['last_task_id']) return null;

        // TTL check
        $updatedAt  = strtotime($row['updated_at']);
        $ageMinutes = (time() - $updatedAt) / 60;
        if ($ageMinutes > self::CTX_TTL) return null;

        return [
            'task_id'    => (int)$row['last_task_id'],
            'task_title' => $row['last_task_title'],
            'age_minutes'=> round($ageMinutes, 1),
        ];
    }

    // ── User resolution ────────────────────────────────────────────────────────

    /**
     * Resolve an assignee name to a dashboard user.
     *
     * Returns:
     *   ['status' => 'found',    'user'    => [...]]
     *   ['status' => 'multiple', 'matches' => [...]]
     *   ['status' => 'not_found']
     */
    public function resolveUserByName(string $name): array {
        $name = trim($name);
        if ($name === '') return ['status' => 'not_found'];

        // 1. Exact full-name match (case-insensitive)
        $exact = $this->db->fetchAll(
            "SELECT id, name, email, role FROM users
             WHERE is_active = 1 AND LOWER(name) = LOWER(?)
             ORDER BY id ASC",
            [$name]
        );
        if (count($exact) === 1) return ['status' => 'found', 'user' => $exact[0]];
        if (count($exact) > 1)  return ['status' => 'multiple', 'matches' => $exact];

        // 2. Starts-with match  (e.g. "Nguyen" → "Nguyen Van A")
        $startsWith = $this->db->fetchAll(
            "SELECT id, name, email, role FROM users
             WHERE is_active = 1 AND LOWER(name) LIKE LOWER(?)
             ORDER BY id ASC",
            [$name . '%']
        );
        if (count($startsWith) === 1) return ['status' => 'found', 'user' => $startsWith[0]];
        if (count($startsWith) > 1)  return ['status' => 'multiple', 'matches' => $startsWith];

        // 3. Contains match  (e.g. "Van A" → "Nguyen Van A")
        $contains = $this->db->fetchAll(
            "SELECT id, name, email, role FROM users
             WHERE is_active = 1 AND LOWER(name) LIKE LOWER(?)
             ORDER BY id ASC",
            ['%' . $name . '%']
        );
        if (count($contains) === 1) return ['status' => 'found', 'user' => $contains[0]];
        if (count($contains) > 1)  return ['status' => 'multiple', 'matches' => $contains];

        return ['status' => 'not_found'];
    }

    // ── Task lookup ────────────────────────────────────────────────────────────

    /**
     * Find a task by ID (with basic existence check).
     */
    public function getTaskById(int $taskId): ?array {
        return $this->db->fetch(
            "SELECT t.id, t.title, t.assignee_id, t.created_by, t.is_completed, t.status,
                    u.name AS assignee_name
             FROM tasks t
             LEFT JOIN users u ON u.id = t.assignee_id
             WHERE t.id = ?",
            [$taskId]
        ) ?: null;
    }

    /**
     * Find a task by title hint (for explicit references like "assign task X to Y").
     * Respects visibility scope: non-admin/manager only sees their own tasks.
     */
    public function findTaskByTitleHint(string $hint, int $actorUserId, bool $isPriv): ?array {
        $hint = trim($hint);
        if ($hint === '') return null;

        // Strip surrounding quotes if present
        $hint = trim($hint, '"\'');

        $scopeClause = $isPriv
            ? ''
            : "AND (t.assignee_id = {$actorUserId} OR t.created_by = {$actorUserId})";

        return $this->db->fetch(
            "SELECT t.id, t.title, t.assignee_id, t.created_by, t.is_completed, t.status,
                    u.name AS assignee_name
             FROM tasks t
             LEFT JOIN users u ON u.id = t.assignee_id
             WHERE t.is_completed = 0
               AND t.status NOT IN ('done', 'cancelled')
               AND t.title LIKE ?
               {$scopeClause}
             ORDER BY t.id DESC
             LIMIT 1",
            ['%' . $hint . '%']
        ) ?: null;
    }

    // ── Permission check ───────────────────────────────────────────────────────

    /**
     * Can $actorUserId reassign $task?
     *
     * Allowed if:
     *   - actor is admin or manager (isPriv)
     *   - actor created the task
     *   - actor is currently assigned to the task
     */
    public function canReassign(array $task, int $actorUserId, bool $isPriv): bool {
        if ($isPriv) return true;
        if ((int)$task['created_by']  === $actorUserId) return true;
        if ((int)$task['assignee_id'] === $actorUserId) return true;
        return false;
    }

    // ── Reassignment ───────────────────────────────────────────────────────────

    /**
     * Reassign a task to a new user.
     *
     * @return array{ok:bool, error?:string}
     */
    public function reassignTask(int $taskId, int $newAssigneeId, int $actorUserId, bool $isPriv): array {
        $task = $this->getTaskById($taskId);
        if (!$task) {
            return ['ok' => false, 'error' => 'task_not_found'];
        }

        if ((int)$task['is_completed'] || $task['status'] === 'done') {
            return ['ok' => false, 'error' => 'task_completed'];
        }

        if (!$this->canReassign($task, $actorUserId, $isPriv)) {
            return ['ok' => false, 'error' => 'permission'];
        }

        $this->db->execute(
            "UPDATE tasks SET assignee_id = ?, updated_at = NOW() WHERE id = ?",
            [$newAssigneeId, $taskId]
        );

        // Fetch updated row
        $updated = $this->getTaskById($taskId);

        return ['ok' => true, 'task' => $updated];
    }
}
