<?php
/**
 * TrainingModule Model - Training Center
 */
class TrainingModule
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema(): void
    {
        if (defined('SKIP_SCHEMA_CHECKS') && SKIP_SCHEMA_CHECKS) return;
        if (!$this->db->tableExists('training_modules')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS training_modules (
                    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    title          VARCHAR(255) NOT NULL,
                    description    TEXT DEFAULT NULL,
                    category       VARCHAR(100) DEFAULT NULL,
                    duration_hours DECIMAL(5,1) DEFAULT NULL,
                    difficulty     ENUM('beginner','intermediate','advanced') DEFAULT 'beginner',
                    content_url    VARCHAR(500) DEFAULT NULL,
                    status         ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
                    created_by     INT UNSIGNED DEFAULT NULL,
                    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_tm_status (status),
                    INDEX idx_tm_category (category)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
        if (!$this->db->tableExists('training_progress')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS training_progress (
                    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    module_id    INT UNSIGNED NOT NULL,
                    user_id      INT UNSIGNED NOT NULL,
                    status       ENUM('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
                    score        INT DEFAULT NULL,
                    completed_at DATETIME DEFAULT NULL,
                    deadline     DATE DEFAULT NULL,
                    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_tp_module (module_id),
                    INDEX idx_tp_user (user_id),
                    UNIQUE KEY uk_tp_module_user (module_id, user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
    }

    public function create(array $data): int
    {
        $this->db->execute("INSERT INTO training_modules (title, description, category, duration_hours, difficulty, content_url, status, created_by) VALUES (?,?,?,?,?,?,?,?)", [
            $data['title'], $data['description'] ?? null, $data['category'] ?? null,
            $data['duration_hours'] ?? null, $data['difficulty'] ?? 'beginner',
            $data['content_url'] ?? null, $data['status'] ?? 'draft', $data['created_by'] ?? null
        ]);
        return (int)$this->db->getConnection()->lastInsertId();
    }

    public function find(int $id): ?array
    {
        $row = $this->db->fetch("SELECT * FROM training_modules WHERE id = ?", [$id]);
        return $row ?: null;
    }

    public function all(array $filters = [], int $limit = 50): array
    {
        $where = ['1=1']; $params = [];
        if (!empty($filters['status'])) { $where[] = 'status = ?'; $params[] = $filters['status']; }
        if (!empty($filters['category'])) { $where[] = 'category = ?'; $params[] = $filters['category']; }
        $params[] = $limit;
        return $this->db->fetchAll("SELECT * FROM training_modules WHERE " . implode(' AND ', $where) . " ORDER BY created_at DESC LIMIT ?", $params);
    }

    public function enroll(int $moduleId, int $userId, ?string $deadline = null): void
    {
        $this->db->execute("INSERT IGNORE INTO training_progress (module_id, user_id, status, deadline) VALUES (?, ?, 'not_started', ?)", [$moduleId, $userId, $deadline]);
    }

    public function markComplete(int $moduleId, int $userId, ?int $score = null): void
    {
        $this->db->execute("UPDATE training_progress SET status='completed', score=?, completed_at=NOW() WHERE module_id=? AND user_id=?", [$score, $moduleId, $userId]);
    }

    public function getProgress(int $moduleId): array
    {
        return $this->db->fetchAll("SELECT tp.*, u.name as user_name FROM training_progress tp LEFT JOIN users u ON tp.user_id = u.id WHERE tp.module_id = ?", [$moduleId]);
    }

    public function getUserProgress(int $userId): array
    {
        return $this->db->fetchAll("SELECT tp.*, tm.title, tm.category FROM training_progress tp JOIN training_modules tm ON tp.module_id = tm.id WHERE tp.user_id = ? ORDER BY tp.created_at DESC", [$userId]);
    }

    public function getStats(): array
    {
        $total = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM training_modules")['cnt'] ?? 0);
        $published = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM training_modules WHERE status='published'")['cnt'] ?? 0);
        $enrolled = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM training_progress")['cnt'] ?? 0);
        $completed = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM training_progress WHERE status='completed'")['cnt'] ?? 0);
        $inProgress = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM training_progress WHERE status='in_progress'")['cnt'] ?? 0);
        return ['total_modules' => $total, 'published' => $published, 'enrolled' => $enrolled, 'completed' => $completed, 'in_progress' => $inProgress];
    }
}
