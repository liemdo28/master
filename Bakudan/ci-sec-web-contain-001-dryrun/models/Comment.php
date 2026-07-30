<?php
class Comment {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function getByTask($taskId) {
        return $this->db->fetchAll(
            "SELECT c.*, u.name as user_name, u.avatar FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.task_id = ? ORDER BY c.created_at ASC",
            [$taskId]
        );
    }

    public function create($taskId, $userId, $content) {
        return $this->db->insert(
            "INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)",
            [$taskId, $userId, $content]
        );
    }

    public function delete($id) {
        return $this->db->delete("DELETE FROM comments WHERE id = ?", [$id]);
    }

    public function findById($id) {
        return $this->db->fetch("SELECT * FROM comments WHERE id = ?", [$id]);
    }
}
