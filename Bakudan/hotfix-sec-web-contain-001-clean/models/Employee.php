<?php
/**
 * Employee Model - Employee Center
 */
class Employee
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
        if (!$this->db->tableExists('employees')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS employees (
                    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    user_id          INT UNSIGNED DEFAULT NULL,
                    store_id         INT UNSIGNED DEFAULT NULL,
                    employee_code    VARCHAR(50) DEFAULT NULL,
                    position         VARCHAR(100) DEFAULT NULL,
                    department       VARCHAR(100) DEFAULT NULL,
                    hire_date        DATE DEFAULT NULL,
                    termination_date DATE DEFAULT NULL,
                    status           ENUM('active','inactive','terminated','on_leave') NOT NULL DEFAULT 'active',
                    hourly_rate      DECIMAL(10,2) DEFAULT NULL,
                    salary           DECIMAL(12,2) DEFAULT NULL,
                    tax_status       VARCHAR(50) DEFAULT NULL,
                    emergency_contact VARCHAR(200) DEFAULT NULL,
                    emergency_phone  VARCHAR(50) DEFAULT NULL,
                    notes            TEXT DEFAULT NULL,
                    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_emp_user (user_id),
                    INDEX idx_emp_store (store_id),
                    INDEX idx_emp_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
    }

    public function create(array $data): int
    {
        $this->db->execute("INSERT INTO employees (user_id, store_id, employee_code, position, department, hire_date, status, hourly_rate, salary, tax_status, emergency_contact, emergency_phone, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [
            $data['user_id'] ?? null, $data['store_id'] ?? null, $data['employee_code'] ?? null,
            $data['position'] ?? null, $data['department'] ?? null, $data['hire_date'] ?? null,
            $data['status'] ?? 'active', $data['hourly_rate'] ?? null, $data['salary'] ?? null,
            $data['tax_status'] ?? null, $data['emergency_contact'] ?? null, $data['emergency_phone'] ?? null, $data['notes'] ?? null
        ]);
        return (int)$this->db->getConnection()->lastInsertId();
    }

    public function find(int $id): ?array
    {
        $row = $this->db->fetch("SELECT e.*, u.name, u.email, u.avatar, s.name as store_name FROM employees e LEFT JOIN users u ON e.user_id = u.id LEFT JOIN stores s ON e.store_id = s.id WHERE e.id = ?", [$id]);
        return $row ?: null;
    }

    public function all(array $filters = [], int $limit = 50, int $offset = 0): array
    {
        $where = ['1=1']; $params = [];
        if (!empty($filters['store_id'])) { $where[] = 'e.store_id = ?'; $params[] = $filters['store_id']; }
        if (!empty($filters['status'])) { $where[] = 'e.status = ?'; $params[] = $filters['status']; }
        if (!empty($filters['search'])) { $where[] = '(u.name LIKE ? OR e.position LIKE ? OR e.employee_code LIKE ?)'; $params[] = '%'.$filters['search'].'%'; $params[] = '%'.$filters['search'].'%'; $params[] = '%'.$filters['search'].'%'; }
        $params[] = $limit; $params[] = $offset;
        return $this->db->fetchAll("SELECT e.*, u.name, u.email, u.avatar, s.name as store_name FROM employees e LEFT JOIN users u ON e.user_id = u.id LEFT JOIN stores s ON e.store_id = s.id WHERE " . implode(' AND ', $where) . " ORDER BY u.name ASC LIMIT ? OFFSET ?", $params);
    }

    public function update(int $id, array $data): bool
    {
        $allowed = ['user_id','store_id','employee_code','position','department','hire_date','termination_date','status','hourly_rate','salary','tax_status','emergency_contact','emergency_phone','notes'];
        $sets = []; $params = [];
        foreach ($allowed as $f) { if (array_key_exists($f, $data)) { $sets[] = "$f = ?"; $params[] = $data[$f]; } }
        if (empty($sets)) return false;
        $params[] = $id;
        return $this->db->execute("UPDATE employees SET " . implode(', ', $sets) . " WHERE id = ?", $params) > 0;
    }

    public function getStats(): array
    {
        $total = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM employees")['cnt'] ?? 0);
        $active = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM employees WHERE status='active'")['cnt'] ?? 0);
        $inactive = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM employees WHERE status IN ('inactive','terminated')")['cnt'] ?? 0);
        $onLeave = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM employees WHERE status='on_leave'")['cnt'] ?? 0);
        return ['total' => $total, 'active' => $active, 'inactive' => $inactive, 'on_leave' => $onLeave];
    }
}
