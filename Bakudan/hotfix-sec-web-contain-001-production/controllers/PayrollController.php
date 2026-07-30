<?php
/**
 * PayrollController - Payroll Management System
 */
require_once __DIR__ . '/../models/Payroll.php';

class PayrollController
{
    private $payroll;
    
    public function __construct()
    {
        try { $this->payroll = new Payroll(); } catch (\Throwable $e) { error_log('[Payroll] model: ' . $e->getMessage()); $this->payroll = null; }
    }
    
    private function requireAdmin(): void
    {
        if (session_status() === PHP_SESSION_NONE) session_start();
        if (empty($_SESSION['user_id']) || !in_array($_SESSION['user_role'] ?? '', ['admin', 'ceo'])) {
            header('Location: /dashboard');
            exit;
        }
    }
    
    public function index(): void
    {
        $this->requireAdmin();
        
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = 20;
        $offset = ($page - 1) * $limit;
        
        $runs = []; $total = 0; $stats = [];
        if ($this->payroll) {
            try { $runs = $this->payroll->getAllPayrollRuns($limit, $offset); } catch (\Throwable $e) { error_log('[Payroll] getRuns: ' . $e->getMessage()); }
            try { $total = $this->payroll->countPayrollRuns(); } catch (\Throwable $e) {}
            try { $stats = $this->payroll->getStats(); } catch (\Throwable $e) {}
        }
        
        $data = [
            'runs' => $runs,
            'stats' => $stats,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'total_pages' => ceil($total / $limit)
            ]
        ];
        
        $this->render('admin/payroll/index', $data);
    }
    
    public function create(): void
    {
        $this->requireAdmin();
        $this->render('admin/payroll/create', []);
    }
    
    public function store(): void
    {
        $this->requireAdmin();
        
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            header('Location: /admin/payroll');
            exit;
        }
        
        $periodStart = $_POST['period_start'] ?? '';
        $periodEnd = $_POST['period_end'] ?? '';
        
        if (empty($periodStart) || empty($periodEnd)) {
            $_SESSION['flash'] = ['type' => 'error', 'message' => 'Period dates are required'];
            header('Location: /admin/payroll/create');
            exit;
        }
        
        // Generate name from dates
        $start = new DateTime($periodStart);
        $end = new DateTime($periodEnd);
        $name = 'Payroll ' . $start->format('M d') . ' - ' . $end->format('M d, Y');
        
        $runId = $this->payroll->createPayrollRun([
            'name' => $name,
            'period_start' => $periodStart,
            'period_end' => $periodEnd,
            'created_by' => $_SESSION['user_id'],
            'notes' => $_POST['notes'] ?? ''
        ]);
        
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Payroll run created'];
        header("Location: /admin/payroll/$runId");
        exit;
    }
    
    public function show(int $id): void
    {
        $this->requireAdmin();
        
        $run = $this->payroll->findPayrollRun($id);
        if (!$run) {
            $_SESSION['flash'] = ['type' => 'error', 'message' => 'Payroll run not found'];
            header('Location: /admin/payroll');
            exit;
        }
        
        $employees = $this->payroll->getPayrollEmployees($id);
        $adjustments = $this->payroll->getAdjustments($id);
        $variances = $this->payroll->getVariances($id);
        
        $this->render('admin/payroll/show', [
            'run' => $run,
            'employees' => $employees,
            'adjustments' => $adjustments,
            'variances' => $variances
        ]);
    }
    
    public function process(int $id): void
    {
        $this->requireAdmin();
        
        $run = $this->payroll->findPayrollRun($id);
        if (!$run) {
            header('Location: /admin/payroll');
            exit;
        }
        
        if ($run['status'] !== 'draft') {
            $_SESSION['flash'] = ['type' => 'error', 'message' => 'Can only process draft payroll runs'];
            header("Location: /admin/payroll/$id");
            exit;
        }
        
        $this->payroll->processPayrollRun($id, $_SESSION['user_id']);
        
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Payroll processed successfully'];
        header("Location: /admin/payroll/$id");
        exit;
    }
    
    public function complete(int $id): void
    {
        $this->requireAdmin();
        
        $this->payroll->completePayrollRun($id, $_SESSION['user_id']);
        
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Payroll completed'];
        header("Location: /admin/payroll/$id");
        exit;
    }
    
    public function markPaid(): void
    {
        $this->requireAdmin();
        
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            header('Location: /admin/payroll');
            exit;
        }
        
        $ids = $_POST['ids'] ?? [];
        if (!empty($ids)) {
            $this->payroll->markBatchAsPaid(array_map('intval', $ids));
            $_SESSION['flash'] = ['type' => 'success', 'message' => count($ids) . ' payments marked as paid'];
        }
        
        if (isset($_SERVER['HTTP_REFERER'])) {
            header('Location: ' . $_SERVER['HTTP_REFERER']);
        } else {
            header('Location: /admin/payroll');
        }
        exit;
    }
    
    public function addAdjustment(int $id): void
    {
        $this->requireAdmin();
        
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            header("Location: /admin/payroll/$id");
            exit;
        }
        
        $employeeId = (int)($_POST['employee_id'] ?? 0);
        if ($employeeId <= 0) {
            header("Location: /admin/payroll/$id");
            exit;
        }
        
        $this->payroll->addAdjustment($id, $employeeId, [
            'type' => $_POST['type'] ?? 'bonus',
            'amount' => (float)($_POST['amount'] ?? 0),
            'description' => $_POST['description'] ?? '',
            'created_by' => $_SESSION['user_id']
        ]);
        
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Adjustment added'];
        header("Location: /admin/payroll/$id");
        exit;
    }
    
    public function cancel(int $id): void
    {
        $this->requireAdmin();
        
        $run = $this->payroll->findPayrollRun($id);
        if (!$run || $run['status'] === 'completed') {
            header('Location: /admin/payroll');
            exit;
        }
        
        $this->payroll->updatePayrollRun($id, ['status' => 'cancelled']);
        
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Payroll cancelled'];
        header('Location: /admin/payroll');
        exit;
    }
    
    // API
    public function apiStats(): void
    {
        header('Content-Type: application/json');
        try {
            echo json_encode(['success' => true, 'data' => $this->payroll->getStats()]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    
    private function render(string $view, array $data = []): void
    {
        extract($data);
        $flash = $_SESSION['flash'] ?? null;
        unset($_SESSION['flash']);
        $pageTitle   = $title ?? 'Payroll';
        $currentPage = 'payroll';
        ob_start();
        include __DIR__ . '/../views/' . $view . '.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }
}
