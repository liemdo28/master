<?php
/**
 * Shift Model - Shift Management System
 */
class Shift
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
        if (!$this->db->tableExists('shifts')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS shifts (
                    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    store_id     INT UNSIGNED DEFAULT NULL,
                    user_id      INT UNSIGNED DEFAULT NULL,
                    shift_date   DATE NOT NULL,
                    start_time   TIME NOT NULL,
                    end_time     TIME NOT NULL,
                    role         VARCHAR(100) DEFAULT NULL,
                    status       ENUM('scheduled','confirmed','completed','absent','cancelled') NOT NULL DEFAULT 'scheduled',
                    notes        TEXT DEFAULT NULL,
                    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_shifts_store (store_id),
                    INDEX idx_shifts_user (user_id),
                    INDEX idx_shifts_date (shift_date),
                    INDEX idx_shifts_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
    }

    public function create(array $data): int
    {
        $this->db->execute(
            "INSERT INTO shifts (store_id, user_id, shift_date, start_time, end_time, role, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [$data['store_id'] ?? null, $data['user_id'] ?? null, $data['shift_date'], $data['start_time'], $data['end_time'], $data['role'] ?? null, $data['status'] ?? 'scheduled', $data['notes'] ?? null]
        );
        return (int)$this->db->getConnection()->lastInsertId();
    }

    public function find(int $id): ?array
    {
        $row = $this->db->fetch("SELECT s.*, u.name as user_name, st.name as store_name FROM shifts s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN stores st ON s.store_id = st.id WHERE s.id = ?", [$id]);
        return $row ?: null;
    }

    public function all(array $filters = [], int $limit = 50, int $offset = 0): array
    {
        $where = ['1=1'];
        $params = [];
        if (!empty($filters['store_id'])) { $where[] = 's.store_id = ?'; $params[] = $filters['store_id']; }
        if (!empty($filters['user_id'])) { $where[] = 's.user_id = ?'; $params[] = $filters['user_id']; }
        if (!empty($filters['status'])) { $where[] = 's.status = ?'; $params[] = $filters['status']; }
        if (!empty($filters['date'])) { $where[] = 's.shift_date = ?'; $params[] = $filters['date']; }
        if (!empty($filters['from_date'])) { $where[] = 's.shift_date >= ?'; $params[] = $filters['from_date']; }
        if (!empty($filters['to_date'])) { $where[] = 's.shift_date <= ?'; $params[] = $filters['to_date']; }
        $params[] = $limit; $params[] = $offset;
        return $this->db->fetchAll("SELECT s.*, u.name as user_name, st.name as store_name FROM shifts s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN stores st ON s.store_id = st.id WHERE " . implode(' AND ', $where) . " ORDER BY s.shift_date DESC, s.start_time ASC LIMIT ? OFFSET ?", $params);
    }

    public function getByStore(int $storeId, ?string $date = null): array
    {
        $filters = ['store_id' => $storeId];
        if ($date) $filters['date'] = $date;
        return $this->all($filters, 100, 0);
    }

    public function getByUser(int $userId, ?string $fromDate = null): array
    {
        $filters = ['user_id' => $userId];
        if ($fromDate) $filters['from_date'] = $fromDate;
        return $this->all($filters, 100, 0);
    }

    public function getByDateRange(string $from, string $to, ?int $storeId = null): array
    {
        $filters = ['from_date' => $from, 'to_date' => $to];
        if ($storeId) $filters['store_id'] = $storeId;
        return $this->all($filters, 500, 0);
    }

    public function update(int $id, array $data): bool
    {
        $allowed = ['store_id','user_id','shift_date','start_time','end_time','role','status','notes'];
        $sets = []; $params = [];
        foreach ($allowed as $f) { if (array_key_exists($f, $data)) { $sets[] = "$f = ?"; $params[] = $data[$f]; } }
        if (empty($sets)) return false;
        $params[] = $id;
        return $this->db->execute("UPDATE shifts SET " . implode(', ', $sets) . " WHERE id = ?", $params) > 0;
    }

    public function updateStatus(int $id, string $status): bool
    {
        return $this->update($id, ['status' => $status]);
    }

    public function delete(int $id): bool
    {
        return $this->db->execute("DELETE FROM shifts WHERE id = ?", [$id]) > 0;
    }

    public function getStats(?int $storeId = null): array
    {
        $today = date('Y-m-d');
        $weekStart = date('Y-m-d', strtotime('monday this week'));
        $weekEnd = date('Y-m-d', strtotime('sunday this week'));
        $storeWhere = $storeId ? " AND store_id = ?" : "";
        $params = $storeId ? [$storeId] : [];

        $total = $this->db->fetch("SELECT COUNT(*) as cnt FROM shifts WHERE 1=1 $storeWhere", $params);
        $todayShifts = $this->db->fetch("SELECT COUNT(*) as cnt FROM shifts WHERE shift_date = ? $storeWhere", array_merge([$today], $params));
        $weekShifts = $this->db->fetch("SELECT COUNT(*) as cnt FROM shifts WHERE shift_date BETWEEN ? AND ? $storeWhere", array_merge([$weekStart, $weekEnd], $params));
        $scheduled = $this->db->fetch("SELECT COUNT(*) as cnt FROM shifts WHERE status = 'scheduled' AND shift_date >= ? $storeWhere", array_merge([$today], $params));

        return [
            'total' => (int)($total['cnt'] ?? 0),
            'today' => (int)($todayShifts['cnt'] ?? 0),
            'this_week' => (int)($weekShifts['cnt'] ?? 0),
            'scheduled' => (int)($scheduled['cnt'] ?? 0),
        ];
    }

    public function countAll(array $filters = []): int
    {
        $where = ['1=1']; $params = [];
        if (!empty($filters['store_id'])) { $where[] = 'store_id = ?'; $params[] = $filters['store_id']; }
        if (!empty($filters['status'])) { $where[] = 'status = ?'; $params[] = $filters['status']; }
        $row = $this->db->fetch("SELECT COUNT(*) as cnt FROM shifts WHERE " . implode(' AND ', $where), $params);
        return (int)($row['cnt'] ?? 0);
    }
}
