<?php
/**
 * OverallStore Model
 * Provides aggregated data for the Overall Store Dashboard.
 *
 * Calculates per-store health, task metrics, bill metrics,
 * and determines card color (green/yellow/red/gray) based on risk.
 */

require_once __DIR__ . '/../config/database.php';

class OverallStore {

    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema() {
        try {
            if (!$this->db->tableExists('store_manager_assignments')) {
                $this->db->execute("
                    CREATE TABLE IF NOT EXISTS store_manager_assignments (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        store_id INT NOT NULL,
                        user_id INT NOT NULL,
                        assignment_role VARCHAR(50) DEFAULT 'manager',
                        is_primary TINYINT(1) DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        created_by INT DEFAULT NULL,
                        INDEX idx_store (store_id),
                        INDEX idx_user (user_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                ", []);
            }
        } catch (Exception $e) {
            error_log('[OverallStore] schema error: ' . $e->getMessage());
        }
    }

    private function hasCol($table, $col) {
        return $this->db->columnExists($table, $col);
    }

    /**
     * Get stores accessible to the current user.
     * CEO/Admin: all active stores. Manager: only assigned stores.
     */
    public function getAccessibleStores($userId, $role) {
        $hascode    = $this->hasCol('stores', 'store_code');
        $hasmanager = $this->hasCol('stores', 'manager_id');

        $cols = 's.id, s.name, s.address, s.color, s.is_active';
        $cols .= $hascode    ? ', s.store_code'   : ', NULL as store_code';
        $cols .= $hasmanager ? ', s.manager_id'   : ', NULL as manager_id';

        $joinClause   = $hasmanager ? 'LEFT JOIN users u ON (s.manager_id = u.id)' : '';
        $managerCols  = $hasmanager ? ', u.name AS manager_name, u.email AS manager_email'
                                    : ', NULL AS manager_name, NULL AS manager_email';

        $params = [];
        $managerClause = '';

        if (strtolower($role) === 'manager') {
            if ($hasmanager) {
                $managerClause = " AND (EXISTS (
                    SELECT 1 FROM store_manager_assignments sma
                    WHERE sma.store_id = s.id AND sma.user_id = ?
                ) OR s.manager_id = ?)";
                $params[] = $userId;
                $params[] = $userId;
            } else {
                $managerClause = " AND EXISTS (
                    SELECT 1 FROM store_manager_assignments sma
                    WHERE sma.store_id = s.id AND sma.user_id = ?)";
                $params[] = $userId;
            }
        }

        $sql = "SELECT {$cols}{$managerCols}
                FROM stores s
                {$joinClause}
                WHERE s.is_active = 1{$managerClause}
                ORDER BY s.name ASC";

        return $this->db->fetchAll($sql, $params) ?: [];
    }

    public function getAccessibleStoreIds($userId, $role) {
        $stores = $this->getAccessibleStores($userId, $role);
        return array_map(fn($s) => (int)$s['id'], $stores);
    }

    /**
     * Get enriched data for all accessible stores.
     */
    public function getEnrichedStores($userId, $role) {
        $stores = $this->getAccessibleStores($userId, $role);
        $today         = date('Y-m-d');
        $threeDaysLater = date('Y-m-d', strtotime('+3 days'));

        foreach ($stores as &$store) {
            $sid = $store['id'];

            $taskMetrics = $this->getStoreTaskMetrics($sid, $today);
            $store['open_tasks']      = $taskMetrics['open'];
            $store['completed_tasks'] = $taskMetrics['completed'];
            $store['overdue_tasks']   = $taskMetrics['overdue'];
            $store['due_today_tasks'] = $taskMetrics['due_today'];
            $store['upcoming_tasks']  = $taskMetrics['upcoming'];
            $store['critical_tasks']  = $taskMetrics['critical'];

            $billMetrics = $this->getStoreBillMetrics($sid, $today, $threeDaysLater);
            $store['open_bills']    = $billMetrics['open'];
            $store['overdue_bills'] = $billMetrics['overdue'];
            $store['unpaid_bills']  = $billMetrics['unpaid'];
            $store['due_soon_bills'] = $billMetrics['due_soon'];
            $store['next_due_bill'] = $billMetrics['next_due'];

            $store['last_activity']   = $this->getStoreLastActivity($sid);
            $store['current_handler'] = $this->getStoreHighestRiskHandler($sid, $today);
            // P0.2: Setup-incomplete check — missing manager means we cannot show a healthy card.
            $store['needs_setup']     = $this->needsSetup($store);
            $store['health_color']    = $this->calculateHealthColor($store, $today, $threeDaysLater);
            $store['health_label']    = $this->healthLabel($store['health_color']);
            $store['top_issue']       = $this->buildTopIssue($store, $today, $threeDaysLater);
        }
        unset($store);

        usort($stores, function ($a, $b) {
            $order = ['red' => 0, 'yellow' => 1, 'green' => 2, 'gray' => 3];
            $ca = $order[$a['health_color']] ?? 4;
            $cb = $order[$b['health_color']] ?? 4;
            if ($ca !== $cb) return $ca - $cb;
            $oa = ($a['overdue_tasks'] ?? 0) + ($a['overdue_bills'] ?? 0);
            $ob = ($b['overdue_tasks'] ?? 0) + ($b['overdue_bills'] ?? 0);
            if ($oa !== $ob) return $ob - $oa;
            return strcmp($a['next_due_bill'] ?? '9999', $b['next_due_bill'] ?? '9999');
        });

        return $stores;
    }

    public function getStoreTaskMetrics($storeId, $today = null) {
        if (!$today) $today = date('Y-m-d');
        $result = ['open' => 0, 'completed' => 0, 'overdue' => 0, 'due_today' => 0, 'upcoming' => 0, 'critical' => 0];

        try {
            $hasDirectStore  = $this->hasCol('tasks', 'direct_store_id');
            $hasProjectStore = false;
            try {
                $this->db->fetch("SELECT p.store_id FROM projects p WHERE p.store_id IS NOT NULL LIMIT 1", []);
                $hasProjectStore = true;
            } catch (Exception $e) {}

            $parts = [];
            if ($hasDirectStore)  $parts[] = "t.direct_store_id = ?";
            if ($hasProjectStore) $parts[] = "EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id AND p.store_id = ?)";
            if (empty($parts)) return $result;

            $whereStore = implode(' OR ', $parts);
            $baseParams = $hasDirectStore && $hasProjectStore
                ? [$storeId, $storeId]
                : [$storeId];

            $result['open']      = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM tasks t WHERE ({$whereStore}) AND t.is_completed = 0", $baseParams);
            $result['completed'] = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM tasks t WHERE ({$whereStore}) AND t.is_completed = 1", $baseParams);
            $result['overdue']   = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM tasks t WHERE ({$whereStore}) AND t.is_completed = 0 AND t.due_date < ?", array_merge($baseParams, [$today]));
            $result['due_today'] = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM tasks t WHERE ({$whereStore}) AND t.is_completed = 0 AND t.due_date = ?", array_merge($baseParams, [$today]));
            $result['upcoming']  = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM tasks t WHERE ({$whereStore}) AND t.is_completed = 0 AND t.due_date > ?", array_merge($baseParams, [$today]));

            if ($this->hasCol('tasks', 'priority')) {
                $result['critical'] = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM tasks t WHERE ({$whereStore}) AND t.is_completed = 0 AND LOWER(t.priority) IN ('urgent','critical')", $baseParams);
            }
        } catch (Exception $e) {
            error_log('[OverallStore] taskMetrics store ' . $storeId . ': ' . $e->getMessage());
        }
        return $result;
    }

    public function getStoreBillMetrics($storeId, $today = null, $dueSoonDate = null) {
        if (!$today)       $today       = date('Y-m-d');
        if (!$dueSoonDate) $dueSoonDate = date('Y-m-d', strtotime('+3 days'));

        $result = ['open' => 0, 'overdue' => 0, 'unpaid' => 0, 'due_soon' => 0, 'next_due' => null];
        try {
            $arc  = $this->hasCol('bills', 'is_archived') ? " AND b.is_archived = 0" : "";
            $scol = $this->hasCol('bills', 'status') ? "b.status" : "'pending'";

            $result['open']    = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills b WHERE b.store_id = ?{$arc} AND {$scol} IN ('pending','overdue')", [$storeId]);
            $result['overdue'] = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills b WHERE b.store_id = ?{$arc} AND {$scol} = 'overdue'", [$storeId]);
            $result['unpaid']  = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills b WHERE b.store_id = ?{$arc} AND {$scol} IN ('pending','overdue','unpaid')", [$storeId]);
            $result['due_soon'] = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM bills b WHERE b.store_id = ?{$arc} AND {$scol} IN ('pending') AND b.due_date BETWEEN ? AND ?", [$storeId, $today, $dueSoonDate]);

            $row = $this->db->fetch("SELECT MIN(b.due_date) AS next_due FROM bills b WHERE b.store_id = ?{$arc} AND {$scol} IN ('pending','overdue')", [$storeId]);
            $result['next_due'] = $row['next_due'] ?? null;
        } catch (Exception $e) {
            error_log('[OverallStore] billMetrics store ' . $storeId . ': ' . $e->getMessage());
        }
        return $result;
    }

    public function getStoreLastActivity($storeId) {
        try {
            $row = $this->db->fetch("
                SELECT MAX(merged.updated_at) AS last_activity FROM (
                    SELECT t.updated_at FROM tasks t
                    WHERE t.direct_store_id = ?
                       OR EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id AND p.store_id = ?)
                    UNION ALL
                    SELECT b.created_at AS updated_at FROM bills b WHERE b.store_id = ?
                ) merged
            ", [$storeId, $storeId, $storeId]);
            return $row['last_activity'] ?? null;
        } catch (Exception $e) {
            return null;
        }
    }

    public function getStoreHighestRiskHandler($storeId, $today = null) {
        if (!$today) $today = date('Y-m-d');
        try {
            $row = $this->db->fetch("
                SELECT COALESCE(u.name, 'Needs owner') AS handler
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.id
                WHERE (t.direct_store_id = ?
                    OR EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id AND p.store_id = ?))
                AND t.is_completed = 0 AND t.due_date < ?
                ORDER BY t.due_date ASC LIMIT 1
            ", [$storeId, $storeId, $today]);
            if ($row && !empty($row['handler'])) return $row['handler'];
        } catch (Exception $e) {}

        try {
            $row = $this->db->fetch("
                SELECT COALESCE(u.name, 'Needs owner') AS handler
                FROM bills b LEFT JOIN users u ON b.owner_id = u.id
                WHERE b.store_id = ? AND b.status = 'overdue'
                ORDER BY b.due_date ASC LIMIT 1
            ", [$storeId]);
            if ($row && !empty($row['handler'])) return $row['handler'];
        } catch (Exception $e) {}

        return 'All clear';
    }

    /**
     * P0.2: Determine if a store needs setup (missing manager, etc.).
     */
    private function needsSetup($store) {
        return empty($store['manager_id']) || empty($store['manager_name']);
    }

    /**
     * P0.2: Build the top issue string for the store card.
     */
    private function buildTopIssue($store, $today, $threeDaysLater) {
        $reasons = [];
        // Manager missing is always the first and most important issue
        if ($this->needsSetup($store)) {
            $reasons[] = t('overall_store.manager_not_assigned');
        }
        if (($store['overdue_tasks'] ?? 0) > 0) {
            $reasons[] = ($store['overdue_tasks'] ?? 0) . ' ' . t('overall_store.overdue') . ' ' . t('overall_store.task');
        }
        if (($store['overdue_bills'] ?? 0) > 0) {
            $reasons[] = ($store['overdue_bills'] ?? 0) . ' ' . t('overall_store.overdue') . ' ' . t('overall_store.bill');
        }
        if (($store['critical_tasks'] ?? 0) > 0) {
            $reasons[] = ($store['critical_tasks'] ?? 0) . ' ' . t('overall_store.task') . ' (' . t('status.critical') . ')';
        }
        if (($store['due_today_tasks'] ?? 0) > 0) {
            $reasons[] = ($store['due_today_tasks'] ?? 0) . ' ' . t('overall_store.task') . ' ' . t('overall_store.due_today_count');
        }
        if (($store['unpaid_bills'] ?? 0) > 0 && ($store['overdue_bills'] ?? 0) == 0) {
            $reasons[] = ($store['unpaid_bills'] ?? 0) . ' ' . t('overall_store.bill') . ' ' . t('overall_store.unpaid');
        }
        return implode(' · ', $reasons) ?: t('overall_store.no_open_issues');
    }

    private function calculateHealthColor($store, $today, $threeDaysLater) {
        $overdueTasks  = $store['overdue_tasks']  ?? 0;
        $overdueBills  = $store['overdue_bills']  ?? 0;
        $criticalTasks = $store['critical_tasks'] ?? 0;
        $dueToday      = $store['due_today_tasks'] ?? 0;
        $dueSoonBills  = $store['due_soon_bills'] ?? 0;
        $openTasks     = $store['open_tasks']     ?? 0;
        $openBills     = $store['open_bills']     ?? 0;

        // P0.2: Setup incomplete = gray. A store without a manager cannot be green.
        if (!empty($store['needs_setup'])) {
            return 'gray';
        }

        if ($openTasks == 0 && $openBills == 0 && $overdueTasks == 0 && $overdueBills == 0) {
            return 'gray';
        }
        if ($overdueTasks > 0 || $overdueBills > 0 || $criticalTasks > 0) {
            return 'red';
        }
        if ($dueToday > 0 || $dueSoonBills > 0) {
            return 'yellow';
        }
        return 'green';
    }

    private function healthLabel($color) {
        return ['red' => 'Critical', 'yellow' => 'Needs Attention', 'green' => 'Healthy', 'gray' => 'Setup Incomplete'][$color] ?? 'Unknown';
    }

    public function getStoreDetail($storeId, $userId, $role) {
        $today = date('Y-m-d');
        $store = $this->getStoreBasic($storeId);
        if (!$store) return null;

        $taskMetrics = $this->getStoreTaskMetrics($storeId, $today);
        $dueSoonDate = date('Y-m-d', strtotime('+3 days'));
        $billMetrics = $this->getStoreBillMetrics($storeId, $today, $dueSoonDate);

        // Map to prefixed keys used by calculateHealthColor and views
        $store['open_tasks']      = $taskMetrics['open']      ?? 0;
        $store['completed_tasks'] = $taskMetrics['completed'] ?? 0;
        $store['overdue_tasks']   = $taskMetrics['overdue']   ?? 0;
        $store['due_today_tasks'] = $taskMetrics['due_today'] ?? 0;
        $store['upcoming_tasks']  = $taskMetrics['upcoming']  ?? 0;
        $store['critical_tasks']  = $taskMetrics['critical']  ?? 0;
        $store['open_bills']      = $billMetrics['open']      ?? 0;
        $store['overdue_bills']   = $billMetrics['overdue']   ?? 0;
        $store['unpaid_bills']    = $billMetrics['unpaid']    ?? 0;
        $store['due_soon_bills']  = $billMetrics['due_soon']  ?? 0;
        $store['next_due_bill']   = $billMetrics['next_due']  ?? null;
        // Short aliases for JS view
        $store['open']     = $store['open_tasks'];
        $store['overdue']  = $store['overdue_tasks'];
        $store['completed'] = $store['completed_tasks'];
        $store['due_today'] = $store['due_today_tasks'];
        $store['upcoming']  = $store['upcoming_tasks'];
        $store['critical']  = $store['critical_tasks'];
        $store['unpaid']    = $store['unpaid_bills'];
        $store['due_soon']  = $store['due_soon_bills'];

        $store['health_color']  = $this->calculateHealthColor($store, $today, $dueSoonDate);
        $store['health_label']  = $this->healthLabel($store['health_color']);
        $store['last_activity'] = $this->getStoreLastActivity($storeId);
        $store['needs_setup']   = $this->needsSetup($store);
        $store['top_issue']     = $this->buildTopIssue($store, $today, $dueSoonDate);

        $reasons = [];
        if ($store['overdue_tasks'] ?? 0)  $reasons[] = $store['overdue_tasks']  . ' overdue task(s)';
        if ($store['overdue_bills'] ?? 0)  $reasons[] = $store['overdue_bills']  . ' overdue bill(s)';
        if ($store['critical_tasks'] ?? 0) $reasons[] = $store['critical_tasks'] . ' critical task(s)';
        if ($store['due_today_tasks'] ?? 0) $reasons[] = $store['due_today_tasks'] . ' task(s) due today';
        if ($store['due_soon_bills'] ?? 0) $reasons[] = $store['due_soon_bills'] . ' bill(s) due soon';
        $store['risk_reason'] = implode('; ', $reasons) ?: 'All clear';

        $store['tasks']               = $this->getStoreTasks($storeId, $today);
        $store['bills']               = $this->getStoreBills($storeId);
        $store['completed_tasks_list'] = $this->getStoreCompletedTasks($storeId);
        $store['calendar']            = $this->getStoreCalendarItems($storeId, (int)date('n'), (int)date('Y'));
        $store['people']              = $this->getStorePeople($storeId);

        return $store;
    }

    private function getStoreBasic($storeId) {
        try {
            $hascode    = $this->hasCol('stores', 'store_code');
            $hasmanager = $this->hasCol('stores', 'manager_id');

            $cols  = 's.id, s.name, s.address, s.color';
            $cols .= $hascode    ? ', s.store_code'  : ', NULL as store_code';
            $cols .= $hasmanager ? ', s.manager_id'  : ', NULL as manager_id';

            $join = $hasmanager ? 'LEFT JOIN users u ON (s.manager_id = u.id)' : '';
            $mgr  = $hasmanager ? ', u.name AS manager_name, u.email AS manager_email'
                                : ', NULL AS manager_name, NULL AS manager_email';

            return $this->db->fetch(
                "SELECT {$cols}{$mgr} FROM stores s {$join}
                 WHERE s.id = ? AND s.is_active = 1",
                [$storeId]
            );
        } catch (Exception $e) {
            return null;
        }
    }

    public function getStoreTasks($storeId, $today = null) {
        if (!$today) $today = date('Y-m-d');
        try {
            return $this->db->fetchAll("
                SELECT t.id, t.title, t.status, t.priority, t.due_date, t.is_completed,
                    t.created_at, t.updated_at,
                    COALESCE(au.name, 'Needs owner') AS assignee_name,
                    COALESCE(cu.name, '') AS creator_name,
                    COALESCE(ru.name, '') AS reviewer_name,
                    p.name AS project_name
                FROM tasks t
                LEFT JOIN users au ON t.assignee_id = au.id
                LEFT JOIN users cu ON t.created_by = cu.id
                LEFT JOIN users ru ON t.reviewer_id = ru.id
                LEFT JOIN projects p ON t.project_id = p.id
                WHERE t.is_completed = 0
                AND (t.direct_store_id = ?
                    OR EXISTS (SELECT 1 FROM projects pp WHERE pp.id = t.project_id AND pp.store_id = ?))
                ORDER BY
                    CASE WHEN t.due_date < ? THEN 0 WHEN t.due_date = ? THEN 1 ELSE 2 END,
                    FIELD(t.priority,'urgent','critical','high','medium','low'),
                    t.due_date ASC
            ", [$storeId, $storeId, $today, $today]) ?: [];
        } catch (Exception $e) {
            return [];
        }
    }

    public function getStoreBills($storeId) {
        try {
            $arc      = $this->hasCol('bills', 'is_archived') ? " AND b.is_archived = 0" : "";
            $hasOwner = $this->hasCol('bills', 'owner_id');
            $hasVendor = $this->hasCol('bills', 'vendor_id') && $this->db->tableExists('vendors');

            $ownerCol  = $hasOwner  ? "COALESCE(u.name, 'Needs owner')" : "'Needs owner'";
            $vendorCol = $hasVendor ? "COALESCE(v.name, '')"            : "''";
            $ownerJoin  = $hasOwner  ? "LEFT JOIN users u ON b.owner_id = u.id"   : "";
            $vendorJoin = $hasVendor ? "LEFT JOIN vendors v ON b.vendor_id = v.id" : "";

            return $this->db->fetchAll("
                SELECT b.id, b.title, b.category, b.due_date, b.amount, b.status,
                    b.created_at, b.updated_at,
                    {$ownerCol} AS owner_name,
                    {$vendorCol} AS vendor_name
                FROM bills b
                {$ownerJoin}
                {$vendorJoin}
                WHERE b.store_id = ?{$arc}
                ORDER BY
                    CASE WHEN b.status = 'overdue' THEN 0 WHEN b.status = 'pending' THEN 1 ELSE 2 END,
                    b.due_date ASC
            ", [$storeId]) ?: [];
        } catch (Exception $e) {
            error_log('[OverallStore] getStoreBills: ' . $e->getMessage());
            return [];
        }
    }

    public function getStoreCompletedTasks($storeId, $limit = 20) {
        try {
            return $this->db->fetchAll("
                SELECT t.id, t.title, t.completed_at, t.due_date, t.priority,
                    COALESCE(au.name, '') AS completed_by,
                    COALESCE(ru.name, '') AS reviewer_name
                FROM tasks t
                LEFT JOIN users au ON t.assignee_id = au.id
                LEFT JOIN users ru ON t.reviewer_id = ru.id
                WHERE t.is_completed = 1
                AND (t.direct_store_id = ?
                    OR EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id AND p.store_id = ?))
                ORDER BY t.completed_at DESC
                LIMIT {$limit}
            ", [$storeId, $storeId]) ?: [];
        } catch (Exception $e) {
            return [];
        }
    }

    public function getStoreCalendarItems($storeId, $month = null, $year = null) {
        $month = max(1, min(12, (int)($month ?: date('n'))));
        $year = max(2020, min(2040, (int)($year ?: date('Y'))));
        $today = date('Y-m-d');
        $start = sprintf('%04d-%02d-01', $year, $month);
        $end = date('Y-m-t', strtotime($start));

        $result = [
            'month' => $month,
            'year' => $year,
            'today' => $today,
            'summary' => ['total' => 0, 'open' => 0, 'done' => 0, 'overdue' => 0, 'bills' => 0],
            'tasks' => [],
            'bills' => [],
        ];

        try {
            $tasks = $this->db->fetchAll("
                SELECT t.id, t.title, t.status, t.priority, t.due_date, t.is_completed,
                    t.completed_at, COALESCE(au.name, 'Needs owner') AS assignee_name,
                    p.name AS project_name
                FROM tasks t
                LEFT JOIN users au ON t.assignee_id = au.id
                LEFT JOIN projects p ON t.project_id = p.id
                WHERE t.due_date BETWEEN ? AND ?
                  AND (t.direct_store_id = ?
                    OR EXISTS (SELECT 1 FROM projects pp WHERE pp.id = t.project_id AND pp.store_id = ?))
                ORDER BY t.due_date ASC, t.is_completed ASC, t.title ASC
            ", [$start, $end, $storeId, $storeId]) ?: [];

            $dueSoonCutoff = date('Y-m-d', strtotime($today . ' +7 days'));
            foreach ($tasks as $task) {
                $isDone = (int)($task['is_completed'] ?? 0) === 1 || ($task['status'] ?? '') === 'completed';
                $isOverdue = !$isDone && !empty($task['due_date']) && $task['due_date'] < $today;
                $isDueSoon = !$isDone && !empty($task['due_date']) && $task['due_date'] >= $today && $task['due_date'] <= $dueSoonCutoff;
                $task['calendar_status'] = $isDone ? 'done' : ($isOverdue ? 'overdue' : ($isDueSoon ? 'due' : 'upcoming'));
                $result['tasks'][] = $task;
                $result['summary']['total']++;
                if ($isDone) {
                    $result['summary']['done']++;
                } elseif ($isOverdue) {
                    $result['summary']['overdue']++;
                } else {
                    $result['summary']['open']++;
                }
            }
        } catch (Exception $e) {
            error_log('[OverallStore] calendar tasks store ' . $storeId . ': ' . $e->getMessage());
        }

        try {
            $arc = $this->hasCol('bills', 'is_archived') ? " AND (b.is_archived = 0 OR b.is_archived IS NULL)" : "";
            $bills = $this->db->fetchAll("
                SELECT b.id, b.title, b.category, b.due_date, b.amount, b.status,
                    COALESCE(v.name, b.vendor, '') AS vendor_name
                FROM bills b
                LEFT JOIN vendors v ON v.id = b.vendor_id
                WHERE b.store_id = ?{$arc}
                  AND b.due_date BETWEEN ? AND ?
                ORDER BY b.due_date ASC, b.title ASC
            ", [$storeId, $start, $end]) ?: [];
            $result['bills'] = $bills;
            $result['summary']['bills'] = count($bills);
            $result['summary']['total'] += count($bills);
        } catch (Exception $e) {
            error_log('[OverallStore] calendar bills store ' . $storeId . ': ' . $e->getMessage());
        }

        return $result;
    }

    private function getStorePeople($storeId) {
        try {
            return $this->db->fetchAll("
                SELECT
                    u.id, u.name, u.email,
                    CASE WHEN s.manager_id = u.id THEN 'manager' ELSE 'member' END AS role,
                    COUNT(CASE WHEN t.is_completed = 0 THEN 1 END) AS open_task_count,
                    COUNT(CASE WHEN t.is_completed = 1 THEN 1 END) AS completed_task_count
                FROM users u
                INNER JOIN stores s ON s.id = ?
                LEFT JOIN tasks t ON (t.assignee_id = u.id
                    AND (t.direct_store_id = ?
                        OR EXISTS (SELECT 1 FROM projects p WHERE p.id = t.project_id AND p.store_id = ?)))
                WHERE (s.manager_id = u.id
                    OR EXISTS (SELECT 1 FROM tasks tt WHERE tt.assignee_id = u.id
                        AND (tt.direct_store_id = ?
                            OR EXISTS (SELECT 1 FROM projects pp WHERE pp.id = tt.project_id AND pp.store_id = ?))))
                GROUP BY u.id, u.name, u.email, s.manager_id
                ORDER BY role ASC, u.name ASC
            ", [$storeId, $storeId, $storeId, $storeId, $storeId]) ?: [];
        } catch (Exception $e) {
            return [];
        }
    }
}
