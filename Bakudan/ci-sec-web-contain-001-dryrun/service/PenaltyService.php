<?php
/**
 * PenaltyService — applies a one-time penalty per overdue task.
 *
 * Rules
 *  - 500,000 VND default (admin-configurable via penalty_config table)
 *  - Penalty is applied ONCE per task (idempotent, enforced by UNIQUE key)
 *  - Only tasks that are overdue AND not completed AND have an assignee
 *  - Everything runs inside a transaction; duplicate-key exceptions are silently swallowed
 */
class PenaltyService {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureTables();
    }

    // ── Table bootstrap ───────────────────────────────────────────────────────

    private function ensureTables(): void {
        if (!$this->db->tableExists('penalty_config')) {
            try {
                $this->db->execute(
                    "CREATE TABLE IF NOT EXISTS penalty_config (
                        id             INT AUTO_INCREMENT PRIMARY KEY,
                        penalty_amount DECIMAL(12,2) NOT NULL DEFAULT 500000,
                        currency       VARCHAR(10)   NOT NULL DEFAULT 'VND',
                        updated_by     INT           NULL,
                        updated_at     DATETIME      NOT NULL
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
                );
                $this->db->invalidateSchemaCache('penalty_config');
            } catch (Throwable $e) {}
        }

        if (!$this->db->tableExists('penalty_log')) {
            try {
                $this->db->execute(
                    "CREATE TABLE IF NOT EXISTS penalty_log (
                        id             INT AUTO_INCREMENT PRIMARY KEY,
                        task_id        INT           NOT NULL,
                        user_id        INT           NULL,
                        penalty_amount DECIMAL(12,2) NOT NULL,
                        currency       VARCHAR(10)   NOT NULL DEFAULT 'VND',
                        reason         VARCHAR(255)  NOT NULL,
                        created_at     DATETIME      NOT NULL,
                        UNIQUE KEY uniq_task_penalty (task_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
                );
                $this->db->invalidateSchemaCache('penalty_log');
            } catch (Throwable $e) {}
        }

        // Seed default config if the table is empty
        $has = $this->db->fetch("SELECT 1 FROM penalty_config LIMIT 1");
        if (!$has) {
            try {
                $this->db->insert(
                    "INSERT INTO penalty_config (penalty_amount, currency, updated_at) VALUES (500000, 'VND', NOW())"
                );
            } catch (Throwable $e) {}
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Return the current penalty amount from config.
     * Fallback: 500,000 VND if table is empty or unreachable.
     */
    public function getCurrentPenaltyAmount(): float {
        try {
            $row = $this->db->fetch(
                "SELECT penalty_amount FROM penalty_config ORDER BY id DESC LIMIT 1"
            );
            return $row ? (float)$row['penalty_amount'] : 500000.0;
        } catch (Throwable $e) {
            return 500000.0;
        }
    }

    /**
     * Apply a penalty to a single task.
     * Returns true if penalty was applied, false if skipped or already applied.
     *
     * @param array $task  Row from the tasks table (must include id, due_date, status,
     *                     is_completed, penalty_applied, assignee_id, title)
     */
    public function applyPenaltyForTask(array $task): bool {
        if (!$this->isTaskLate($task))                   return false;
        if ((int)($task['penalty_applied'] ?? 0) === 1)  return false;
        if (empty($task['assignee_id']))                 return false;

        $amount = $this->getCurrentPenaltyAmount();
        $now    = date('Y-m-d H:i:s');
        $pdo    = $this->db->getConnection();

        $pdo->beginTransaction();
        try {
            // Insert into penalty_log — UNIQUE(task_id) prevents duplicates
            $this->db->insert(
                "INSERT INTO penalty_log (task_id, user_id, penalty_amount, currency, reason, created_at)
                 VALUES (?, ?, ?, 'VND', 'Task overdue', ?)",
                [(int)$task['id'], (int)$task['assignee_id'], $amount, $now]
            );

            // Stamp the task itself
            $this->db->execute(
                "UPDATE tasks
                 SET penalty_applied = 1, penalty_amount = ?, penalty_applied_at = ?
                 WHERE id = ? AND penalty_applied = 0",
                [$amount, $now, (int)$task['id']]
            );

            $pdo->commit();

            // Activity feed entry (non-fatal)
            $this->logActivity($task, $amount);

            return true;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            // Duplicate-key = penalty already logged by a concurrent run — not an error
            return false;
        }
    }

    /**
     * Scan all overdue, unpenalised tasks and apply penalties.
     * Returns ['count' => int, 'total_amount' => float].
     */
    public function applyOverduePenalties(): array {
        $today = function_exists('app_today') ? app_today() : date('Y-m-d');

        $tasks = $this->db->fetchAll(
            "SELECT id, title, due_date, status, is_completed, penalty_applied, assignee_id
             FROM tasks
             WHERE due_date < ?
               AND is_completed = 0
               AND status NOT IN ('done', 'completed', 'cancelled')
               AND penalty_applied = 0
               AND assignee_id IS NOT NULL
             LIMIT 500",
            [$today]
        ) ?: [];

        $applied     = 0;
        $totalAmount = 0.0;
        $amount      = $this->getCurrentPenaltyAmount();

        foreach ($tasks as $task) {
            if ($this->applyPenaltyForTask($task)) {
                $applied++;
                $totalAmount += $amount;
            }
        }

        return ['count' => $applied, 'total_amount' => $totalAmount];
    }

    /**
     * Penalty summary for a user over a given period.
     *
     * @param string $period  'month' | 'week' | 'year'
     */
    public function getUserPenaltySummary(int $userId, string $period = 'month'): array {
        $dateFrom = match ($period) {
            'week'  => date('Y-m-d', strtotime('monday this week')),
            'year'  => date('Y-01-01'),
            default => date('Y-m-01'),
        };

        try {
            $row = $this->db->fetch(
                "SELECT COUNT(*) AS cnt, COALESCE(SUM(penalty_amount), 0) AS total
                 FROM penalty_log
                 WHERE user_id = ? AND created_at >= ?",
                [$userId, $dateFrom . ' 00:00:00']
            );
        } catch (Throwable $e) {
            return ['count' => 0, 'total_amount' => 0.0, 'currency' => 'VND', 'period' => $period, 'from' => $dateFrom];
        }

        return [
            'count'        => (int)($row['cnt'] ?? 0),
            'total_amount' => (float)($row['total'] ?? 0),
            'currency'     => 'VND',
            'period'       => $period,
            'from'         => $dateFrom,
        ];
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private function isTaskLate(array $task): bool {
        $today = function_exists('app_today') ? app_today() : date('Y-m-d');
        if (empty($task['due_date']))                                             return false;
        if (substr($task['due_date'], 0, 10) >= $today)                          return false;
        if (!empty($task['is_completed']))                                        return false;
        if (in_array($task['status'] ?? '', ['done', 'completed', 'cancelled'])) return false;
        return true;
    }

    private function logActivity(array $task, float $amount): void {
        try {
            if (!$this->db->tableExists('system_activity_feed')) return;

            $name   = '';
            if (!empty($task['assignee_id'])) {
                $u = $this->db->fetch("SELECT name FROM users WHERE id = ?", [(int)$task['assignee_id']]);
                $name = $u['name'] ?? '';
            }

            $formatted = number_format($amount, 0, '.', ',');
            $title     = $name
                ? "Penalty applied — {$name}"
                : 'Penalty applied';
            $summary   = "{$formatted} VND for overdue task \"{$task['title']}\"";

            $this->db->insert(
                "INSERT INTO system_activity_feed (type, severity, title, summary, payload_json, created_at)
                 VALUES ('penalty_applied', 'warning', ?, ?, ?, NOW())",
                [
                    $title,
                    $summary,
                    json_encode([
                        'task_id'     => (int)$task['id'],
                        'user_id'     => (int)($task['assignee_id'] ?? 0),
                        'amount'      => $amount,
                        'task_title'  => $task['title'],
                        'user_name'   => $name,
                    ], JSON_UNESCAPED_UNICODE),
                ]
            );

            // Prune to 500 rows
            $this->db->execute(
                "DELETE FROM system_activity_feed
                 WHERE id NOT IN (
                   SELECT id FROM (
                     SELECT id FROM system_activity_feed ORDER BY created_at DESC LIMIT 500
                   ) t
                 )"
            );
        } catch (Throwable $e) {
            // Non-critical — never abort penalty for a logging failure
        }
    }
}
