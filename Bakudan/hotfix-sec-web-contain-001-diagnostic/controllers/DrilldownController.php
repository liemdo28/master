<?php
/**
 * DrilldownController — Executive Dashboard Drill-Down
 *
 * Provides detailed drill-down views for each metric on the overview page.
 * All methods require CEO, admin, or manager role.
 */
class DrilldownController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * Shared auth guard — CEO, admin, or manager only.
     */
    private function requireManager(): void
    {
        if (!canManage()) {
            redirect('overview');
        }
    }

    private function taskStoreJoin(): array
    {
        static $checked = null;
        if ($checked === null) {
            $col = $this->db->fetchAll("SHOW COLUMNS FROM tasks LIKE 'direct_store_id'");
            $checked = !empty($col) && $this->db->tableExists('stores');
        }
        return [
            'join' => $checked ? "LEFT JOIN stores s ON t.direct_store_id = s.id" : "",
            'sel'  => $checked ? "s.name as store_name," : "'—' as store_name,",
        ];
    }

    /**
     * GET /overview/drilldown/overdue-bills
     */
    public function overdueBills(): void
    {
        $this->requireManager();

        $bills = [];
        try {
            if ($this->db->tableExists('bills')) {
                $hasVendors = $this->db->tableExists('vendors');
                $hasStores  = $this->db->tableExists('stores');
                $hasUsers   = $this->db->tableExists('users');
                $hasArchived = $this->db->columnExists('bills', 'is_archived');

                $vendorJoin = $hasVendors ? "LEFT JOIN vendors v ON b.vendor_id = v.id" : "";
                $storeJoin  = $hasStores  ? "LEFT JOIN stores s ON b.store_id = s.id" : "";
                $userJoin   = $hasUsers   ? "LEFT JOIN users u ON b.created_by = u.id" : "";

                $vendorSel  = $hasVendors ? "v.name as vendor_name," : "'—' as vendor_name,";
                $storeSel   = $hasStores  ? "s.name as store_name,"  : "'—' as store_name,";
                $userSel    = $hasUsers   ? "u.name as owner_name,"  : "'—' as owner_name,";
                $archiveWhere = $hasArchived ? "AND COALESCE(b.is_archived, 0) = 0" : "";

                $bills = $this->db->fetchAll(
                    "SELECT b.*, {$vendorSel} {$storeSel} {$userSel}
                            DATEDIFF(NOW(), b.due_date) as overdue_days
                     FROM bills b
                     {$vendorJoin}
                     {$storeJoin}
                     {$userJoin}
                     WHERE b.status NOT IN ('paid','cancelled')
                       AND b.due_date < NOW()
                       {$archiveWhere}
                     ORDER BY b.due_date ASC"
                );
            }
        } catch (\Throwable $e) {
            error_log("[DrilldownController::overdueBills] Exception: " . $e->getMessage());
            $bills = [];
        }

        $totalAmount = array_sum(array_column($bills, 'amount'));
        $pageTitle   = 'Overdue Bills — Drill-Down';
        $currentPage = 'overview';

        ob_start();
        require __DIR__ . '/../views/drilldown/overdue_bills.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /overview/drilldown/critical-tasks
     */
    public function criticalTasks(): void
    {
        $this->requireManager();

        $tasks = [];
        try {
            ['join' => $storeJoin, 'sel' => $storeSel] = $this->taskStoreJoin();
            $hasReviewerDue = $this->db->columnExists('tasks', 'reviewer_due_date');

            $reviewerClause = $hasReviewerDue
                ? "OR (t.status IN ('pending_review','pending_acceptance') AND t.reviewer_due_date IS NOT NULL AND t.reviewer_due_date < CURDATE())"
                : "";

            $tasks = $this->db->fetchAll(
                "SELECT t.*, {$storeSel}
                        u.name as assignee_name,
                        r.name as reviewer_name,
                        a.name as approver_name,
                        DATEDIFF(NOW(), t.due_date) as overdue_days
                 FROM tasks t
                 {$storeJoin}
                 LEFT JOIN users u ON t.assignee_id = u.id
                 LEFT JOIN users r ON t.reviewer_id = r.id
                 LEFT JOIN users a ON t.approver_id = a.id
                 WHERE t.status NOT IN ('completed','done','cancelled')
                   AND t.is_completed = 0
                   AND (t.priority = 'critical'
                        OR (t.due_date IS NOT NULL AND t.due_date < NOW())
                        {$reviewerClause})
                 ORDER BY t.priority DESC, t.due_date ASC
                 LIMIT 200"
            );
        } catch (\Throwable $e) {
            error_log("[DrilldownController::criticalTasks] Exception: " . $e->getMessage());
            $tasks = [];
        }

        $pageTitle   = 'Critical Tasks — Drill-Down';
        $currentPage = 'overview';

        ob_start();
        require __DIR__ . '/../views/drilldown/critical_tasks.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /overview/drilldown/compliance-risk
     */
    public function complianceRisk(): void
    {
        $this->requireManager();

        $items = [];
        try {
            if ($this->db->tableExists('obligations')) {
                $hasPayments = $this->db->tableExists('obligation_payments');
                $hasStores   = $this->db->tableExists('stores');
                $hasUsers    = $this->db->tableExists('users');

                $payJoin   = $hasPayments ? "LEFT JOIN obligation_payments op ON o.id = op.obligation_id" : "";
                $storeJoin = $hasStores   ? "LEFT JOIN stores s ON o.store_id = s.id" : "";
                $userJoin  = $hasUsers    ? "LEFT JOIN users u ON o.owner_id = u.id" : "";

                $paySel  = $hasPayments ? "op.paid_date, op.amount as paid_amount," : "NULL as paid_date, NULL as paid_amount,";
                $storeSel= $hasStores   ? "s.name as store_name," : "'—' as store_name,";
                $userSel = $hasUsers    ? "u.name as owner_name," : "'—' as owner_name,";

                $items = $this->db->fetchAll(
                    "SELECT o.*, {$paySel} {$storeSel} {$userSel}
                            DATEDIFF(NOW(), o.due_date) as overdue_days
                     FROM obligations o
                     {$payJoin}
                     {$storeJoin}
                     {$userJoin}
                     WHERE o.category IN ('tax','compliance','filing','permit','audit')
                       AND o.status IN ('pending','overdue')
                     ORDER BY o.due_date ASC"
                );
            }
        } catch (\Throwable $e) {
            error_log("[DrilldownController::complianceRisk] Exception: " . $e->getMessage());
            $items = [];
        }

        $pageTitle   = 'Compliance Risk — Drill-Down';
        $currentPage = 'overview';

        ob_start();
        require __DIR__ . '/../views/drilldown/compliance_risk.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /overview/drilldown/penalty
     * Penalty drilldown — shows penalty data for the organization.
     */
    public function penalty(): void
    {
        $this->requireManager();

        $penalties = [];
        try {
            if ($this->db->tableExists('penalties')) {
                $hasUsers  = $this->db->tableExists('users');
                $hasRules  = $this->db->tableExists('penalty_rules');
                $userJoin  = $hasUsers ? "LEFT JOIN users u ON p.user_id = u.id" : "";
                $userSel   = $hasUsers ? "u.name as user_name," : "'—' as user_name,";
                $ruleJoin  = $hasRules ? "LEFT JOIN penalty_rules pr ON p.rule_id = pr.id" : "";
                $ruleSel   = $hasRules ? "pr.title as rule_name, pr.points as rule_points," : "'—' as rule_name, 0 as rule_points,";

                $penalties = $this->db->fetchAll(
                    "SELECT p.*, {$userSel} {$ruleSel}
                            p.created_at as penalized_at
                     FROM penalties p
                     {$userJoin}
                     {$ruleJoin}
                     ORDER BY p.created_at DESC
                     LIMIT 200"
                );
            }
        } catch (\Throwable $e) {
            error_log("[DrilldownController::penalty] Exception: " . $e->getMessage());
            $penalties = [];
        }

        $totalPoints = array_sum(array_column($penalties, 'points'));
        $pageTitle   = 'Penalties — Drill-Down';
        $currentPage = 'overview';

        ob_start();
        require __DIR__ . '/../views/drilldown/penalty.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /overview/drilldown/execution-risk
     */
    public function executionRisk(): void
    {
        $this->requireManager();

        ['join' => $storeJoin, 'sel' => $storeSel] = $this->taskStoreJoin();

        // Overloaded users: more than 5 open tasks
        $overloadedUsers = $this->db->fetchAll(
            "SELECT u.id as user_id, u.name, u.avatar,
                    COUNT(t.id) as open_tasks,
                    SUM(CASE WHEN t.due_date < NOW() THEN 1 ELSE 0 END) as overdue_tasks
             FROM users u
             JOIN tasks t ON t.assignee_id = u.id
             WHERE t.status NOT IN ('completed','cancelled')
               AND t.is_completed = 0
             GROUP BY u.id, u.name, u.avatar
             HAVING open_tasks > 5
             ORDER BY open_tasks DESC"
        );

        // Tasks stuck in review for more than 3 days
        $stuckTasks = $this->db->fetchAll(
            "SELECT t.*, {$storeSel}
                    u.name as assignee_name,
                    DATEDIFF(NOW(), t.updated_at) as stuck_days
             FROM tasks t
             {$storeJoin}
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.status = 'review'
               AND t.updated_at < DATE_SUB(NOW(), INTERVAL 3 DAY)
             ORDER BY t.updated_at ASC
             LIMIT 100"
        );

        $pageTitle   = 'Execution Risk — Drill-Down';
        $currentPage = 'overview';

        ob_start();
        require __DIR__ . '/../views/drilldown/execution_risk.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /overview/drilldown/unified-risk
     */
    public function unifiedRisk(): void
    {
        $this->requireManager();

        $unified = [];

        // Overdue bills
        if ($this->db->tableExists('bills')) {
            $billRows = $this->db->fetchAll(
                "SELECT b.id, b.title as record_name, b.amount,
                        b.due_date, b.status,
                        COALESCE(s.name, '—') as store_name,
                        COALESCE(u.name, '—') as owner_name,
                        DATEDIFF(NOW(), b.due_date) as overdue_days
                 FROM bills b
                 LEFT JOIN stores s ON b.store_id = s.id
                 LEFT JOIN users u ON b.created_by = u.id
                 WHERE b.status NOT IN ('paid','cancelled')
                   AND b.due_date < NOW()
                   AND COALESCE(b.is_archived, 0) = 0
                 ORDER BY b.due_date ASC
                 LIMIT 10"
            );
            foreach ($billRows as $row) {
                $days = (int)($row['overdue_days'] ?? 0);
                $level = $days > 30 ? 'critical' : ($days > 14 ? 'high' : 'medium');
                $unified[] = [
                    'type'        => 'Bill',
                    'id'          => $row['id'],
                    'record'      => $row['record_name'],
                    'store'       => $row['store_name'],
                    'owner'       => $row['owner_name'],
                    'risk_level'  => $level,
                    'risk_reason' => "{$days}d overdue · \${$row['amount']}",
                    'url'         => '/bills/' . $row['id'],
                    'risk_score'  => $days,
                ];
            }
        }

        // Critical tasks
        $taskRows = $this->db->fetchAll(
            "SELECT t.id, t.title, t.priority, t.due_date,
                    '—' as store_name,
                    COALESCE(u.name, '—') as assignee_name,
                    DATEDIFF(NOW(), t.due_date) as overdue_days
             FROM tasks t
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.status NOT IN ('completed','done','cancelled')
               AND t.is_completed = 0
               AND (t.priority = 'critical' OR (t.due_date IS NOT NULL AND t.due_date < NOW()))
             ORDER BY t.due_date ASC
             LIMIT 10"
        );
        foreach ($taskRows as $row) {
            $days = (int)($row['overdue_days'] ?? 0);
            $level = $row['priority'] === 'critical' ? 'critical' : ($days > 7 ? 'high' : 'medium');
            $unified[] = [
                'type'        => 'Task',
                'id'          => $row['id'],
                'record'      => $row['title'],
                'store'       => $row['store_name'],
                'owner'       => $row['assignee_name'],
                'risk_level'  => $level,
                'risk_reason' => $row['priority'] === 'critical' ? 'Critical priority' : "{$days}d overdue",
                'url'         => '/tasks/' . $row['id'],
                'risk_score'  => $row['priority'] === 'critical' ? 100 + $days : $days,
            ];
        }

        // Sort by risk_score descending, take top 20
        usort($unified, fn($a, $b) => $b['risk_score'] <=> $a['risk_score']);
        $unified = array_slice($unified, 0, 20);

        $pageTitle   = 'Unified Risk — Drill-Down';
        $currentPage = 'overview';

        ob_start();
        require __DIR__ . '/../views/drilldown/unified_risk.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /overview/drilldown/cash-risk
     */
    public function cashRisk(): void
    {
        $this->requireManager();

        $storeRisks = [];
        if ($this->db->tableExists('bills') && $this->db->tableExists('stores')) {
            $storeRisks = $this->db->fetchAll(
                "SELECT s.id as store_id, s.name as store_name,
                        COUNT(b.id) as unpaid_count,
                        SUM(b.amount) as total_amount,
                        SUM(CASE WHEN b.due_date < NOW() THEN b.amount ELSE 0 END) as overdue_amount,
                        MIN(b.due_date) as oldest_due
                 FROM stores s
                 JOIN bills b ON b.store_id = s.id
                 WHERE b.status NOT IN ('paid','cancelled')
                 GROUP BY s.id, s.name
                 HAVING total_amount > 0
                 ORDER BY overdue_amount DESC"
            );
        }

        $totalRisk = array_sum(array_column($storeRisks, 'total_amount'));

        $pageTitle   = 'Cash Risk — Drill-Down';
        $currentPage = 'overview';

        ob_start();
        require __DIR__ . '/../views/drilldown/cash_risk.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /overview/drilldown/finance-bills?risk=critical|high|medium|low
     */
    public function financeBills(): void
    {
        $this->requireManager();

        $risk = strtolower(trim($_GET['risk'] ?? 'all'));
        $bills = [];

        if ($this->db->tableExists('bills')) {
            $hasVendors = $this->db->tableExists('vendors');
            $hasStores  = $this->db->tableExists('stores');
            $hasUsers   = $this->db->tableExists('users');

            $vendorJoin = $hasVendors ? "LEFT JOIN vendors v ON b.vendor_id = v.id" : "";
            $storeJoin  = $hasStores  ? "LEFT JOIN stores s ON b.store_id = s.id"  : "";
            $userJoin   = $hasUsers   ? "LEFT JOIN users u ON b.created_by = u.id" : "";

            $vendorSel = $hasVendors ? "v.name as vendor_name," : "'—' as vendor_name,";
            $storeSel  = $hasStores  ? "s.name as store_name,"  : "'—' as store_name,";
            $userSel   = $hasUsers   ? "u.name as owner_name,"  : "'—' as owner_name,";

            $whereDate = match($risk) {
                'critical' => "AND b.due_date < DATE_SUB(NOW(), INTERVAL 30 DAY)",
                'high'     => "AND b.due_date BETWEEN DATE_SUB(NOW(), INTERVAL 30 DAY) AND DATE_SUB(NOW(), INTERVAL 15 DAY)",
                'medium'   => "AND b.due_date BETWEEN DATE_SUB(NOW(), INTERVAL 15 DAY) AND NOW()",
                'low'      => "AND b.due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)",
                default    => "",
            };

            $bills = $this->db->fetchAll(
                "SELECT b.*, {$vendorSel} {$storeSel} {$userSel}
                        DATEDIFF(NOW(), b.due_date) as overdue_days
                 FROM bills b
                 {$vendorJoin}
                 {$storeJoin}
                 {$userJoin}
                 WHERE b.status NOT IN ('paid','cancelled')
                   AND COALESCE(b.is_archived, 0) = 0
                 {$whereDate}
                 ORDER BY b.due_date ASC"
            );
        }

        $totalAmount = array_sum(array_column($bills, 'amount'));

        $pageTitle   = ucfirst($risk) . ' Risk Bills — Drill-Down';
        $currentPage = 'overview';

        ob_start();
        require __DIR__ . '/../views/drilldown/finance_bills.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /overview/drilldown/execution-health
     */
    public function executionHealth(): void
    {
        $this->requireManager();

        ['join' => $storeJoin, 'sel' => $storeSel] = $this->taskStoreJoin();

        $base = "SELECT t.id, t.title, t.priority, t.due_date, t.status, {$storeSel}
                        u.name as assignee_name
                 FROM tasks t
                 {$storeJoin}
                 LEFT JOIN users u ON t.assignee_id = u.id
                 WHERE t.status NOT IN ('completed','cancelled')
                   AND t.is_completed = 0";

        $onTrack  = $this->db->fetchAll($base . " AND (t.due_date IS NULL OR t.due_date > DATE_ADD(NOW(), INTERVAL 3 DAY)) ORDER BY t.due_date ASC LIMIT 100");
        $atRisk   = $this->db->fetchAll($base . " AND t.due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 DAY) ORDER BY t.due_date ASC LIMIT 100");
        $critical = $this->db->fetchAll($base . " AND t.due_date < NOW() ORDER BY t.due_date ASC LIMIT 100");

        $pageTitle   = 'Execution Health — Drill-Down';
        $currentPage = 'overview';

        ob_start();
        require __DIR__ . '/../views/drilldown/execution_health.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    // ── P0: Bill drill-down by category ──────────────────────────────────────

    /**
     * GET /overview/drilldown/bills/category/{slug}
     */
    public function billsByCategory(string $slug): void
    {
        $this->requireManager();
        $bills = $this->fetchBillsWithWorkflow("b.category = ?", [$slug]);
        $totalAmount = array_sum(array_column($bills, 'amount'));
        $pageTitle   = 'Bills by Category: ' . ucfirst($slug);
        $currentPage = 'overview';

        ob_start();
        require __DIR__ . '/../views/drilldown/bills_generic.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /overview/drilldown/bills/store/{id}
     */
    public function billsByStore(int $storeId): void
    {
        $this->requireManager();
        $bills = $this->fetchBillsWithWorkflow("b.store_id = ?", [$storeId]);
        $totalAmount = array_sum(array_column($bills, 'amount'));

        $storeName = '';
        if ($this->db->tableExists('stores')) {
            $store = $this->db->fetch("SELECT name FROM stores WHERE id = ?", [$storeId]);
            $storeName = $store['name'] ?? '';
        }

        $pageTitle   = 'Bills: ' . ($storeName ?: 'Store #' . $storeId);
        $currentPage = 'overview';

        ob_start();
        require __DIR__ . '/../views/drilldown/bills_generic.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function fetchBillsWithWorkflow(string $extraWhere, array $extraParams): array
    {
        if (!$this->db->tableExists('bills')) return [];

        $hasArchived  = $this->db->columnExists('bills', 'is_archived');
        $archiveWhere = $hasArchived ? "AND (b.is_archived = 0 OR b.is_archived IS NULL)" : "";

        // Responsible / checker / approver user selects
        $hasResponsible = $this->db->columnExists('bills', 'responsible_user_id');
        $hasChecker     = $this->db->columnExists('bills', 'checker_user_id');
        $hasApprover    = $this->db->columnExists('bills', 'approver_user_id');
        $hasVerifier    = $this->db->columnExists('bills', 'verifier_user_id');

        $rSel = $hasResponsible ? "ur.name AS responsible_name," : "'—' AS responsible_name,";
        $cSel = $hasChecker     ? "uc.name AS checker_name,"     : "'—' AS checker_name,";
        $aSel = $hasApprover    ? "ua.name AS approver_name,"    : "'—' AS approver_name,";
        $vSel = $hasVerifier    ? "uv.name AS verifier_name,"    : "'—' AS verifier_name,";

        $rJoin = $hasResponsible ? "LEFT JOIN users ur ON ur.id = b.responsible_user_id" : "";
        $cJoin = $hasChecker     ? "LEFT JOIN users uc ON uc.id = b.checker_user_id"     : "";
        $aJoin = $hasApprover    ? "LEFT JOIN users ua ON ua.id = b.approver_user_id"    : "";
        $vJoin = $hasVerifier    ? "LEFT JOIN users uv ON uv.id = b.verifier_user_id"    : "";

        // Evidence count
        $evSel = $this->db->tableExists('bill_evidence')
            ? "(SELECT COUNT(*) FROM bill_evidence be WHERE be.bill_id = b.id) AS evidence_count,"
            : "0 AS evidence_count,";
        // Legacy attachments
        if (!$this->db->tableExists('bill_evidence') && $this->db->tableExists('bill_attachments')) {
            $evSel = "(SELECT COUNT(*) FROM bill_attachments ba WHERE ba.bill_id = b.id) AS evidence_count,";
        }

        $params = array_merge($extraParams, []);
        return $this->db->fetchAll(
            "SELECT b.*,
                    s.name AS store_name,
                    COALESCE(v.name, b.vendor) AS vendor_name,
                    DATEDIFF(NOW(), b.due_date) AS overdue_days,
                    {$rSel}
                    {$cSel}
                    {$aSel}
                    {$vSel}
                    {$evSel}
                    0 AS _pad
             FROM bills b
             LEFT JOIN stores s ON s.id = b.store_id
             LEFT JOIN vendors v ON v.id = b.vendor_id
             {$rJoin}
             {$cJoin}
             {$aJoin}
             {$vJoin}
             WHERE {$extraWhere}
             {$archiveWhere}
             ORDER BY b.due_date ASC",
            $params
        );
    }
}
