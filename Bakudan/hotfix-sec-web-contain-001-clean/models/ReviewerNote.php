<?php
/**
 * ReviewerNote — Reviewer workspace: instructions, checklists, questions, guidance
 */
class ReviewerNote {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function getByTask(int $taskId): array {
        if (!$this->db->tableExists('task_reviewer_notes')) return [];
        return $this->db->fetchAll(
            "SELECT rn.*,
                    u.name   AS reviewer_name,
                    u.avatar AS reviewer_avatar,
                    u.role   AS reviewer_role,
                    au.name  AS acknowledged_by_name
             FROM task_reviewer_notes rn
             JOIN users u ON rn.user_id = u.id
             LEFT JOIN users au ON rn.acknowledged_by = au.id
             WHERE rn.task_id = ?
             ORDER BY rn.created_at DESC",
            [$taskId]
        );
    }

    public function findById(int $id): ?array {
        if (!$this->db->tableExists('task_reviewer_notes')) return null;
        return $this->db->fetch(
            "SELECT rn.*, u.name AS reviewer_name FROM task_reviewer_notes rn
             JOIN users u ON rn.user_id = u.id WHERE rn.id = ?",
            [$id]
        ) ?: null;
    }

    /**
     * Create a reviewer note.
     * Returns the new ID.
     */
    public function create(int $taskId, int $userId, array $data): int {
        if (!$this->db->tableExists('task_reviewer_notes')) return 0;
        $checklistJson = !empty($data['checklist_items']) && is_array($data['checklist_items'])
            ? json_encode($data['checklist_items'])
            : null;

        return (int)$this->db->insert(
            "INSERT INTO task_reviewer_notes
                (task_id, user_id, note_type, title, content, checklist_items)
             VALUES (?, ?, ?, ?, ?, ?)",
            [
                $taskId,
                $userId,
                $data['note_type'] ?? 'instruction',
                $data['title'] ?? null,
                $data['content'],
                $checklistJson,
            ]
        );
    }

    public function update(int $id, array $data): bool {
        $fields = [];
        $params = [];

        if (isset($data['content'])) {
            $fields[] = 'content = ?';
            $params[] = $data['content'];
        }
        if (isset($data['title'])) {
            $fields[] = 'title = ?';
            $params[] = $data['title'];
        }
        if (isset($data['note_type'])) {
            $fields[] = 'note_type = ?';
            $params[] = $data['note_type'];
        }
        if (isset($data['checklist_items'])) {
            $fields[] = 'checklist_items = ?';
            $params[] = is_array($data['checklist_items']) ? json_encode($data['checklist_items']) : $data['checklist_items'];
        }
        if (isset($data['is_completed'])) {
            $fields[] = 'is_completed = ?';
            $params[] = (int)$data['is_completed'];
        }

        if (empty($fields)) return false;

        $params[] = $id;
        return $this->db->update(
            "UPDATE task_reviewer_notes SET " . implode(', ', $fields) . " WHERE id = ?",
            $params
        ) > 0;
    }

    public function acknowledge(int $id, int $userId): bool {
        if (!$this->db->tableExists('task_reviewer_notes')) return false;
        return $this->db->update(
            "UPDATE task_reviewer_notes
             SET is_acknowledged = 1, acknowledged_by = ?, acknowledged_at = NOW()
             WHERE id = ? AND is_acknowledged = 0",
            [$userId, $id]
        ) > 0;
    }

    public function delete(int $id): bool {
        if (!$this->db->tableExists('task_reviewer_notes')) return false;
        return $this->db->delete("DELETE FROM task_reviewer_notes WHERE id = ?", [$id]) > 0;
    }

    public function updateChecklistItem(int $noteId, int $itemIndex, bool $done): bool {
        if (!$this->db->tableExists('task_reviewer_notes')) return false;
        $note = $this->db->fetch("SELECT checklist_items FROM task_reviewer_notes WHERE id = ?", [$noteId]);
        if (!$note) return false;

        $items = json_decode($note['checklist_items'] ?? '[]', true) ?: [];
        if (!isset($items[$itemIndex])) return false;

        $items[$itemIndex]['done'] = $done;
        return $this->db->update(
            "UPDATE task_reviewer_notes SET checklist_items = ? WHERE id = ?",
            [json_encode($items), $noteId]
        ) > 0;
    }

    /** Count pending (unacknowledged) reviewer notes for a task */
    public function countPending(int $taskId): int {
        if (!$this->db->tableExists('task_reviewer_notes')) return 0;
        $r = $this->db->fetch(
            "SELECT COUNT(*) AS c FROM task_reviewer_notes WHERE task_id = ? AND is_acknowledged = 0",
            [$taskId]
        );
        return (int)($r['c'] ?? 0);
    }
}
