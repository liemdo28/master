<?php
class DeadlineExtension {
    private $db;

    const MAX_SELF_DAYS = 3;    // ≤ +3 days = auto-approved
    const MAX_MONTHLY   = 5;    // max extensions per user per month

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema(): void {
        if (defined('SKIP_SCHEMA_CHECKS') && SKIP_SCHEMA_CHECKS) return;
        if (!$this->db->tableExists('deadline_extensions')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS deadline_extensions (
                    id            INT AUTO_INCREMENT PRIMARY KEY,
                    task_id       INT           NOT NULL,
                    user_id       INT           NOT NULL,
                    old_deadline  DATE          NOT NULL,
                    new_deadline  DATE          NOT NULL,
                    type          ENUM('self','request') NOT NULL,
                    status        ENUM('auto_approved','pending','approved','rejected') NOT NULL DEFAULT 'pending',
                    reason        TEXT          NULL,
                    reject_reason TEXT          NULL,
                    approved_by   INT           NULL,
                    approved_at   DATETIME      NULL,
                    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (task_id)     REFERENCES tasks(id)  ON DELETE CASCADE,
                    FOREIGN KEY (user_id)     REFERENCES users(id)  ON DELETE CASCADE,
                    FOREIGN KEY (approved_by) REFERENCES users(id)  ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        } else {
            // Add columns that were introduced after the initial table creation.
            // These are all nullable so they are safe to add to tables with existing rows.
            if (!$this->db->columnExists('deadline_extensions', 'approved_by')) {
                $this->db->execute("ALTER TABLE deadline_extensions ADD COLUMN approved_by INT NULL DEFAULT NULL");
                // Add FK separately — ALTER TABLE with both ADD COLUMN and ADD CONSTRAINT can fail on some MySQL versions
                try {
                    $this->db->execute("ALTER TABLE deadline_extensions ADD CONSTRAINT fk_de_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL");
                } catch (\Throwable $e) {
                    // FK may already exist or be unsupported; column presence is what matters
                }
            }
            if (!$this->db->columnExists('deadline_extensions', 'approved_at')) {
                $this->db->execute("ALTER TABLE deadline_extensions ADD COLUMN approved_at DATETIME NULL DEFAULT NULL");
            }
            if (!$this->db->columnExists('deadline_extensions', 'reject_reason')) {
                $this->db->execute("ALTER TABLE deadline_extensions ADD COLUMN reject_reason TEXT NULL");
            }
        }
        if (!$this->db->tableExists('monthly_extension_usage')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS monthly_extension_usage (
                    id              INT AUTO_INCREMENT PRIMARY KEY,
                    user_id         INT        NOT NULL,
                    month           VARCHAR(7) NOT NULL,
                    extension_count INT        NOT NULL DEFAULT 0,
                    updated_at      TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_usage_user_month (user_id, month),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
    }

    // ── Monthly limit ─────────────────────────────────────────────

    public function getMonthlyUsage(int $userId): array {
        $month = $this->currentMonth();
        $row = $this->db->fetch(
            "SELECT extension_count FROM monthly_extension_usage WHERE user_id = ? AND month = ?",
            [$userId, $month]
        );
        $used = (int)($row['extension_count'] ?? 0);
        return [
            'used'      => $used,
            'remaining' => max(0, self::MAX_MONTHLY - $used),
            'limit'     => self::MAX_MONTHLY,
            'month'     => $month,
        ];
    }

    public function checkMonthlyLimit(int $userId): bool {
        return $this->getMonthlyUsage($userId)['remaining'] > 0;
    }

    // Uses SELECT … FOR UPDATE inside a transaction to prevent race conditions
    // where two concurrent requests both pass the limit check simultaneously.
    private function checkAndIncrementUsage(int $userId): bool {
        $month = $this->currentMonth();
        $pdo   = $this->db->getConnection();
        $pdo->beginTransaction();
        try {
            $row = $this->db->fetch(
                "SELECT extension_count FROM monthly_extension_usage
                 WHERE user_id = ? AND month = ? FOR UPDATE",
                [$userId, $month]
            );
            if ($row && (int)$row['extension_count'] >= self::MAX_MONTHLY) {
                $pdo->rollBack();
                return false;
            }
            $this->db->execute(
                "INSERT INTO monthly_extension_usage (user_id, month, extension_count)
                 VALUES (?, ?, 1)
                 ON DUPLICATE KEY UPDATE extension_count = extension_count + 1",
                [$userId, $month]
            );
            $pdo->commit();
            return true;
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // ── Core operations ───────────────────────────────────────────

    /**
     * Attempt a self-extension (≤ +3 days from current deadline).
     * Returns ['ok'=>true, 'extension'=>[...]] or ['ok'=>false, 'error'=>'...']
     */
    public function selfExtend(int $taskId, int $userId, string $newDeadline): array {
        $task = $this->loadTask($taskId);
        if (!$task)        return ['ok' => false, 'error' => 'Task not found'];
        if ($task['is_completed']) return ['ok' => false, 'error' => 'Cannot extend a completed task'];
        if (empty($task['due_date'])) return ['ok' => false, 'error' => 'Task has no current deadline'];

        // Validate ownership/assignment
        if (!$this->canUserExtend($task, $userId)) {
            return ['ok' => false, 'error' => 'Not authorised to extend this task'];
        }

        // Validate ≤ +3 days
        $oldTs  = strtotime($task['due_date']);
        $newTs  = strtotime($newDeadline);
        $maxTs  = $oldTs + (self::MAX_SELF_DAYS * 86400);
        if ($newTs > $maxTs) {
            return ['ok' => false, 'error' => 'Self-extension is limited to +3 days. Use extend-request for longer extensions.'];
        }
        if ($newTs <= $oldTs) {
            return ['ok' => false, 'error' => 'New deadline must be after the current deadline'];
        }

        // Monthly limit (transactional check + increment)
        if (!$this->checkAndIncrementUsage($userId)) {
            return ['ok' => false, 'error' => "Monthly extension limit reached (max " . self::MAX_MONTHLY . " per month)"];
        }

        // Update task deadline
        $this->db->execute("UPDATE tasks SET due_date = ?, updated_at = NOW() WHERE id = ?",
            [$newDeadline, $taskId]);

        // Audit record
        $extId = $this->db->insert(
            "INSERT INTO deadline_extensions
                (task_id, user_id, old_deadline, new_deadline, type, status)
             VALUES (?, ?, ?, ?, 'self', 'auto_approved')",
            [$taskId, $userId, $task['due_date'], $newDeadline]
        );

        // Sync penalty
        $this->syncPenalty($taskId, $task['due_date'], $newDeadline);

        return ['ok' => true, 'extension_id' => $extId, 'new_deadline' => $newDeadline];
    }

    /**
     * Create an extension request (> +3 days). Requires manager/admin approval.
     */
    public function requestExtend(int $taskId, int $userId, string $newDeadline, string $reason): array {
        $task = $this->loadTask($taskId);
        if (!$task)        return ['ok' => false, 'error' => 'Task not found'];
        if ($task['is_completed']) return ['ok' => false, 'error' => 'Cannot extend a completed task'];
        if (empty($task['due_date'])) return ['ok' => false, 'error' => 'Task has no current deadline'];

        if (!$this->canUserExtend($task, $userId)) {
            return ['ok' => false, 'error' => 'Not authorised to extend this task'];
        }

        $oldTs = strtotime($task['due_date']);
        $newTs = strtotime($newDeadline);
        if ($newTs <= $oldTs) {
            return ['ok' => false, 'error' => 'New deadline must be after the current deadline'];
        }

        // Validate that this is truly a >+3 day request (self-extend should have been used otherwise)
        $maxSelfTs = $oldTs + (self::MAX_SELF_DAYS * 86400);
        if ($newTs <= $maxSelfTs) {
            return ['ok' => false, 'error' => 'This extension is within +3 days — use the self-extend endpoint instead'];
        }

        // Check monthly limit (read-only — do NOT increment until approved)
        if (!$this->checkMonthlyLimit($userId)) {
            return ['ok' => false, 'error' => "Monthly extension limit reached (max " . self::MAX_MONTHLY . " per month)"];
        }

        // Prevent duplicate pending request on the same task
        $existing = $this->db->fetch(
            "SELECT id FROM deadline_extensions WHERE task_id = ? AND user_id = ? AND status = 'pending'",
            [$taskId, $userId]
        );
        if ($existing) {
            return ['ok' => false, 'error' => 'A pending extension request already exists for this task'];
        }

        if (trim($reason) === '') {
            return ['ok' => false, 'error' => 'Reason is required for requests exceeding +3 days'];
        }

        $extId = $this->db->insert(
            "INSERT INTO deadline_extensions
                (task_id, user_id, old_deadline, new_deadline, type, status, reason)
             VALUES (?, ?, ?, ?, 'request', 'pending', ?)",
            [$taskId, $userId, $task['due_date'], $newDeadline, trim($reason)]
        );

        // Notify managers/admins
        $this->notifyManagers($task, $userId, $newDeadline, $reason);

        return ['ok' => true, 'extension_id' => $extId, 'status' => 'pending'];
    }

    /**
     * Admin approves a pending extension request.
     */
    public function approve(int $extensionId, int $adminId): array {
        $ext = $this->loadExtension($extensionId);
        if (!$ext) return ['ok' => false, 'error' => 'Extension not found'];
        if ($ext['status'] !== 'pending') return ['ok' => false, 'error' => 'Only pending requests can be approved'];

        $task = $this->loadTask((int)$ext['task_id']);
        if (!$task) return ['ok' => false, 'error' => 'Task not found'];

        // Check requester still has monthly capacity (increment on approval)
        if (!$this->checkAndIncrementUsage((int)$ext['user_id'])) {
            return ['ok' => false, 'error' => 'User has reached their monthly extension limit'];
        }

        // Mark approved
        $this->db->execute(
            "UPDATE deadline_extensions
             SET status = 'approved', approved_by = ?, approved_at = NOW(), updated_at = NOW()
             WHERE id = ?",
            [$adminId, $extensionId]
        );

        // Update task deadline
        $this->db->execute("UPDATE tasks SET due_date = ?, updated_at = NOW() WHERE id = ?",
            [$ext['new_deadline'], $ext['task_id']]);

        // Sync penalty
        $this->syncPenalty((int)$ext['task_id'], $ext['old_deadline'], $ext['new_deadline']);

        // Notify requester
        notifyUser([
            'user_id'      => $ext['user_id'],
            'type'         => 'extension_approved',
            'title'        => 'Extension request approved',
            'message'      => "Your deadline extension for \"{$task['title']}\" to {$ext['new_deadline']} was approved.",
            'task_id'      => $ext['task_id'],
            'from_user_id' => $adminId,
        ]);

        return ['ok' => true];
    }

    /**
     * Admin rejects a pending extension request.
     */
    public function reject(int $extensionId, int $adminId, string $rejectReason): array {
        $ext = $this->loadExtension($extensionId);
        if (!$ext) return ['ok' => false, 'error' => 'Extension not found'];
        if ($ext['status'] !== 'pending') return ['ok' => false, 'error' => 'Only pending requests can be rejected'];

        $task = $this->loadTask((int)$ext['task_id']);

        $this->db->execute(
            "UPDATE deadline_extensions
             SET status = 'rejected', reject_reason = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW()
             WHERE id = ?",
            [trim($rejectReason), $adminId, $extensionId]
        );

        // Monthly count is NOT incremented on rejection (per spec)
        notifyUser([
            'user_id'      => $ext['user_id'],
            'type'         => 'extension_rejected',
            'title'        => 'Extension request rejected',
            'message'      => "Your deadline extension request for \"{$task['title']}\" was rejected. Reason: {$rejectReason}",
            'task_id'      => $ext['task_id'],
            'from_user_id' => $adminId,
        ]);

        return ['ok' => true];
    }

    // ── Penalty sync ──────────────────────────────────────────────

    /**
     * Targeted penalty sync for one task after a deadline change.
     *
     * Rules:
     *   - Task not overdue under new deadline → remove penalty_log row
     *   - Task still overdue → update penalty_log with recalculated late_days
     *   - No duplicate rows — penalty_log has UNIQUE KEY on (user_id, task_id)
     */
    public function syncPenalty(int $taskId, string $oldDeadline, string $newDeadline): void {
        $task = $this->db->fetch(
            "SELECT assignee_id, is_completed, completed_at FROM tasks WHERE id = ?",
            [$taskId]
        );
        if (!$task || !$task['assignee_id']) return;

        $userId = (int)$task['assignee_id'];
        $config = $this->db->fetch(
            "SELECT amount_per_late_task FROM penalty_config WHERE user_id = ? AND is_active = 1",
            [$userId]
        );
        if (!$config) return;

        $perTask = (float)$config['amount_per_late_task'];
        $today   = (new \DateTime('now', new \DateTimeZone(defined('APP_TIMEZONE') ? APP_TIMEZONE : 'UTC')))->format('Y-m-d');

        if ((bool)(int)$task['is_completed']) {
            // Completed task: late if completed_at > new_deadline (VN timezone, set in DB session)
            $row = $this->db->fetch(
                "SELECT DATEDIFF(DATE(completed_at), ?) AS late_days FROM tasks WHERE id = ?",
                [$newDeadline, $taskId]
            );
            $lateDays = (int)($row['late_days'] ?? 0);
            if ($lateDays <= 0) {
                $this->db->execute(
                    "DELETE FROM penalty_log WHERE user_id = ? AND task_id = ?",
                    [$userId, $taskId]
                );
            } else {
                $this->db->execute(
                    "INSERT INTO penalty_log (user_id, task_id, late_days, amount, calculated_at)
                     VALUES (?, ?, ?, ?, NOW())
                     ON DUPLICATE KEY UPDATE
                         late_days = VALUES(late_days), amount = VALUES(amount), calculated_at = NOW()",
                    [$userId, $taskId, $lateDays, $perTask]
                );
            }
        } else {
            // Open task: late if new_deadline < today
            if ($newDeadline >= $today) {
                $this->db->execute(
                    "DELETE FROM penalty_log WHERE user_id = ? AND task_id = ?",
                    [$userId, $taskId]
                );
            } else {
                $d1 = new \DateTime($today);
                $d2 = new \DateTime($newDeadline);
                $lateDays = max(1, (int)$d1->diff($d2)->days);
                $this->db->execute(
                    "INSERT INTO penalty_log (user_id, task_id, late_days, amount, calculated_at)
                     VALUES (?, ?, ?, ?, NOW())
                     ON DUPLICATE KEY UPDATE
                         late_days = VALUES(late_days), amount = VALUES(amount), calculated_at = NOW()",
                    [$userId, $taskId, $lateDays, $perTask]
                );
            }
        }
    }

    // ── Queries ───────────────────────────────────────────────────

    public function getPendingRequests(): array {
        try {
            return $this->db->fetchAll("
                SELECT de.*,
                       t.title  AS task_title,  t.due_date AS current_deadline,
                       u.name   AS user_name,   u.email    AS user_email,
                       p.name   AS project_name
                FROM deadline_extensions de
                JOIN tasks    t ON t.id = de.task_id
                JOIN users    u ON u.id = de.user_id
                LEFT JOIN projects p ON p.id = t.project_id
                WHERE de.status = 'pending'
                ORDER BY de.created_at ASC
            ");
        } catch (\Throwable $e) {
            error_log('DeadlineExtension::getPendingRequests error: ' . $e->getMessage());
            return [];
        }
    }

    public function getAllForAdmin(int $limit = 200): array {
        try {
            return $this->db->fetchAll("
                SELECT de.*,
                       t.title  AS task_title,
                       u.name   AS user_name,
                       a.name   AS approver_name,
                       p.name   AS project_name
                FROM deadline_extensions de
                JOIN tasks    t ON t.id = de.task_id
                JOIN users    u ON u.id = de.user_id
                LEFT JOIN users    a ON a.id = de.approved_by
                LEFT JOIN projects p ON p.id = t.project_id
                ORDER BY de.created_at DESC
                LIMIT {$limit}
            ");
        } catch (\Throwable $e) {
            error_log('DeadlineExtension::getAllForAdmin error: ' . $e->getMessage());
            return [];
        }
    }

    public function getForTask(int $taskId): array {
        try {
            return $this->db->fetchAll("
                SELECT de.*, u.name AS user_name, a.name AS approver_name
                FROM deadline_extensions de
                JOIN users u ON u.id = de.user_id
                LEFT JOIN users a ON a.id = de.approved_by
                WHERE de.task_id = ?
                ORDER BY de.created_at DESC
            ", [$taskId]);
        } catch (\Throwable $e) {
            error_log('DeadlineExtension::getForTask error: ' . $e->getMessage());
            return [];
        }
    }

    public function getPendingCount(): int {
        $row = $this->db->fetch("SELECT COUNT(*) AS n FROM deadline_extensions WHERE status = 'pending'");
        return (int)($row['n'] ?? 0);
    }

    // ── Helpers ───────────────────────────────────────────────────

    private function loadTask(int $taskId): ?array {
        return $this->db->fetch(
            "SELECT t.*, p.name AS project_name FROM tasks t
             LEFT JOIN projects p ON p.id = t.project_id
             WHERE t.id = ?",
            [$taskId]
        ) ?: null;
    }

    private function loadExtension(int $id): ?array {
        return $this->db->fetch("SELECT * FROM deadline_extensions WHERE id = ?", [$id]) ?: null;
    }

    private function canUserExtend(array $task, int $userId): bool {
        // Assignee, creator, or admin can extend
        if ((int)$task['assignee_id'] === $userId) return true;
        if ((int)$task['created_by']  === $userId) return true;
        $user = $this->db->fetch("SELECT role FROM users WHERE id = ?", [$userId]);
        return $user && in_array($user['role'], ['admin', 'manager']);
    }

    private function notifyManagers(array $task, int $requesterId, string $newDeadline, string $reason): void {
        $managers = $this->db->fetchAll(
            "SELECT id FROM users WHERE role IN ('admin','manager') AND is_active = 1 AND id <> ?",
            [$requesterId]
        );
        $requester = $this->db->fetch("SELECT name FROM users WHERE id = ?", [$requesterId]);
        $name = $requester['name'] ?? 'Someone';
        foreach ($managers as $m) {
            notifyUser([
                'user_id'      => $m['id'],
                'type'         => 'extension_request',
                'title'        => 'Deadline extension request',
                'message'      => "{$name} requested a deadline extension for \"{$task['title']}\" to {$newDeadline}. Reason: {$reason}",
                'task_id'      => $task['id'],
                'from_user_id' => $requesterId,
            ]);
        }
    }

    private function currentMonth(): string {
        return (new \DateTime('now', new \DateTimeZone(defined('APP_TIMEZONE') ? APP_TIMEZONE : 'UTC')))->format('Y-m');
    }
}
