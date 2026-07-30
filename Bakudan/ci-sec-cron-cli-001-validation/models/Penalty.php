<?php
class Penalty {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
        $this->seedNguyenNguyen();
    }

    /**
     * Seed Nguyen Nguyen to penalty config if not already present.
     * Only fires if the user exists in the DB.
     */
    private function seedNguyenNguyen(): void {
        $user = $this->db->fetch("SELECT id FROM users WHERE name = 'Nguyen Nguyen' LIMIT 1");
        if (!$user) return;
        $userId = (int) $user['id'];
        $existing = $this->db->fetch("SELECT id FROM penalty_config WHERE user_id = ?", [$userId]);
        if ($existing) return;
        $this->db->execute(
            "INSERT INTO penalty_config (user_id, amount_per_late_task, is_active, enabled_by_admin_id, note)
             VALUES (?, 50000, 1, 1, 'Auto-added: Nguyen Nguyen penalty tracking')",
            [$userId]
        );
    }

    private function ensureSchema(): void {
        // penalty_config: old schema was a single global-config row with no user_id column.
        // New schema is per-user. If the old table exists (missing user_id), drop it first.
        if ($this->db->tableExists('penalty_config')) {
            if (!$this->db->columnExists('penalty_config', 'user_id')) {
                // Old single-row config table — safe to drop (no FK depends on it)
                $this->db->execute("DROP TABLE IF EXISTS penalty_config");
                // Also clear the cache so tableExists() re-checks below
                $this->db->invalidateSchemaCache('penalty_config');
            }
        }
        if (!$this->db->tableExists('penalty_config')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS penalty_config (
                    id                   INT AUTO_INCREMENT PRIMARY KEY,
                    user_id              INT           NOT NULL,
                    amount_per_late_task DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                    is_active            TINYINT(1)    NOT NULL DEFAULT 1,
                    enabled_by_admin_id  INT           NULL DEFAULT NULL,
                    note                 VARCHAR(500)  NULL DEFAULT NULL,
                    created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_penalty_user (user_id),
                    FOREIGN KEY (user_id)             REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (enabled_by_admin_id) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }

        // penalty_log: old schema had (task_id, project_id, store_id, user_id, penalty_amount, ...).
        // New schema has (id, user_id, task_id, late_days, amount, ...) with UNIQUE(user_id, task_id).
        // Detect old schema by checking for the renamed column (penalty_amount → amount).
        if ($this->db->tableExists('penalty_log')) {
            if (!$this->db->columnExists('penalty_log', 'amount')) {
                // Old penalty_log — incompatible schema, drop and recreate (history can't be migrated)
                $this->db->execute("DROP TABLE IF EXISTS penalty_log");
                $this->db->invalidateSchemaCache('penalty_log');
            }
        }
        if (!$this->db->tableExists('penalty_log')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS penalty_log (
                    id            INT AUTO_INCREMENT PRIMARY KEY,
                    user_id       INT           NOT NULL,
                    task_id       INT           NOT NULL,
                    late_days     INT           NOT NULL DEFAULT 0,
                    amount        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                    calculated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_penalty_log_user_task (user_id, task_id),
                    FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
                    FOREIGN KEY (task_id) REFERENCES tasks(id)  ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
    }

    // ── Config management ─────────────────────────────────────────────────────

    public function getAllConfigs(): array {
        return $this->db->fetchAll("
            SELECT pc.*, u.name AS user_name, u.email AS user_email, u.avatar AS user_avatar,
                   a.name AS admin_name
            FROM penalty_config pc
            JOIN users u  ON u.id = pc.user_id
            LEFT JOIN users a ON a.id = pc.enabled_by_admin_id
            ORDER BY u.name ASC
        ");
    }

    public function getConfigByUser(int $userId): ?array {
        return $this->db->fetch(
            "SELECT * FROM penalty_config WHERE user_id = ?",
            [$userId]
        ) ?: null;
    }

    public function isUserPenalized(int $userId): bool {
        $row = $this->db->fetch(
            "SELECT id FROM penalty_config WHERE user_id = ? AND is_active = 1",
            [$userId]
        );
        return !empty($row);
    }

    public function addUser(int $userId, float $amount, int $adminId, string $note = ''): bool {
        try {
            $existing = $this->getConfigByUser($userId);
            if ($existing) {
                $this->db->execute(
                    "UPDATE penalty_config SET amount_per_late_task = ?, is_active = 1,
                     enabled_by_admin_id = ?, note = ?, updated_at = NOW()
                     WHERE user_id = ?",
                    [$amount, $adminId, $note, $userId]
                );
            } else {
                $this->db->execute(
                    "INSERT INTO penalty_config (user_id, amount_per_late_task, is_active, enabled_by_admin_id, note)
                     VALUES (?, ?, 1, ?, ?)",
                    [$userId, $amount, $adminId, $note]
                );
            }
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function updateAmount(int $userId, float $amount): bool {
        $this->db->execute(
            "UPDATE penalty_config SET amount_per_late_task = ?, updated_at = NOW() WHERE user_id = ?",
            [$amount, $userId]
        );
        return true;
    }

    public function removeUser(int $userId): bool {
        // Soft-disable: keep penalty_log history, just stop counting new penalties.
        $this->db->execute(
            "UPDATE penalty_config SET is_active = 0, updated_at = NOW() WHERE user_id = ?",
            [$userId]
        );
        return true;
    }

    public function toggleUser(int $userId, bool $active): bool {
        $this->db->execute(
            "UPDATE penalty_config SET is_active = ?, updated_at = NOW() WHERE user_id = ?",
            [(int)$active, $userId]
        );
        return true;
    }

    // ── Realtime penalty calculation ──────────────────────────────────────────

    /**
     * Returns currently-late tasks for a user (used when is_active = 1).
     *
     * A task is late when:
     *   (a) still open   AND due_date < today (PHP-side date, VN timezone)
     *   (b) completed    AND due_date < DATE(completed_at) in VN timezone
     *
     * Note: MySQL session timezone is set to +07:00 in Database::__construct()
     * so DATE(completed_at) is evaluated in VN time, not UTC.
     * $today is also PHP-calculated in APP_TIMEZONE (Asia/Ho_Chi_Minh).
     */
    public function getLateTasks(int $userId): array {
        $today = defined('APP_TIMEZONE')
            ? (new DateTime('now', new DateTimeZone(APP_TIMEZONE)))->format('Y-m-d')
            : date('Y-m-d');

        return $this->db->fetchAll("
            SELECT t.id, t.title, t.due_date, t.is_completed, t.completed_at,
                   t.status, t.priority,
                   p.name AS project_name, p.color AS project_color,
                   s.name AS store_name,
                   CASE
                     WHEN t.is_completed = 1
                       THEN DATEDIFF(DATE(t.completed_at), t.due_date)
                     ELSE DATEDIFF(?, t.due_date)
                   END AS late_days
            FROM tasks t
            LEFT JOIN projects p ON p.id = t.project_id
            LEFT JOIN stores   s ON s.id = p.store_id
            WHERE t.assignee_id = ?
              AND t.due_date IS NOT NULL
              AND t.due_date >= ?
              AND (
                  (t.is_completed = 0 AND t.due_date < ?)
                  OR
                  (t.is_completed = 1 AND t.completed_at IS NOT NULL AND t.due_date < DATE(t.completed_at))
              )
            ORDER BY t.due_date ASC
        ", [$today, $userId, self::PENALTY_RESET_DATE, $today]);
    }

    /**
     * Historical penalty total from penalty_log (used when is_active = 0).
     */
    private function getHistoricalTotal(int $userId): float {
        $row = $this->db->fetch(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM penalty_log WHERE user_id = ?",
            [$userId]
        );
        return (float)($row['total'] ?? 0);
    }

    /**
     * Calculate total penalty for one user.
     *
     * is_active = 1 → realtime: count current late tasks × current amount_per_late_task
     * is_active = 0 → historical: SUM(penalty_log.amount) — no new penalties counted
     */
    public function calcUserPenalty(int $userId): array {
        $config = $this->getConfigByUser($userId);
        if (!$config) {
            return ['total_amount' => 0.0, 'late_count' => 0, 'amount_per_task' => 0.0];
        }

        $perTask  = (float)$config['amount_per_late_task'];
        $isActive = (bool)(int)$config['is_active'];

        if (!$isActive) {
            return [
                'total_amount'    => $this->getHistoricalTotal($userId),
                'late_count'      => 0,
                'amount_per_task' => $perTask,
            ];
        }

        $lateTasks = $this->getLateTasks($userId);
        $count     = count($lateTasks);
        return [
            'total_amount'    => $count * $perTask,
            'late_count'      => $count,
            'amount_per_task' => $perTask,
        ];
    }

    /**
     * Full breakdown for a user: config + each late task with its penalty amount.
     *
     * is_active = 1 → realtime list of late tasks + realtime total
     * is_active = 0 → late_tasks = [] (no new penalties), total from penalty_log
     */
    public function getUserDetail(int $userId): array {
        $config = $this->getConfigByUser($userId);
        if (!$config) return [];

        $perTask  = (float)$config['amount_per_late_task'];
        $isActive = (bool)(int)$config['is_active'];

        if (!$isActive) {
            return [
                'config'       => $config,
                'late_tasks'   => [],
                'total_amount' => $this->getHistoricalTotal($userId),
                'late_count'   => 0,
            ];
        }

        $lateTasks   = $this->getLateTasks($userId);
        $tasks       = [];
        $totalAmount = 0.0;
        foreach ($lateTasks as $t) {
            $totalAmount += $perTask;
            $tasks[] = array_merge($t, ['penalty_amount' => $perTask]);
        }

        return [
            'config'       => $config,
            'late_tasks'   => $tasks,
            'total_amount' => $totalAmount,
            'late_count'   => count($tasks),
        ];
    }

    /**
     * Summary for all penalty users (for admin overview table).
     * Includes both active and inactive (to show historical totals).
     */
    public function getAllSummaries(): array {
        $configs = $this->getAllConfigs();
        $result  = [];
        foreach ($configs as $cfg) {
            $uid    = (int)$cfg['user_id'];
            $calc   = $this->calcUserPenalty($uid);
            $result[] = array_merge($cfg, [
                'late_count'   => $calc['late_count'],
                'total_amount' => $calc['total_amount'],
            ]);
        }
        return $result;
    }

    // ── Penalty log (audit sync) ──────────────────────────────────────────────

    /**
     * Sync penalty_log for one user:
     * - Upsert rows for currently-late tasks (update late_days/amount if changed)
     * - DELETE rows for tasks that are no longer late (deadline extended past today)
     *
     * Only runs for is_active = 1 users — inactive users keep their frozen log.
     *
     * @return array{upserted: int, deleted: int}
     */
    public function syncLog(int $userId): array {
        $config = $this->getConfigByUser($userId);
        if (!$config || !(bool)(int)$config['is_active']) {
            return ['upserted' => 0, 'deleted' => 0];
        }

        $lateTasks = $this->getLateTasks($userId);
        $perTask   = (float)$config['amount_per_late_task'];
        $lateIds   = array_map(fn($t) => (int)$t['id'], $lateTasks);
        $upserted  = 0;

        foreach ($lateTasks as $t) {
            $this->db->execute("
                INSERT INTO penalty_log (user_id, task_id, late_days, amount, calculated_at)
                VALUES (?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    late_days     = VALUES(late_days),
                    amount        = VALUES(amount),
                    calculated_at = NOW()
            ", [$userId, (int)$t['id'], max(0, (int)$t['late_days']), $perTask]);
            $upserted++;
        }

        // Remove stale rows: tasks whose deadline was extended past today
        $deleted = 0;
        if (empty($lateIds)) {
            $deleted = $this->db->execute(
                "DELETE FROM penalty_log WHERE user_id = ?",
                [$userId]
            );
        } else {
            $placeholders = implode(',', array_fill(0, count($lateIds), '?'));
            $deleted = $this->db->execute(
                "DELETE FROM penalty_log WHERE user_id = ? AND task_id NOT IN ({$placeholders})",
                array_merge([$userId], $lateIds)
            );
        }

        return ['upserted' => $upserted, 'deleted' => $deleted];
    }

    /**
     * Sync logs for all active penalty users.
     * Intended for daily cron (00:05 VN time).
     *
     * @return array{users: int, upserted: int, deleted: int}
     */
    public function syncAllLogs(): array {
        $configs  = $this->db->fetchAll(
            "SELECT user_id FROM penalty_config WHERE is_active = 1"
        );
        $totalUpserted = 0;
        $totalDeleted  = 0;

        foreach ($configs as $cfg) {
            $result        = $this->syncLog((int)$cfg['user_id']);
            $totalUpserted += $result['upserted'];
            $totalDeleted  += $result['deleted'];
        }

        return [
            'users'    => count($configs),
            'upserted' => $totalUpserted,
            'deleted'  => $totalDeleted,
        ];
    }

    // ── Formatting ────────────────────────────────────────────────────────────

    public static function format(float $amount, string $currency = 'VND'): string {
        if ($currency === 'USD') {
            return '$' . number_format($amount, 2);
        }
        return number_format($amount, 0, ',', '.') . 'đ';
    }

    // ── Risk scoring ──────────────────────────────────────────────────────────

    /**
     * Compute a simple 0-3 risk score for a user based on penalty_log history.
     * 0 = clean, 1 = low, 2 = medium, 3 = high
     */
    public function getUserRiskScore(int $userId): int {
        $row = $this->db->fetch(
            "SELECT COUNT(*) AS cnt, MAX(late_days) AS max_late
             FROM penalty_log
             WHERE user_id = ?
               AND calculated_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)",
            [$userId]
        );
        $cnt     = (int)($row['cnt']      ?? 0);
        $maxLate = (int)($row['max_late'] ?? 0);

        if ($cnt === 0)          return 0;
        if ($cnt >= 5 || $maxLate >= 14) return 3;
        if ($cnt >= 3 || $maxLate >= 7)  return 2;
        return 1;
    }

    // ── Admin penalties dashboard data ────────────────────────────────────────

    // Penalty system reset date: only count penalties from 2026-06-17 onwards
    const PENALTY_RESET_DATE = '2026-06-17';

    public function getAdminKpis(): array {
        $resetDate = self::PENALTY_RESET_DATE;
        $base = "FROM penalty_log pl WHERE pl.calculated_at >= '{$resetDate}'";
        $today = $this->db->fetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(pl.amount),0) AS vnd $base AND DATE(pl.calculated_at) = CURDATE()"
        );
        $week = $this->db->fetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(pl.amount),0) AS vnd $base AND YEARWEEK(pl.calculated_at,1) = YEARWEEK(CURDATE(),1)"
        );
        // This month (June 2026)
        $month = $this->db->fetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(pl.amount),0) AS vnd $base AND YEAR(pl.calculated_at)=YEAR(CURDATE()) AND MONTH(pl.calculated_at)=MONTH(CURDATE())"
        );
        // Last month (May 2026)
        $lastMonth = $this->db->fetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(pl.amount),0) AS vnd
             FROM penalty_log pl
             WHERE pl.calculated_at >= '{$resetDate}'
               AND YEAR(pl.calculated_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
               AND MONTH(pl.calculated_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))"
        );
        $topUser = $this->db->fetch(
            "SELECT u.name, COUNT(*) AS cnt
             FROM penalty_log pl JOIN users u ON u.id = pl.user_id
             WHERE pl.calculated_at >= '{$resetDate}'
               AND YEAR(pl.calculated_at)=YEAR(CURDATE()) AND MONTH(pl.calculated_at)=MONTH(CURDATE())
             GROUP BY pl.user_id ORDER BY cnt DESC LIMIT 1"
        );
        // This week (Mon–Sun) total
        $weekTotal = $this->db->fetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(pl.amount),0) AS vnd
             FROM penalty_log pl
             WHERE pl.calculated_at >= '{$resetDate}'
               AND YEARWEEK(pl.calculated_at,1) = YEARWEEK(CURDATE(),1)"
        );
        // Year to date
        $yearTotal = $this->db->fetch(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(pl.amount),0) AS vnd
             FROM penalty_log pl
             WHERE pl.calculated_at >= '{$resetDate}'
               AND YEAR(pl.calculated_at) = YEAR(CURDATE())"
        );
        return [
            'today'       => ['cnt' => (int)($today['cnt']    ?? 0), 'vnd' => (float)($today['vnd']    ?? 0)],
            'week'        => ['cnt' => (int)($weekTotal['cnt']?? 0), 'vnd' => (float)($weekTotal['vnd']?? 0)],
            'month'       => ['cnt' => (int)($month['cnt']     ?? 0), 'vnd' => (float)($month['vnd']    ?? 0)],
            'last_month'  => ['cnt' => (int)($lastMonth['cnt']  ?? 0), 'vnd' => (float)($lastMonth['vnd']?? 0)],
            'year'        => ['cnt' => (int)($yearTotal['cnt']  ?? 0), 'vnd' => (float)($yearTotal['vnd'] ?? 0)],
            'top_user'    => $topUser ?: null,
        ];
    }

    public function getPaginatedLog(array $filters, int $page, int $perPage = 25): array {
        [$where, $params] = $this->buildPeriodWhere($filters, 'pl.calculated_at');

        $countRow = $this->db->fetch(
            "SELECT COUNT(*) AS cnt FROM penalty_log pl $where", $params
        );
        $total = (int)($countRow['cnt'] ?? 0);

        $sortMap = [
            'created_at'    => 'pl.calculated_at',
            'user'          => 'u.name',
            'store'         => 's.name',
            'overdue_days'  => 'pl.late_days',
            'penalty_amount'=> 'pl.amount',
        ];
        $sortCol = $sortMap[$filters['sort'] ?? ''] ?? 'pl.calculated_at';
        $sortDir = ($filters['dir'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';
        $offset  = ($page - 1) * $perPage;

        $rows = $this->db->fetchAll(
            "SELECT pl.id, pl.user_id, pl.task_id, pl.late_days AS overdue_days,
                    pl.amount AS penalty_amount, 'VND' AS penalty_currency,
                    pl.calculated_at AS created_at,
                    u.name AS user_name,
                    t.title AS task_title,
                    p.name AS project_name, p.color AS project_color,
                    s.name AS store_name,
                    'Task overdue' AS reason
             FROM penalty_log pl
             JOIN users u    ON u.id = pl.user_id
             JOIN tasks t    ON t.id = pl.task_id
             LEFT JOIN projects p ON p.id = t.project_id
             LEFT JOIN stores s  ON s.id = p.store_id
             $where
             ORDER BY $sortCol $sortDir
             LIMIT $perPage OFFSET $offset",
            $params
        );

        return ['rows' => $rows, 'total' => $total];
    }

    public function getByUser(array $filters): array {
        [$where, $params] = $this->buildPeriodWhere($filters, 'pl.calculated_at');
        return $this->db->fetchAll(
            "SELECT u.id, u.name, COUNT(*) AS penalty_count,
                    COALESCE(SUM(pl.amount),0) AS total_vnd, 0 AS total_usd,
                    MAX(pl.late_days) AS max_overdue,
                    MAX(pl.calculated_at) AS last_penalty_at
             FROM penalty_log pl
             JOIN users u ON u.id = pl.user_id
             $where
             GROUP BY u.id ORDER BY penalty_count DESC LIMIT 50",
            $params
        );
    }

    public function getByProject(array $filters): array {
        [$where, $params] = $this->buildPeriodWhere($filters, 'pl.calculated_at');
        return $this->db->fetchAll(
            "SELECT p.id, p.name, p.color, COUNT(*) AS penalty_count,
                    COALESCE(SUM(pl.amount),0) AS total_vnd, 0 AS total_usd
             FROM penalty_log pl
             JOIN tasks t ON t.id = pl.task_id
             JOIN projects p ON p.id = t.project_id
             $where
             GROUP BY p.id ORDER BY penalty_count DESC LIMIT 50",
            $params
        );
    }

    public function getByStore(array $filters): array {
        [$where, $params] = $this->buildPeriodWhere($filters, 'pl.calculated_at');
        return $this->db->fetchAll(
            "SELECT s.id, s.name, s.color, COUNT(*) AS penalty_count,
                    COALESCE(SUM(pl.amount),0) AS total_vnd, 0 AS total_usd
             FROM penalty_log pl
             JOIN tasks t ON t.id = pl.task_id
             LEFT JOIN projects p ON p.id = t.project_id
             LEFT JOIN stores s ON s.id = p.store_id
             $where
             GROUP BY s.id ORDER BY penalty_count DESC LIMIT 30",
            $params
        );
    }

    private function buildPeriodWhere(array $filters, string $col): array {
        $period = $filters['period'] ?? 'month';
        $where  = 'WHERE 1=1';
        $params = [];

        switch ($period) {
            case 'today':
                $where .= " AND DATE($col) = CURDATE()"; break;
            case 'week':
                $where .= " AND YEARWEEK($col,1) = YEARWEEK(CURDATE(),1)"; break;
            case 'year':
                $where .= " AND YEAR($col) = YEAR(CURDATE())"; break;
            case 'custom':
                if (!empty($filters['date_from'])) { $where .= " AND DATE($col) >= ?"; $params[] = $filters['date_from']; }
                if (!empty($filters['date_to']))   { $where .= " AND DATE($col) <= ?"; $params[] = $filters['date_to'];   }
                break;
            default: // month
                $where .= " AND YEAR($col)=YEAR(CURDATE()) AND MONTH($col)=MONTH(CURDATE())";
        }

        if (!empty($filters['user_id'])) {
            $where .= " AND pl.user_id = ?";
            $params[] = (int)$filters['user_id'];
        }

        return [$where, $params];
    }

    // ── User: own penalty summary ─────────────────────────────────────────────

    public function getMyPenaltySummary(int $userId): array {
        $points = function(string $interval) use ($userId): float {
            $row = $this->db->fetch(
                "SELECT COALESCE(SUM(amount),0) AS total FROM penalty_log WHERE user_id = ? AND calculated_at >= DATE_SUB(NOW(), INTERVAL $interval)",
                [$userId]
            );
            return (float)($row['total'] ?? 0);
        };

        $lateTasks  = $this->getLateTasks($userId);
        $history    = $this->db->fetchAll(
            "SELECT pl.*, t.title AS task_title, t.due_date,
                    p.name AS project_name, s.name AS store_name
             FROM penalty_log pl
             JOIN tasks t ON t.id = pl.task_id
             LEFT JOIN projects p ON p.id = t.project_id
             LEFT JOIN stores s ON s.id = p.store_id
             WHERE pl.user_id = ?
             ORDER BY pl.calculated_at DESC LIMIT 60",
            [$userId]
        );

        return [
            'points_30d'  => $points('30 DAY'),
            'points_90d'  => $points('90 DAY'),
            'points_12m'  => $points('365 DAY'),
            'open'        => $lateTasks,
            'resolved'    => array_filter($history, fn($r) => $r['late_days'] > 0),
            'history'     => $history,
        ];
    }

    // ── Manager: store penalty dashboard ─────────────────────────────────────

    public function getManagerDashboard(int $userId): array {
        // Stores managed by this user (manager_id = userId on stores table)
        $stores = $this->db->fetchAll(
            "SELECT id, name FROM stores WHERE manager_id = ?",
            [$userId]
        );
        if (empty($stores)) {
            // Fallback: user's own store_id
            $u = $this->db->fetch("SELECT store_id FROM users WHERE id=?", [$userId]);
            if (!empty($u['store_id'])) {
                $storeRow = $this->db->fetch("SELECT id, name FROM stores WHERE id=?", [$u['store_id']]);
                if ($storeRow) $stores = [$storeRow];
            }
        }
        $storeIds = array_column($stores, 'id');

        $memberPenalties = [];
        $storeSummaries  = [];

        foreach ($storeIds as $sid) {
            $memberRows = $this->db->fetchAll(
                "SELECT u.id, u.name, COUNT(pl.id) AS penalty_count,
                        COALESCE(SUM(pl.amount),0) AS total_vnd,
                        MAX(pl.late_days) AS max_overdue
                 FROM users u
                 LEFT JOIN penalty_log pl ON pl.user_id = u.id
                   AND YEAR(pl.calculated_at)=YEAR(CURDATE())
                   AND MONTH(pl.calculated_at)=MONTH(CURDATE())
                 WHERE u.store_id = ?
                 GROUP BY u.id ORDER BY penalty_count DESC",
                [$sid]
            );
            $storeName = '';
            foreach ($stores as $s) { if ($s['id'] === $sid) { $storeName = $s['name']; break; } }
            $storeSummaries[] = [
                'store_id'      => $sid,
                'store_name'    => $storeName,
                'penalty_count' => array_sum(array_column($memberRows, 'penalty_count')),
                'total_vnd'     => array_sum(array_column($memberRows, 'total_vnd')),
                'members'       => count($memberRows),
            ];
            foreach ($memberRows as $m) { $m['store_name'] = $storeName; $memberPenalties[] = $m; }
        }

        return [
            'stores'          => $stores,
            'store_summaries' => $storeSummaries,
            'members'         => $memberPenalties,
        ];
    }

    // ── CEO: org accountability ───────────────────────────────────────────────

    public function getOrgAccountability(): array {
        $totalUsers = (int)($this->db->fetch("SELECT COUNT(*) AS c FROM users WHERE is_active=1")['c'] ?? 0);
        $penalized30d = (int)($this->db->fetch(
            "SELECT COUNT(DISTINCT user_id) AS c FROM penalty_log WHERE calculated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
        )['c'] ?? 0);

        $score = $totalUsers > 0 ? max(0, round(100 - ($penalized30d / $totalUsers) * 100)) : 100;

        $trend = $this->db->fetchAll(
            "SELECT DATE_FORMAT(calculated_at,'%Y-%m') AS month,
                    COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS vnd
             FROM penalty_log
             WHERE calculated_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
             GROUP BY month ORDER BY month ASC"
        );

        $highRiskUsers = $this->db->fetchAll(
            "SELECT u.id, u.name, COUNT(pl.id) AS cnt, MAX(pl.late_days) AS max_late,
                    COALESCE(SUM(pl.amount),0) AS total_vnd, s.name AS store_name
             FROM penalty_log pl
             JOIN users u ON u.id = pl.user_id
             LEFT JOIN stores s ON s.id = u.store_id
             WHERE pl.calculated_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
             GROUP BY u.id HAVING cnt >= 3 ORDER BY cnt DESC LIMIT 10"
        );

        $highRiskStores = $this->db->fetchAll(
            "SELECT s.id, s.name, COUNT(pl.id) AS cnt, COALESCE(SUM(pl.amount),0) AS total_vnd
             FROM penalty_log pl
             JOIN tasks t ON t.id = pl.task_id
             LEFT JOIN projects p ON p.id = t.project_id
             LEFT JOIN stores s ON s.id = p.store_id
             WHERE pl.calculated_at >= DATE_SUB(NOW(), INTERVAL 90 DAY) AND s.id IS NOT NULL
             GROUP BY s.id HAVING cnt >= 3 ORDER BY cnt DESC LIMIT 10"
        );

        $repeated = $this->db->fetchAll(
            "SELECT u.id, u.name, COUNT(DISTINCT pl.task_id) AS violations,
                    MAX(pl.calculated_at) AS last_at, s.name AS store_name
             FROM penalty_log pl
             JOIN users u ON u.id = pl.user_id
             LEFT JOIN stores s ON s.id = u.store_id
             GROUP BY u.id HAVING violations >= 2 ORDER BY violations DESC LIMIT 10"
        );

        return [
            'accountability_score' => $score,
            'total_users'          => $totalUsers,
            'penalized_30d'        => $penalized30d,
            'trend'                => $trend,
            'high_risk_users'      => $highRiskUsers,
            'high_risk_stores'     => $highRiskStores,
            'repeated_violations'  => $repeated,
        ];
    }
}
