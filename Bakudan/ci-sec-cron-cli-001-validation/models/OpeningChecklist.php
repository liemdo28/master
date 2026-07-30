<?php
/**
 * OpeningChecklist Model - Store Opening System
 */
class OpeningChecklist
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
        if (!$this->db->tableExists('opening_checklists')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS opening_checklists (
                    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    store_id    INT UNSIGNED NOT NULL,
                    user_id     INT UNSIGNED NOT NULL,
                    shift_date  DATE NOT NULL,
                    status      ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
                    open_time   TIME DEFAULT NULL,
                    items       JSON DEFAULT NULL,
                    notes       TEXT DEFAULT NULL,
                    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_oc_store_date (store_id, shift_date)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
    }

    public function create(array $data): int
    {
        $items = is_array($data['items'] ?? null) ? json_encode($data['items']) : ($data['items'] ?? '{}');
        $this->db->execute("INSERT INTO opening_checklists (store_id, user_id, shift_date, status, open_time, items, notes) VALUES (?,?,?,?,?,?,?)", [
            $data['store_id'], $data['user_id'], $data['shift_date'], $data['status'] ?? 'pending',
            $data['open_time'] ?? null, $items, $data['notes'] ?? null
        ]);
        return (int)$this->db->getConnection()->lastInsertId();
    }

    public function find(int $id): ?array
    {
        $row = $this->db->fetch("SELECT * FROM opening_checklists WHERE id = ?", [$id]);
        if ($row && $row['items']) $row['items'] = json_decode($row['items'], true);
        return $row ?: null;
    }

    public function getByStoreDate(int $storeId, string $date): ?array
    {
        $row = $this->db->fetch("SELECT * FROM opening_checklists WHERE store_id = ? AND shift_date = ? ORDER BY created_at DESC LIMIT 1", [$storeId, $date]);
        if ($row && $row['items']) $row['items'] = json_decode($row['items'], true);
        return $row ?: null;
    }

    public function complete(int $id, array $items, ?string $notes = null): bool
    {
        return $this->db->execute("UPDATE opening_checklists SET status='completed', items=?, notes=? WHERE id=?", [json_encode($items), $notes, $id]) > 0;
    }

    public function getStats(?int $storeId = null): array
    {
        $where = $storeId ? "WHERE store_id = ?" : "";
        $params = $storeId ? [$storeId] : [];
        $total = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM opening_checklists $where", $params)['cnt'] ?? 0);
        $completed = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM opening_checklists WHERE status='completed'" . ($storeId ? " AND store_id=?" : ""), $params)['cnt'] ?? 0);
        return ['total' => $total, 'completed' => $completed];
    }

    public static function defaultItems(): array
    {
        return ['power_on' => false, 'equipment_check' => false, 'inventory_check' => false, 'cleanliness' => false, 'staff_present' => false, 'cash_drawer' => false, 'pos_system' => false, 'signage' => false];
    }
}
