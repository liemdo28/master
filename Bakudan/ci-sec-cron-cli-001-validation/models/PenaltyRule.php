<?php
/**
 * PenaltyRule — configurable penalty rule definitions.
 *
 * Manages the penalty_rules, penalty_appeals, and penalty_comments tables.
 * Rules define what triggers a penalty and the suggested fine amount.
 * No penalty is applied to any user automatically — admin must act explicitly.
 */
class PenaltyRule {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema(): void {
        if (!$this->db->tableExists('penalty_rules')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS penalty_rules (
                    id               INT AUTO_INCREMENT PRIMARY KEY,
                    name             VARCHAR(200)  NOT NULL,
                    description      TEXT          NULL,
                    rule_type        VARCHAR(50)   NOT NULL DEFAULT 'custom',
                    suggested_amount DECIMAL(12,2) NOT NULL DEFAULT 500000.00,
                    currency         VARCHAR(10)   NOT NULL DEFAULT 'VND',
                    is_active        TINYINT(1)    NOT NULL DEFAULT 1,
                    effective_date   DATE          NOT NULL,
                    created_by       INT           NULL,
                    updated_by       INT           NULL,
                    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
                    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            $this->seedDefaults();
        }

        if (!$this->db->tableExists('penalty_appeals')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS penalty_appeals (
                    id               INT AUTO_INCREMENT PRIMARY KEY,
                    penalty_log_id   INT           NOT NULL,
                    user_id          INT           NOT NULL,
                    reason           TEXT          NOT NULL,
                    status           VARCHAR(20)   NOT NULL DEFAULT 'pending',
                    reviewed_by      INT           NULL,
                    reviewed_at      TIMESTAMP     NULL,
                    admin_note       TEXT          NULL,
                    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_appeal_per_log (penalty_log_id),
                    FOREIGN KEY (penalty_log_id) REFERENCES penalty_log(id)  ON DELETE CASCADE,
                    FOREIGN KEY (user_id)        REFERENCES users(id)         ON DELETE CASCADE,
                    FOREIGN KEY (reviewed_by)    REFERENCES users(id)         ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }

        if (!$this->db->tableExists('penalty_comments')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS penalty_comments (
                    id               INT AUTO_INCREMENT PRIMARY KEY,
                    penalty_log_id   INT           NOT NULL,
                    user_id          INT           NOT NULL,
                    comment          TEXT          NOT NULL,
                    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (penalty_log_id) REFERENCES penalty_log(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
    }

    private function seedDefaults(): void {
        $defaults = [
            ['Task Overdue',        'Applied when a task passes its due date without completion.', 'task_overdue',        500000.00, 'VND', 1],
            ['Verification Missed', 'Applied when a scheduled verification check is missed.',      'verification_missed', 500000.00, 'VND', 0],
            ['Checklist Missed',    'Applied when a required checklist item is skipped.',          'checklist_missed',    500000.00, 'VND', 0],
        ];
        foreach ($defaults as $d) {
            try {
                $exists = $this->db->fetch(
                    "SELECT id FROM penalty_rules WHERE rule_type = ? LIMIT 1",
                    [$d[2]]
                );
                if (!$exists) {
                    $this->db->execute(
                        "INSERT INTO penalty_rules (name, description, rule_type, suggested_amount, currency, is_active, effective_date) VALUES (?, ?, ?, ?, ?, ?, CURDATE())",
                        $d
                    );
                }
            } catch (\Throwable $e) {
                // Non-fatal — seed failure does not block the app
            }
        }
    }

    // ── Rule CRUD ─────────────────────────────────────────────────────────────

    public function getAll(): array {
        return $this->db->fetchAll("
            SELECT pr.*, u.name AS created_by_name
            FROM penalty_rules pr
            LEFT JOIN users u ON u.id = pr.created_by
            ORDER BY pr.is_active DESC, pr.id ASC
        ");
    }

    public function getActive(): array {
        return $this->db->fetchAll(
            "SELECT * FROM penalty_rules WHERE is_active = 1 ORDER BY name ASC"
        );
    }

    public function getById(int $id): ?array {
        return $this->db->fetch("SELECT * FROM penalty_rules WHERE id = ?", [$id]) ?: null;
    }

    public function save(array $data, int $adminId): int {
        $id     = (int)($data['id'] ?? 0);
        $name   = trim($data['name'] ?? '');
        $desc   = trim($data['description'] ?? '');
        $type   = $data['rule_type']  ?? 'custom';
        $amount = (float)($data['suggested_amount'] ?? 500000);
        $cur    = $data['currency']   ?? 'VND';
        $active = (int)(bool)($data['is_active'] ?? 1);
        $date   = $data['effective_date'] ?? date('Y-m-d');

        if ($id > 0) {
            $this->db->execute(
                "UPDATE penalty_rules SET name=?, description=?, rule_type=?, suggested_amount=?, currency=?, is_active=?, effective_date=?, updated_by=?, updated_at=NOW() WHERE id=?",
                [$name, $desc ?: null, $type, $amount, $cur, $active, $date, $adminId, $id]
            );
            return $id;
        }

        $this->db->execute(
            "INSERT INTO penalty_rules (name, description, rule_type, suggested_amount, currency, is_active, effective_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [$name, $desc ?: null, $type, $amount, $cur, $active, $date, $adminId]
        );
        return (int)$this->db->lastInsertId();
    }

    public function toggle(int $id, bool $active): void {
        $this->db->execute(
            "UPDATE penalty_rules SET is_active=?, updated_at=NOW() WHERE id=?",
            [(int)$active, $id]
        );
    }

    public function delete(int $id): void {
        $this->db->execute("DELETE FROM penalty_rules WHERE id=?", [$id]);
    }

    public function getDefaultRule(): array {
        $row = $this->db->fetch(
            "SELECT suggested_amount, currency FROM penalty_rules WHERE rule_type='task_overdue' AND is_active=1 ORDER BY id DESC LIMIT 1"
        );
        return $row ?: ['suggested_amount' => 500000.00, 'currency' => 'VND'];
    }

    // ── Appeals ───────────────────────────────────────────────────────────────

    public function getAppealsForUser(int $userId): array {
        return $this->db->fetchAll("
            SELECT pa.*, pl.amount, pl.late_days, pl.calculated_at,
                   t.title AS task_title, t.id AS task_id
            FROM penalty_appeals pa
            JOIN penalty_log pl ON pl.id = pa.penalty_log_id
            JOIN tasks t ON t.id = pl.task_id
            WHERE pa.user_id = ?
            ORDER BY pa.created_at DESC
        ", [$userId]);
    }

    public function getAllPendingAppeals(): array {
        return $this->db->fetchAll("
            SELECT pa.*, u.name AS user_name, pl.amount, pl.late_days,
                   t.title AS task_title, t.id AS task_id
            FROM penalty_appeals pa
            JOIN penalty_log pl ON pl.id = pa.penalty_log_id
            JOIN users u ON u.id = pa.user_id
            JOIN tasks t ON t.id = pl.task_id
            WHERE pa.status = 'pending'
            ORDER BY pa.created_at ASC
        ");
    }

    public function getAppealsForStore(int $storeId): array {
        return $this->db->fetchAll("
            SELECT pa.*, u.name AS user_name, pl.amount, pl.late_days,
                   t.title AS task_title, t.id AS task_id
            FROM penalty_appeals pa
            JOIN penalty_log pl ON pl.id = pa.penalty_log_id
            JOIN users u ON u.id = pa.user_id
            JOIN tasks t ON t.id = pl.task_id
            LEFT JOIN projects p ON p.id = t.project_id
            WHERE p.store_id = ? AND pa.status = 'pending'
            ORDER BY pa.created_at ASC
        ", [$storeId]);
    }

    public function submitAppeal(int $penaltyLogId, int $userId, string $reason): bool {
        try {
            $this->db->execute(
                "INSERT INTO penalty_appeals (penalty_log_id, user_id, reason) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE reason=VALUES(reason), status='pending', updated_at=NOW()",
                [$penaltyLogId, $userId, $reason]
            );
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    public function reviewAppeal(int $appealId, string $status, int $reviewerId, string $note = ''): bool {
        try {
            $this->db->execute(
                "UPDATE penalty_appeals SET status=?, reviewed_by=?, reviewed_at=NOW(), admin_note=?, updated_at=NOW() WHERE id=?",
                [$status, $reviewerId, $note ?: null, $appealId]
            );
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }
}
