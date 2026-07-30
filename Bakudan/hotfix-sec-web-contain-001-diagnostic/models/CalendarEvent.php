<?php
/**
 * CalendarEvent Model - Company Calendar
 */
class CalendarEvent
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
        if (!$this->db->tableExists('calendar_events')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS calendar_events (
                    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    title       VARCHAR(255) NOT NULL,
                    description TEXT DEFAULT NULL,
                    event_type  ENUM('holiday','meeting','deadline','training','other') DEFAULT 'other',
                    start_date  DATE NOT NULL,
                    end_date    DATE DEFAULT NULL,
                    store_id    INT UNSIGNED DEFAULT NULL,
                    created_by  INT UNSIGNED DEFAULT NULL,
                    is_all_day  TINYINT(1) DEFAULT 1,
                    color       VARCHAR(20) DEFAULT '#3b82f6',
                    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_ce_date (start_date),
                    INDEX idx_ce_type (event_type),
                    INDEX idx_ce_store (store_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
    }

    public function create(array $data): int
    {
        $this->db->execute("INSERT INTO calendar_events (title, description, event_type, start_date, end_date, store_id, created_by, is_all_day, color) VALUES (?,?,?,?,?,?,?,?,?)", [
            $data['title'], $data['description'] ?? null, $data['event_type'] ?? 'other',
            $data['start_date'], $data['end_date'] ?? $data['start_date'], $data['store_id'] ?? null,
            $data['created_by'] ?? null, $data['is_all_day'] ?? 1, $data['color'] ?? '#3b82f6'
        ]);
        return (int)$this->db->getConnection()->lastInsertId();
    }

    public function find(int $id): ?array
    {
        $row = $this->db->fetch("SELECT * FROM calendar_events WHERE id = ?", [$id]);
        return $row ?: null;
    }

    public function getByDateRange(string $from, string $to, ?int $storeId = null): array
    {
        $where = "start_date <= ? AND (end_date >= ? OR end_date IS NULL)";
        $params = [$to, $from];
        if ($storeId) { $where .= " AND (store_id = ? OR store_id IS NULL)"; $params[] = $storeId; }
        return $this->db->fetchAll("SELECT * FROM calendar_events WHERE $where ORDER BY start_date ASC", $params);
    }

    public function getByMonth(int $year, int $month): array
    {
        $from = sprintf('%04d-%02d-01', $year, $month);
        $to = date('Y-m-t', strtotime($from));
        return $this->getByDateRange($from, $to);
    }

    public function delete(int $id): bool
    {
        return $this->db->execute("DELETE FROM calendar_events WHERE id = ?", [$id]) > 0;
    }

    public function getUpcoming(int $limit = 10): array
    {
        return $this->db->fetchAll("SELECT * FROM calendar_events WHERE start_date >= CURDATE() ORDER BY start_date ASC LIMIT ?", [$limit]);
    }
}
