<?php
/**
 * Document Model - Document Center
 */
class Document
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
        if (!$this->db->tableExists('documents')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS documents (
                    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    title        VARCHAR(255) NOT NULL,
                    file_path    VARCHAR(500) DEFAULT NULL,
                    file_type    VARCHAR(100) DEFAULT NULL,
                    file_size    INT UNSIGNED DEFAULT 0,
                    category     VARCHAR(100) DEFAULT NULL,
                    store_id     INT UNSIGNED DEFAULT NULL,
                    uploaded_by  INT UNSIGNED DEFAULT NULL,
                    version      INT DEFAULT 1,
                    status       ENUM('active','archived') NOT NULL DEFAULT 'active',
                    description  TEXT DEFAULT NULL,
                    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_doc_store (store_id),
                    INDEX idx_doc_category (category),
                    INDEX idx_doc_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
    }

    public function create(array $data): int
    {
        $this->db->execute("INSERT INTO documents (title, file_path, file_type, file_size, category, store_id, uploaded_by, description) VALUES (?,?,?,?,?,?,?,?)", [
            $data['title'], $data['file_path'] ?? null, $data['file_type'] ?? null, $data['file_size'] ?? 0,
            $data['category'] ?? null, $data['store_id'] ?? null, $data['uploaded_by'] ?? null, $data['description'] ?? null
        ]);
        return (int)$this->db->getConnection()->lastInsertId();
    }

    public function find(int $id): ?array
    {
        $row = $this->db->fetch("SELECT d.*, u.name as uploaded_by_name, s.name as store_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id LEFT JOIN stores s ON d.store_id = s.id WHERE d.id = ?", [$id]);
        return $row ?: null;
    }

    public function all(array $filters = [], int $limit = 50): array
    {
        $where = ['1=1']; $params = [];
        if (!empty($filters['category'])) { $where[] = 'd.category = ?'; $params[] = $filters['category']; }
        if (!empty($filters['store_id'])) { $where[] = 'd.store_id = ?'; $params[] = $filters['store_id']; }
        if (!empty($filters['status'])) { $where[] = 'd.status = ?'; $params[] = $filters['status']; }
        if (!empty($filters['search'])) { $where[] = '(d.title LIKE ? OR d.description LIKE ?)'; $params[] = '%'.$filters['search'].'%'; $params[] = '%'.$filters['search'].'%'; }
        $params[] = $limit;
        return $this->db->fetchAll("SELECT d.*, u.name as uploaded_by_name, s.name as store_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id LEFT JOIN stores s ON d.store_id = s.id WHERE " . implode(' AND ', $where) . " ORDER BY d.created_at DESC LIMIT ?", $params);
    }

    public function archive(int $id): bool
    {
        return $this->db->execute("UPDATE documents SET status='archived' WHERE id=?", [$id]) > 0;
    }

    public function delete(int $id): bool
    {
        return $this->db->execute("DELETE FROM documents WHERE id=?", [$id]) > 0;
    }

    public function getStats(): array
    {
        $total = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM documents WHERE status='active'")['cnt'] ?? 0);
        $archived = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM documents WHERE status='archived'")['cnt'] ?? 0);
        $categories = $this->db->fetchAll("SELECT category, COUNT(*) as cnt FROM documents WHERE status='active' GROUP BY category ORDER BY cnt DESC LIMIT 10");
        return ['total' => $total, 'archived' => $archived, 'categories' => $categories];
    }

    public function getCategories(): array
    {
        return $this->db->fetchAll("SELECT DISTINCT category FROM documents WHERE category IS NOT NULL ORDER BY category");
    }
}
