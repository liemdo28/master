<?php
/**
 * OverdueResolverService — single source of truth for overdue calculations.
 *
 * All overdue counters and lists MUST use this class so the number a user
 * sees on any counter exactly matches the list they see when they click it.
 *
 * Role-aware:
 *   admin / ceo  → all users, all projects
 *   manager      → projects they own or are member of
 *   member       → only their assigned tasks / bills
 */
class OverdueResolverService
{
    private $db;
    private $today;

    public function __construct()
    {
        $this->db    = Database::getInstance();
        $this->today = app_today();
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Returns ['tasks' => N, 'bills' => N, 'total' => N]
     */
    public function counts(?int $userId, string $role): array
    {
        if (!$userId) {
            error_log('[OverdueResolverService] counts() called with null userId — returning zeros');
            return ['tasks' => 0, 'bills' => 0, 'total' => 0];
        }
        $tasks = $this->overdueTaskCount($userId, $role);
        $bills = $this->overdueBillCount($userId, $role);
        return [
            'tasks' => $tasks,
            'bills' => $bills,
            'total' => $tasks + $bills,
        ];
    }

    /**
     * Returns the overdue task rows (same filter as counts()).
     */
    public function tasks(int $userId, string $role, int $limit = 100): array
    {
        [$where, $params] = $this->taskWhereClause($userId, $role);
        $visibilitySelect = $this->db->columnExists('tasks', 'visibility')
            ? 't.visibility'
            : "'public' AS visibility";
        return $this->db->fetchAll(
            "SELECT t.id, t.title, t.due_date, t.priority, t.status, {$visibilitySelect},
                    p.name AS project_name, p.color AS project_color,
                    u.name AS assignee_name, s.name AS store_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores   s ON p.store_id   = s.id
             LEFT JOIN users    u ON t.assignee_id = u.id
             WHERE t.is_completed = 0 AND t.due_date < DATE_SUB(?, INTERVAL 7 DAY) {$where}
             ORDER BY t.due_date ASC
             LIMIT {$limit}",
            array_merge([$this->today], $params)
        );
    }

    /**
     * Returns overdue bill rows (same filter as counts()).
     */
    public function bills(int $userId, string $role, int $limit = 100): array
    {
        [$where, $params] = $this->billWhereClause($userId, $role);
        return $this->db->fetchAll(
            "SELECT b.id, b.title, b.due_date, b.amount, b.currency, b.status,
                    s.name AS store_name, v.name AS vendor_name
             FROM bills b
             LEFT JOIN stores  s ON b.store_id  = s.id
             LEFT JOIN vendors v ON b.vendor_id = v.id
             WHERE (b.status = 'overdue' OR (b.status = 'pending' AND b.due_date < ?)) {$where}
             ORDER BY b.due_date ASC
             LIMIT {$limit}",
            array_merge([$this->today], $params)
        );
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private function overdueTaskCount(int $userId, string $role): int
    {
        [$where, $params] = $this->taskWhereClause($userId, $role);
        $row = $this->db->fetch(
            "SELECT COUNT(*) AS c FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.is_completed = 0 AND t.due_date < DATE_SUB(?, INTERVAL 7 DAY) {$where}",
            array_merge([$this->today], $params)
        );
        return (int)($row['c'] ?? 0);
    }

    private function overdueBillCount(int $userId, string $role): int
    {
        [$where, $params] = $this->billWhereClause($userId, $role);
        $row = $this->db->fetch(
            "SELECT COUNT(*) AS c FROM bills b
             WHERE (b.status = 'overdue' OR (b.status = 'pending' AND b.due_date < ?)) {$where}",
            array_merge([$this->today], $params)
        );
        return (int)($row['c'] ?? 0);
    }

    /**
     * Returns [WHERE_fragment, params] for tasks based on role.
     * admin/ceo = all, manager = their projects, member = assigned to them.
     */
    private function taskWhereClause(int $userId, string $role): array
    {
        if (in_array($role, ['admin', 'ceo'])) {
            return ['', []];
        }
        if ($role === 'manager') {
            return [
                'AND (t.assignee_id = ? OR p.owner_id = ? OR EXISTS (
                    SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = ?
                ))',
                [$userId, $userId, $userId],
            ];
        }
        // member — only directly assigned
        return ['AND t.assignee_id = ?', [$userId]];
    }

    private function billWhereClause(int $userId, string $role): array
    {
        if (in_array($role, ['admin', 'ceo'])) {
            return ['', []];
        }
        // managers and members see bills for their store
        return [
            'AND EXISTS (
                SELECT 1 FROM projects p2
                JOIN project_members pm ON pm.project_id = p2.id
                WHERE p2.store_id = b.store_id AND pm.user_id = ?
            )',
            [$userId],
        ];
    }
}
