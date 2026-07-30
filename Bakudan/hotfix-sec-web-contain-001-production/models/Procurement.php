<?php
/**
 * Procurement Model - Purchase Orders & Vendor Management
 */
class Procurement
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
        if (!$this->db->tableExists('procurements')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS procurements (
                    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    store_id      INT UNSIGNED DEFAULT NULL,
                    title         VARCHAR(255) NOT NULL,
                    category      VARCHAR(100) DEFAULT NULL,
                    vendor        VARCHAR(200) DEFAULT NULL,
                    status        ENUM('draft','pending','approved','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
                    requested_by  INT UNSIGNED DEFAULT NULL,
                    approved_by   INT UNSIGNED DEFAULT NULL,
                    total_amount  DECIMAL(12,2) DEFAULT 0,
                    notes         TEXT DEFAULT NULL,
                    approved_at   DATETIME DEFAULT NULL,
                    received_at   DATETIME DEFAULT NULL,
                    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_proc_store (store_id),
                    INDEX idx_proc_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
        if (!$this->db->tableExists('purchase_order_items')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS purchase_order_items (
                    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    procurement_id  INT UNSIGNED NOT NULL,
                    item_name       VARCHAR(255) NOT NULL,
                    quantity        INT DEFAULT 1,
                    unit_price      DECIMAL(10,2) DEFAULT 0,
                    total_price     DECIMAL(12,2) DEFAULT 0,
                    supplier        VARCHAR(200) DEFAULT NULL,
                    delivery_date   DATE DEFAULT NULL,
                    received_date   DATE DEFAULT NULL,
                    status          ENUM('pending','ordered','shipped','received','cancelled') DEFAULT 'pending',
                    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_poi_proc (procurement_id),
                    CONSTRAINT fk_poi_proc FOREIGN KEY (procurement_id) REFERENCES procurements(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
    }

    public function create(array $data): int
    {
        $this->db->execute("INSERT INTO procurements (store_id, title, category, vendor, status, requested_by, total_amount, notes) VALUES (?,?,?,?,?,?,?,?)", [
            $data['store_id'] ?? null, $data['title'], $data['category'] ?? null, $data['vendor'] ?? null,
            $data['status'] ?? 'draft', $data['requested_by'] ?? null, $data['total_amount'] ?? 0, $data['notes'] ?? null
        ]);
        return (int)$this->db->getConnection()->lastInsertId();
    }

    public function find(int $id): ?array
    {
        $row = $this->db->fetch("SELECT p.*, s.name as store_name, u1.name as requested_by_name, u2.name as approved_by_name FROM procurements p LEFT JOIN stores s ON p.store_id = s.id LEFT JOIN users u1 ON p.requested_by = u1.id LEFT JOIN users u2 ON p.approved_by = u2.id WHERE p.id = ?", [$id]);
        return $row ?: null;
    }

    public function all(array $filters = [], int $limit = 50): array
    {
        $where = ['1=1']; $params = [];
        if (!empty($filters['store_id'])) { $where[] = 'p.store_id = ?'; $params[] = $filters['store_id']; }
        if (!empty($filters['status'])) { $where[] = 'p.status = ?'; $params[] = $filters['status']; }
        $params[] = $limit;
        return $this->db->fetchAll("SELECT p.*, s.name as store_name, u.name as requested_by_name FROM procurements p LEFT JOIN stores s ON p.store_id = s.id LEFT JOIN users u ON p.requested_by = u.id WHERE " . implode(' AND ', $where) . " ORDER BY p.created_at DESC LIMIT ?", $params);
    }

    public function approve(int $id, int $userId): bool
    {
        return $this->db->execute("UPDATE procurements SET status='approved', approved_by=?, approved_at=NOW() WHERE id=?", [$userId, $id]) > 0;
    }

    public function reject(int $id): bool
    {
        return $this->db->execute("UPDATE procurements SET status='cancelled' WHERE id=?", [$id]) > 0;
    }

    public function markReceived(int $id): bool
    {
        return $this->db->execute("UPDATE procurements SET status='received', received_at=NOW() WHERE id=?", [$id]) > 0;
    }

    public function getStats(): array
    {
        $total = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM procurements")['cnt'] ?? 0);
        $pending = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM procurements WHERE status='pending'")['cnt'] ?? 0);
        $approved = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM procurements WHERE status='approved'")['cnt'] ?? 0);
        $totalSpend = (float)($this->db->fetch("SELECT COALESCE(SUM(total_amount),0) as total FROM procurements WHERE status IN ('approved','ordered','received')")['total'] ?? 0);
        return ['total' => $total, 'pending' => $pending, 'approved' => $approved, 'total_spend' => $totalSpend];
    }
}
