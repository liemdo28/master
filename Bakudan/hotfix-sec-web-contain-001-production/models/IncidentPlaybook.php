<?php
/**
 * IncidentPlaybook Model - Playbook System
 */
class IncidentPlaybook
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
        if (!$this->db->tableExists('incident_playbooks')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS incident_playbooks (
                    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    name           VARCHAR(255) NOT NULL,
                    category       VARCHAR(100) DEFAULT NULL,
                    severity       ENUM('low','medium','high','critical') DEFAULT 'medium',
                    description    TEXT DEFAULT NULL,
                    steps          JSON DEFAULT NULL,
                    estimated_time INT DEFAULT NULL COMMENT 'minutes',
                    created_by     INT UNSIGNED DEFAULT NULL,
                    status         ENUM('active','archived') NOT NULL DEFAULT 'active',
                    times_executed INT DEFAULT 0,
                    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_pb_category (category),
                    INDEX idx_pb_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
    }

    public function create(array $data): int
    {
        $steps = is_array($data['steps'] ?? null) ? json_encode($data['steps']) : ($data['steps'] ?? '[]');
        $this->db->execute("INSERT INTO incident_playbooks (name, category, severity, description, steps, estimated_time, created_by) VALUES (?,?,?,?,?,?,?)", [
            $data['name'], $data['category'] ?? null, $data['severity'] ?? 'medium',
            $data['description'] ?? null, $steps, $data['estimated_time'] ?? null, $data['created_by'] ?? null
        ]);
        return (int)$this->db->getConnection()->lastInsertId();
    }

    public function find(int $id): ?array
    {
        $row = $this->db->fetch("SELECT * FROM incident_playbooks WHERE id = ?", [$id]);
        if ($row && $row['steps']) $row['steps'] = json_decode($row['steps'], true);
        return $row ?: null;
    }

    public function all(?string $status = 'active'): array
    {
        $where = $status ? "WHERE status = ?" : "";
        $params = $status ? [$status] : [];
        $rows = $this->db->fetchAll("SELECT * FROM incident_playbooks $where ORDER BY category, name", $params);
        foreach ($rows as &$r) { if ($r['steps']) $r['steps'] = json_decode($r['steps'], true); }
        return $rows;
    }

    public function getByCategory(string $category): array
    {
        $rows = $this->db->fetchAll("SELECT * FROM incident_playbooks WHERE category = ? AND status = 'active' ORDER BY name", [$category]);
        foreach ($rows as &$r) { if ($r['steps']) $r['steps'] = json_decode($r['steps'], true); }
        return $rows;
    }

    public function execute(int $id): bool
    {
        return $this->db->execute("UPDATE incident_playbooks SET times_executed = times_executed + 1 WHERE id = ?", [$id]) > 0;
    }

    public function archive(int $id): bool
    {
        return $this->db->execute("UPDATE incident_playbooks SET status = 'archived' WHERE id = ?", [$id]) > 0;
    }

    public function getStats(): array
    {
        $total = (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM incident_playbooks WHERE status='active'")['cnt'] ?? 0);
        $totalExecutions = (int)($this->db->fetch("SELECT COALESCE(SUM(times_executed),0) as cnt FROM incident_playbooks")['cnt'] ?? 0);
        return ['total' => $total, 'total_executions' => $totalExecutions];
    }
}
