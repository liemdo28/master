<?php
/**
 * FranchiseController — Multi-Store Hierarchy, Org Chart, KPIs, Scorecard, Goals, Budget
 */
class FranchiseController
{
    private Franchise $franchise;
    private KpiEngine $kpi;

    public function __construct()
    {
        $this->franchise = new Franchise();
        $this->kpi = new KpiEngine();
    }

    // ── Org Chart (/admin/org-chart) ─────────────────────────────────────────

    public function orgChart(): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canManage()) redirect('dashboard');

        $orgTree = $this->franchise->getOrgChart();
        $hierarchy = $this->franchise->getFullHierarchy();
        $stats = $this->franchise->getCompanyStats();

        require __DIR__ . '/../views/franchise/org_chart.php';
    }

    // ── Executive Scorecard (/ceo/scorecard) ─────────────────────────────────

    public function scorecard(): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canAdmin()) redirect('dashboard');

        $scorecard = $this->kpi->getExecutiveScorecard();
        $benchmarks = $this->kpi->getBenchmarks();
        $goals = $this->kpi->getGoals(['status' => 'active']);
        $stats = $this->franchise->getCompanyStats();

        require __DIR__ . '/../views/franchise/scorecard.php';
    }

    // ── Store Benchmarking (/admin/benchmarks) ───────────────────────────────

    public function benchmarks(): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canManage()) redirect('dashboard');

        $benchmarks = $this->kpi->getBenchmarks();
        require __DIR__ . '/../views/franchise/benchmarks.php';
    }

    // ── Goals & OKRs (/admin/goals) ──────────────────────────────────────────

    public function goals(): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canManage()) redirect('dashboard');

        $filters = [];
        if (!empty($_GET['status'])) $filters['status'] = $_GET['status'];
        if (!empty($_GET['quarter'])) $filters['quarter'] = $_GET['quarter'];
        if (!empty($_GET['type'])) $filters['type'] = $_GET['type'];

        $goals = $this->kpi->getGoals($filters);
        require __DIR__ . '/../views/franchise/goals.php';
    }

    public function createGoal(): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canAdmin()) redirect('dashboard');
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { flash('error', 'Invalid CSRF'); redirect('admin/goals'); }

        $this->kpi->createGoal([
            'title'        => trim($_POST['title'] ?? ''),
            'description'  => trim($_POST['description'] ?? '') ?: null,
            'type'         => $_POST['type'] ?? 'company',
            'scope_id'     => !empty($_POST['scope_id']) ? (int)$_POST['scope_id'] : null,
            'owner_id'     => !empty($_POST['owner_id']) ? (int)$_POST['owner_id'] : $_SESSION['user_id'],
            'metric_key'   => $_POST['metric_key'] ?? null,
            'target_value' => !empty($_POST['target_value']) ? (float)$_POST['target_value'] : null,
            'quarter'      => $_POST['quarter'] ?? null,
            'starts_at'    => $_POST['starts_at'] ?? null,
            'ends_at'      => $_POST['ends_at'] ?? null,
        ]);

        flash('success', 'Goal created.');
        redirect('admin/goals');
    }

    // ── Budget Requests (/admin/budget) ──────────────────────────────────────

    public function budget(): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canManage()) redirect('dashboard');

        $db = Database::getInstance();
        $status = $_GET['status'] ?? '';
        $where = $status ? 'WHERE br.status = ?' : '';
        $params = $status ? [$status] : [];

        $requests = $db->fetchAll(
            "SELECT br.*, s.name AS store_name, u.name AS requester_name, a.name AS approver_name
             FROM budget_requests br
             LEFT JOIN stores s ON s.id = br.store_id
             LEFT JOIN users u ON u.id = br.requester_id
             LEFT JOIN users a ON a.id = br.approved_by
             {$where}
             ORDER BY br.created_at DESC LIMIT 100",
            $params
        );

        $stats = $db->fetch(
            "SELECT
                SUM(status = 'submitted') AS pending,
                SUM(status = 'approved') AS approved,
                SUM(status = 'rejected') AS rejected,
                SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) AS approved_total,
                SUM(CASE WHEN status IN ('submitted','under_review') THEN amount ELSE 0 END) AS pending_total
             FROM budget_requests"
        );

        require __DIR__ . '/../views/franchise/budget.php';
    }

    public function createBudgetRequest(): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { flash('error', 'Invalid CSRF'); redirect('admin/budget'); }

        $db = Database::getInstance();
        $db->insert('budget_requests', [
            'store_id'     => !empty($_POST['store_id']) ? (int)$_POST['store_id'] : null,
            'requester_id' => $_SESSION['user_id'],
            'category'     => $_POST['category'] ?? 'other',
            'title'        => trim($_POST['title'] ?? ''),
            'description'  => trim($_POST['description'] ?? '') ?: null,
            'amount'       => (float)($_POST['amount'] ?? 0),
            'vendor_name'  => trim($_POST['vendor_name'] ?? '') ?: null,
            'priority'     => $_POST['priority'] ?? 'medium',
            'status'       => 'submitted',
        ]);

        flash('success', 'Budget request submitted.');
        redirect('admin/budget');
    }

    public function approveBudget(int $id): void
    {
        if (!isLoggedIn()) redirect('login');
        if (!canAdmin()) { json_response(['error' => 'Forbidden'], 403); }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); }

        $db = Database::getInstance();
        $action = $_POST['action'] ?? '';

        if ($action === 'approve') {
            $db->update('budget_requests', [
                'status' => 'approved',
                'approved_by' => $_SESSION['user_id'],
                'approved_at' => date('Y-m-d H:i:s'),
            ], 'id = ?', [$id]);
        } elseif ($action === 'reject') {
            $db->update('budget_requests', [
                'status' => 'rejected',
                'approved_by' => $_SESSION['user_id'],
                'rejection_reason' => trim($_POST['reason'] ?? ''),
            ], 'id = ?', [$id]);
        }

        json_response(['success' => true]);
    }

    // ── Regions Management (API) ─────────────────────────────────────────────

    public function apiRegions(): void
    {
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        json_response(['regions' => $this->franchise->getRegions()]);
    }

    public function apiCreateRegion(): void
    {
        if (!canAdmin()) json_response(['error' => 'Forbidden'], 403);
        if (!verify_csrf($_POST['csrf_token'] ?? '')) json_response(['error' => 'Invalid CSRF'], 403);

        $id = $this->franchise->createRegion([
            'name'       => trim($_POST['name'] ?? ''),
            'code'       => trim($_POST['code'] ?? '') ?: null,
            'country'    => $_POST['country'] ?? 'US',
            'timezone'   => $_POST['timezone'] ?? 'America/Los_Angeles',
            'manager_id' => !empty($_POST['manager_id']) ? (int)$_POST['manager_id'] : null,
        ]);
        json_response(['success' => true, 'id' => $id]);
    }

    public function apiDistricts(): void
    {
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        $regionId = !empty($_GET['region_id']) ? (int)$_GET['region_id'] : null;
        json_response(['districts' => $this->franchise->getDistricts($regionId)]);
    }

    public function apiCreateDistrict(): void
    {
        if (!canAdmin()) json_response(['error' => 'Forbidden'], 403);
        if (!verify_csrf($_POST['csrf_token'] ?? '')) json_response(['error' => 'Invalid CSRF'], 403);

        $id = $this->franchise->createDistrict([
            'name'       => trim($_POST['name'] ?? ''),
            'code'       => trim($_POST['code'] ?? '') ?: null,
            'region_id'  => !empty($_POST['region_id']) ? (int)$_POST['region_id'] : null,
            'manager_id' => !empty($_POST['manager_id']) ? (int)$_POST['manager_id'] : null,
        ]);
        json_response(['success' => true, 'id' => $id]);
    }

    public function apiHierarchy(): void
    {
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        json_response($this->franchise->getFullHierarchy());
    }

    public function apiOrgChart(): void
    {
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        json_response(['org' => $this->franchise->getOrgChart()]);
    }

    // ── KPI API ──────────────────────────────────────────────────────────────

    public function apiScorecard(): void
    {
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        if (!canManage()) json_response(['error' => 'Forbidden'], 403);
        json_response($this->kpi->getExecutiveScorecard());
    }

    public function apiBenchmarks(): void
    {
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        if (!canManage()) json_response(['error' => 'Forbidden'], 403);
        json_response($this->kpi->getBenchmarks());
    }

    public function apiStoreKpi(int $storeId): void
    {
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        $days = max(1, min(90, (int)($_GET['days'] ?? 30)));
        json_response(['history' => $this->kpi->getStoreHistory($storeId, $days)]);
    }

    // ── Cron: Calculate daily KPIs ───────────────────────────────────────────

    public function cronKpiSnapshot(): void
    {
        $cronSecret = defined('CRON_SECRET') ? CRON_SECRET : (getenv('CRON_SECRET') ?: '');
        if ($cronSecret && ($_GET['secret'] ?? '') !== $cronSecret) {
            json_response(['error' => 'Forbidden'], 403);
        }
        $results = $this->kpi->calculateDailySnapshot();
        json_response(['success' => true, 'stores_processed' => count($results)]);
    }
}
