<?php
/**
 * Phase 8 — Module 1: Operational Command Center Controller
 * 
 * Mission Control for the entire company.
 * /admin/command-center
 */
require_once __DIR__ . '/../config/phase8.php';
require_once __DIR__ . '/../models/PredictiveIncidentEngine.php';
require_once __DIR__ . '/../models/RecommendationEngine.php';
require_once __DIR__ . '/../models/CorrectiveActionEngine.php';
require_once __DIR__ . '/../models/WorkflowEngine.php';
require_once __DIR__ . '/../models/CrossModuleAutomation.php';
require_once __DIR__ . '/../models/NotificationHub.php';
require_once __DIR__ . '/../models/EnterpriseScoreEngine.php';
require_once __DIR__ . '/../models/OperationsTwin.php';
require_once __DIR__ . '/../models/AIDecisionSupport.php';
require_once __DIR__ . '/../models/OrgMemory.php';

class CommandCenterController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * GET /admin/command-center — Main operational command center
     */
    public function index(): void
    {
        if (!isAdmin()) {
            header('Location: /dashboard');
            exit;
        }

        // Module 1: Real-time status across all modules
        $moduleStatus = [];
        try { $moduleStatus = $this->getModuleStatus(); } catch (Throwable $e) { error_log('[CommandCenter] moduleStatus: ' . $e->getMessage()); }

        // Phase 8 engines — graceful fallback if tables don't exist yet
        $predictions = []; $predictionSummary = []; $recommendations = [];
        $correctiveActions = []; $workflows = []; $storeScores = [];
        try {
            $predictionEngine = new PredictiveIncidentEngine();
            $predictions      = $predictionEngine->getActivePredictions(null, null, 20);
            $predictionSummary = $predictionEngine->getDashboardSummary();
        } catch (Throwable $e) { error_log('[CommandCenter] predictions: ' . $e->getMessage()); }
        try {
            $recommendationEngine = new RecommendationEngine();
            $recommendations = $recommendationEngine->getRecommendations(null, null, 'pending', 15);
        } catch (Throwable $e) { error_log('[CommandCenter] recommendations: ' . $e->getMessage()); }
        try {
            $correctiveEngine = new CorrectiveActionEngine();
            $correctiveActions = $correctiveEngine->getByStatus('proposed', null, 10);
        } catch (Throwable $e) { error_log('[CommandCenter] corrective: ' . $e->getMessage()); }
        try {
            $workflowEngine = new WorkflowEngine();
            $workflows = $workflowEngine->listAll(null, true);
        } catch (Throwable $e) { error_log('[CommandCenter] workflows: ' . $e->getMessage()); }
        try {
            $scoreEngine = new EnterpriseScoreEngine();
            $stores = $this->db->fetchAll("SELECT id, name FROM stores WHERE is_active = 1");
            foreach ($stores as $store) {
                $scoreData = $scoreEngine->calculateStoreScore($store['id']);
                $storeScores[$store['id']] = array_merge(['name' => $store['name']], $scoreData);
            }
        } catch (Throwable $e) { error_log('[CommandCenter] scores: ' . $e->getMessage()); }

        // Executive View: Overall health
        $overallHealth = $this->calculateOverallHealth($moduleStatus, $predictionSummary);

        $pageTitle = 'Command Center';
        $currentPage = 'admin-command-center';
        ob_start();
        require __DIR__ . '/../views/admin/command-center.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /admin/command-center/predictions — Prediction management
     */
    public function predictions(): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $type = $_GET['type'] ?? null;
        $severity = $_GET['severity'] ?? null;
        $predictions = []; $stats = [];
        try {
            $engine = new PredictiveIncidentEngine();
            $predictions = $engine->getActivePredictions($type, $severity, 50);
            $stats = $engine->getAccuracyStats();
        } catch (Throwable $e) { error_log('[CommandCenter] predictions page: ' . $e->getMessage()); }

        $pageTitle = 'Predictions';
        $currentPage = 'admin-command-center';
        ob_start();
        require __DIR__ . '/../views/admin/predictions.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * POST /admin/command-center/predictions/run — Run prediction scan
     */
    public function runPredictions(): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $engine = new PredictiveIncidentEngine();
        $predictions = $engine->runPredictionScan();

        json_response(['success' => true, 'predictions_created' => count($predictions)]);
    }

    /**
     * POST /admin/command-center/predictions/{id}/acknowledge
     */
    public function acknowledgePrediction(int $id): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $userId = $_SESSION['user_id'] ?? 0;
        $notes = $_POST['notes'] ?? null;

        $engine = new PredictiveIncidentEngine();
        $engine->acknowledge($id, $userId, $notes);

        json_response(['success' => true]);
    }

    /**
     * GET /admin/command-center/recommendations
     */
    public function recommendations(): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $recommendations = []; $stats = [];
        try {
            $engine = new RecommendationEngine();
            $recommendations = $engine->getRecommendations(null, null, 'pending', 50);
            $stats = $engine->getEffectivenessStats();
        } catch (Throwable $e) { error_log('[CommandCenter] recommendations page: ' . $e->getMessage()); }

        $pageTitle = 'Recommendations';
        $currentPage = 'admin-command-center';
        ob_start();
        require __DIR__ . '/../views/admin/recommendations.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * POST /admin/command-center/recommendations/{id}/accept
     */
    public function acceptRecommendation(int $id): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $engine = new RecommendationEngine();
        $engine->accept($id, $_SESSION['user_id'] ?? 0);

        json_response(['success' => true]);
    }

    /**
     * GET /admin/command-center/scores
     */
    public function scores(): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $stores = [];
        try {
            $engine = new EnterpriseScoreEngine();
            foreach ($this->db->fetchAll("SELECT id, name FROM stores WHERE is_active = 1") as $store) {
                $stores[$store['id']] = [
                    'name' => $store['name'],
                    'score' => $engine->calculateStoreScore($store['id']),
                ];
            }
        } catch (Throwable $e) { error_log('[CommandCenter] scores page: ' . $e->getMessage()); }

        $pageTitle = 'Scores';
        $currentPage = 'admin-command-center';
        ob_start();
        require __DIR__ . '/../views/admin/scores.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /admin/command-center/workflows — Workflow management
     */
    public function workflows(): void
    {
        if (!isAdmin()) {
            header('Location: /dashboard');
            exit;
        }

        $workflows = []; $templates = [];
        try {
            $engine = new WorkflowEngine();
            $workflows = $engine->listAll(null, false);
            $templates = $engine->getTemplates();
        } catch (Throwable $e) { error_log('[CommandCenter] workflows page: ' . $e->getMessage()); }

        $pageTitle = 'Workflows';
        $currentPage = 'admin-command-center';
        ob_start();
        require __DIR__ . '/../views/admin/workflows.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * POST /admin/command-center/workflows — Create workflow
     */
    public function createWorkflow(): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $data = [
            'name' => $_POST['name'] ?? '',
            'description' => $_POST['description'] ?? '',
            'trigger_type' => $_POST['trigger_type'] ?? 'event',
            'trigger_config' => json_decode($_POST['trigger_config'] ?? '{}', true),
            'steps' => json_decode($_POST['steps'] ?? '[]', true),
            'created_by' => $_SESSION['user_id'] ?? 0,
            'store_id' => !empty($_POST['store_id']) ? (int)$_POST['store_id'] : null,
        ];

        $engine = new WorkflowEngine();
        $id = $engine->create($data);

        json_response(['success' => true, 'id' => $id]);
    }

    /**
     * GET /admin/command-center/notifications — Notification hub
     */
    public function notifications(): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $notifications = [];
        try {
            $hub = new NotificationHub();
            $notifications = $hub->getForUser($_SESSION['user_id'] ?? 0, false, 50);
        } catch (Throwable $e) { error_log('[CommandCenter] notifications: ' . $e->getMessage()); }

        $pageTitle = 'Notifications';
        $currentPage = 'admin-command-center';
        ob_start();
        require __DIR__ . '/../views/admin/notifications.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /admin/command-center/simulations — Operations twin
     */
    public function simulations(): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $history = []; $stores = [];
        try {
            $twin = new OperationsTwin();
            $history = $twin->getHistory(null, 20);
        } catch (Throwable $e) { error_log('[CommandCenter] simulations: ' . $e->getMessage()); }
        $stores = $this->db->fetchAll("SELECT id, name FROM stores WHERE is_active = 1");

        $pageTitle = 'Simulations';
        $currentPage = 'admin-command-center';
        ob_start();
        require __DIR__ . '/../views/admin/simulations.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * POST /admin/command-center/simulate — Run simulation
     */
    public function runSimulation(): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $storeId = (int)($_POST['store_id'] ?? 0);
        $scenarioType = $_POST['scenario_type'] ?? 'manager_loss';

        $twin = new OperationsTwin();
        $result = match ($scenarioType) {
            'manager_loss' => $twin->simulateManagerLoss($storeId),
            'demand_increase' => $twin->simulateDemandIncrease($storeId, (float)($_POST['increase_pct'] ?? 30)),
            'store_closure' => $twin->simulateStoreClosure($storeId),
            default => ['error' => 'Unknown scenario type'],
        };

        if (!isset($result['error'])) {
            $twin->saveSimulation($_SESSION['user_id'] ?? 0, $storeId, $scenarioType, $result['scenario'] ?? '', $_POST, $result);
        }

        json_response($result);
    }

    /**
     * GET /admin/command-center/memory — Organizational memory
     */
    public function memory(): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $query = $_GET['q'] ?? '';
        $type = $_GET['type'] ?? null;
        $memories = [];
        try {
            $memory = new OrgMemory();
            $memories = $query ? $memory->search($query, $type) : $memory->getRecent(50);
        } catch (Throwable $e) { error_log('[CommandCenter] memory: ' . $e->getMessage()); }

        $pageTitle = 'Organizational Memory';
        $currentPage = 'admin-command-center';
        ob_start();
        require __DIR__ . '/../views/admin/memory.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /admin/command-center/ai-decisions — AI decision support
     */
    public function aiDecisions(): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $summary = [];
        try {
            $ai = new AIDecisionSupport();
            $summary = $ai->getExecutiveSummary();
        } catch (Throwable $e) { error_log('[CommandCenter] ai-decisions: ' . $e->getMessage()); }

        $pageTitle = 'AI Decisions';
        $currentPage = 'admin-command-center';
        ob_start();
        require __DIR__ . '/../views/admin/ai-decisions.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /admin/command-center/api/summary — JSON summary for AJAX refresh
     */
    public function apiSummary(): void
    {
        if (!isAdmin()) json_response(['error' => 'Unauthorized'], 403);

        $predictionEngine = new PredictiveIncidentEngine();
        $recommendationEngine = new RecommendationEngine();
        $correctiveEngine = new CorrectiveActionEngine();
        $scoreEngine = new EnterpriseScoreEngine();

        json_response([
            'module_status' => $this->getModuleStatus(),
            'predictions' => $predictionEngine->getDashboardSummary(),
            'recommendations' => count($recommendationEngine->getRecommendations(null, null, 'pending', 100)),
            'corrective_actions' => $correctiveEngine->getSummary(),
            'overall_health' => $this->calculateOverallHealth($this->getModuleStatus(), $predictionEngine->getDashboardSummary()),
        ]);
    }

    // ─── PRIVATE ──────────────────────────────────────────────────

    private function getModuleStatus(): array
    {
        $modules = P8_COMMAND_CENTER['modules'] ?? ['stores', 'incidents', 'payroll', 'compliance', 'audits', 'releases', 'training', 'staffing'];
        $status = [];

        foreach ($modules as $module) {
            $score = 100;
            $details = [];

            switch ($module) {
                case 'stores':
                    $stmt = $this->db->prepare("SELECT COUNT(*) FROM stores WHERE is_active = 1");
                    $stmt->execute();
                    $details['total'] = (int)$stmt->fetchColumn();
                    $stmt = $this->db->prepare("SELECT COUNT(*) FROM tasks WHERE status NOT IN ('done','cancelled') AND due_date < CURDATE()");
                    $stmt->execute();
                    $overdue = (int)$stmt->fetchColumn();
                    $score = max(0, 100 - ($overdue * 2));
                    $details['overdue'] = $overdue;
                    break;

                case 'incidents':
                    $incidents = 0;
                    if ($this->db->tableExists('automation_events')) {
                        $stmt = $this->db->prepare("SELECT COUNT(*) FROM automation_events WHERE source_module = 'incidents' AND created_at >= CURDATE()");
                        $stmt->execute();
                        $incidents = (int)$stmt->fetchColumn();
                    }
                    $score = max(0, 100 - ($incidents * 10));
                    $details['today'] = $incidents;
                    break;

                case 'payroll':
                    $stmt = $this->db->prepare("SELECT COUNT(*) FROM bills WHERE category = 'payroll' AND status = 'pending' AND due_date < CURDATE()");
                    $stmt->execute();
                    $overdue = (int)$stmt->fetchColumn();
                    $score = max(0, 100 - ($overdue * 15));
                    $details['overdue'] = $overdue;
                    break;

                case 'compliance':
                    $stmt = $this->db->prepare("SELECT COUNT(*) FROM bills WHERE status = 'pending' AND due_date < CURDATE()");
                    $stmt->execute();
                    $pending = (int)$stmt->fetchColumn();
                    $score = max(0, 100 - ($pending * 5));
                    $details['pending_bills'] = $pending;
                    break;

                case 'audits':
                    $failures = 0;
                    if ($this->db->tableExists('automation_events')) {
                        $stmt = $this->db->prepare("SELECT COUNT(*) FROM automation_events WHERE source_module = 'audits' AND source_event = 'audit_failed' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
                        $stmt->execute();
                        $failures = (int)$stmt->fetchColumn();
                    }
                    $score = max(0, 100 - ($failures * 20));
                    $details['failures_30d'] = $failures;
                    break;

                case 'releases':
                    $details['status'] = 'operational';
                    break;

                case 'training':
                    $stmt = $this->db->prepare("SELECT COUNT(*) FROM tasks WHERE title LIKE '%training%' AND status NOT IN ('done','cancelled')");
                    $stmt->execute();
                    $pending = (int)$stmt->fetchColumn();
                    $details['pending'] = $pending;
                    break;

                case 'staffing':
                    $stmt = $this->db->prepare("SELECT COUNT(*) FROM users");
                    $stmt->execute();
                    $details['total'] = (int)$stmt->fetchColumn();
                    break;
            }

            $statusLabel = $score >= 70 ? 'healthy' : ($score >= 40 ? 'warning' : 'critical');

            $status[$module] = [
                'module' => $module,
                'status' => $statusLabel,
                'score' => round($score, 1),
                'details' => $details,
            ];
        }

        return $status;
    }

    private function calculateOverallHealth(array $moduleStatus, array $predictionSummary): array
    {
        $scores = array_column($moduleStatus, 'score');
        $avgScore = count($scores) > 0 ? array_sum($scores) / count($scores) : 100;

        $criticalPredictions = (int)($predictionSummary['critical'] ?? 0);
        $highPredictions = (int)($predictionSummary['high'] ?? 0);

        if ($criticalPredictions > 0 || $avgScore < 40) {
            $health = 'critical';
            $message = 'Immediate attention required';
        } elseif ($highPredictions > 0 || $avgScore < 70) {
            $health = 'warning';
            $message = 'Issues requiring attention';
        } else {
            $health = 'healthy';
            $message = 'All systems operational';
        }

        return [
            'health' => $health,
            'score' => round($avgScore, 1),
            'message' => $message,
            'critical_predictions' => $criticalPredictions,
            'high_predictions' => $highPredictions,
        ];
    }
}
