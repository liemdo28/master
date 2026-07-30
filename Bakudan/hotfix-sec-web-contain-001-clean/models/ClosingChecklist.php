<?php
/**
 * ClosingChecklist Model - Store Closing System
 */
class ClosingChecklist
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
        if (!$this->db->tableExists('closing_checklists')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS closing_checklists (
                    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    store_id    INT UNSIGNED NOT NULL,
                    user_id     INT UNSIGNED NOT NULL,
                    shift_date  DATE NOT NULL,
                    status      ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
                    close_time  TIME DEFAULT NULL,
                    items       JSON DEFAULT NULL,
                    cash_count  DECIMAL(10,2) DEFAULT NULL,
                    notes       TEXT DEFAULT NULL,
                    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_cc_store_date (store_id, shift_date)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
    }

    public function create(array $data): int
    {
        $items = is_array($data['items'] ?? null) ? json_encode($data['items']) : ($data['items'] ?? '{}');
        $this->db->execute("INSERT INTO closing_checklists (store_id, user_id, shift_date, status, close_time, items, cash_count, notes) VALUES (?,?,?,?,?,?,?,?)", [
            $data['store_id'], $data['user_id'], $data['shift_date'], $data['status'] ?? 'pending',
            $data['close_time'] ?? null, $items, $data['cash_count'] ?? null, $data['notes'] ?? null
        ]);
        return (int)$this->db->getConnection()->lastInsertId();
    }

    public function find(int $id): ?array
    {
        $row = $this->db->fetch("SELECT * FROM closing_checklists WHERE id = ?", [$id]);
        if ($row && $row['items']) $row['items'] = json_decode($row['items'], true);
        return $row ?: null;
    }

    public function getByStoreDate(int $storeId, string $date): ?array
    {
        $row = $this->db->fetch("SELECT * FROM closing_checklists WHERE store_id = ? AND shift_date = ? ORDER BY created_at DESC LIMIT 1", [$storeId, $date]);
        if ($row && $row['items']) $row['items'] = json_decode($row['items'], true);
        return $row ?: null;
    }

    public function complete(int $id, array $items, ?float $cashCount = null, ?string $notes = null): bool
    {
        return $this->db->execute("UPDATE closing_checklists SET status='completed', items=?, cash_count=?, notes=? WHERE id=?", [json_encode($items), $cashCount, $notes, $id]) > 0;
    }

    public function getStats(?int $storeId = null): array
    {
        $where = $storeId ? "WHERE store_id = ?" : "";
        $params = $storeId ? [$storeId] : [];
        $total = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM closing_checklists $where", $params)['cnt'] ?? 0);
        $completed = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM closing_checklists WHERE status='completed'" . ($storeId ? " AND store_id=?" : ""), $params)['cnt'] ?? 0);
        return ['total' => $total, 'completed' => $completed];
    }

    public static function defaultItems(): array
    {
        return ['equipment_off' => false, 'cash_count_done' => false, 'inventory_done' => false, 'cleaning_done' => false, 'security_check' => false, 'doors_locked' => false, 'alarm_set' => false, 'lights_off' => false];
    }
}
