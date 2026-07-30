<?php
/**
 * Phase 11 — Module 9: Franchise Playbooks
 * Standardized procedures for all franchise operations.
 * /playbooks
 */
require_once __DIR__ . '/../models/Task.php';

class FranchisePlaybooksController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    public function index(): void
    {
        if (!canManage()) { header('Location: /dashboard'); exit; }
        $playbooks = $this->getPlaybooks();
        $compliance = $this->getComplianceStatus();
        $content = $this->renderView('index', compact('playbooks', 'compliance'));
        $pageTitle = 'Playbooks';
        $currentPage = 'playbooks';
        require __DIR__ . '/../views/layouts/main.php';
    }

    public function show(string $key): void
    {
        if (!canManage()) { header('Location: /dashboard'); exit; }
        $playbook = $this->getPlaybookByKey($key);
        if (!$playbook) { flash('error', 'Playbook not found'); redirect('/playbooks'); }
        $recentRuns = $this->db->fetchAll(
            "SELECT t.*, u.name as assignee_name FROM tasks t
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.title LIKE ? AND t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             ORDER BY t.created_at DESC LIMIT 20",
            ['%' . $playbook['title'] . '%']
        );
        $content = $this->renderView('detail', compact('playbook', 'recentRuns'));
        $pageTitle = $playbook['title'];
        $currentPage = 'playbooks';
        require __DIR__ . '/../views/layouts/main.php';
    }

    public function run(string $key): void
    {
        if (!canManage()) json_response(['error' => 'Unauthorized'], 403);
        $playbook = $this->getPlaybookByKey($key);
        if (!$playbook) json_response(['error' => 'Not found'], 404);
        $assigneeId = (int)($_POST['assignee_id'] ?? $_SESSION['user_id']);
        $dueDate = $_POST['due_date'] ?? DateService::today();
        $created = 0;
        foreach (($playbook['steps'] ?? []) as $step) {
            (new Task())->create([
                'title' => $playbook['title'] . ': ' . ($step['name'] ?? ''),
                'due_date' => $dueDate, 'status' => 'todo',
                'priority' => $step['priority'] ?? 'medium',
                'assignee_id' => $assigneeId,
                'description' => $step['description'] ?? '',
            ]);
            $created++;
        }
        flash('success', "Playbook '{$playbook['title']}' started: {$created} tasks created");
        redirect('/playbooks/' . $key);
    }

    private function getPlaybooks(): array
    {
        return [
            ['key' => 'store-opening', 'title' => 'Store Opening',
             'description' => 'Daily opening procedure',
             'icon' => 'sun', 'color' => '#00cc66',
             'steps' => [
                 ['name' => 'Lights & signage on', 'priority' => 'high'],
                 ['name' => 'POS system boot', 'priority' => 'high'],
                 ['name' => 'Cash drawer count', 'priority' => 'high'],
                 ['name' => 'Inventory spot check', 'priority' => 'medium'],
                 ['name' => 'Cleaning verification', 'priority' => 'medium'],
                 ['name' => 'Temperature check', 'priority' => 'medium'],
                 ['name' => 'Staff briefing', 'priority' => 'low'],
             ]],
            ['key' => 'store-closing', 'title' => 'Store Closing',
             'description' => 'End-of-day closing procedure',
             'icon' => 'moon', 'color' => '#3b82f6',
             'steps' => [
                 ['name' => 'End-of-day sales close', 'priority' => 'high'],
                 ['name' => 'Cash drawer count', 'priority' => 'high'],
                 ['name' => 'Inventory count', 'priority' => 'medium'],
                 ['name' => 'Cleaning & sanitizing', 'priority' => 'medium'],
                 ['name' => 'Equipment shutdown', 'priority' => 'medium'],
                 ['name' => 'Trash removal', 'priority' => 'low'],
                 ['name' => 'Security check', 'priority' => 'high'],
             ]],
            ['key' => 'payroll', 'title' => 'Payroll Processing',
             'description' => 'Bi-weekly payroll cycle',
             'icon' => 'dollar', 'color' => '#ffaa00',
             'steps' => [
                 ['name' => 'Collect timesheets', 'priority' => 'high'],
                 ['name' => 'Review & verify hours', 'priority' => 'high'],
                 ['name' => 'Calculate overtime', 'priority' => 'high'],
                 ['name' => 'Manager approval', 'priority' => 'high'],
                 ['name' => 'Submit to payroll', 'priority' => 'medium'],
                 ['name' => 'Process payment', 'priority' => 'high'],
             ]],
            ['key' => 'inventory', 'title' => 'Inventory Audit',
             'description' => 'Weekly inventory check',
             'icon' => 'package', 'color' => '#8b5cf6',
             'steps' => [
                 ['name' => 'Count all items', 'priority' => 'high'],
                 ['name' => 'Reconcile with system', 'priority' => 'high'],
                 ['name' => 'Flag discrepancies', 'priority' => 'high'],
                 ['name' => 'Place orders for low stock', 'priority' => 'medium'],
                 ['name' => 'Update inventory records', 'priority' => 'medium'],
             ]],
            ['key' => 'audit', 'title' => 'Compliance Audit',
             'description' => 'Monthly compliance audit procedure',
             'icon' => 'shield', 'color' => '#dc2626',
             'steps' => [
                 ['name' => 'Review compliance checklist', 'priority' => 'high'],
                 ['name' => 'Inspect safety equipment', 'priority' => 'high'],
                 ['name' => 'Check documentation', 'priority' => 'medium'],
                 ['name' => 'Document findings', 'priority' => 'medium'],
                 ['name' => 'Submit audit report', 'priority' => 'high'],
             ]],
        ];
    }

    private function getPlaybookByKey(string $key): ?array
    {
        foreach ($this->getPlaybooks() as $p) {
            if ($p['key'] === $key) return $p;
        }
        return null;
    }

    private function getComplianceStatus(): array
    {
        $completed = $this->db->fetch(
            "SELECT COUNT(*) as c FROM tasks
             WHERE (title LIKE '%Opening:%' OR title LIKE '%Closing:%')
               AND is_completed = 1
               AND updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        )['c'] ?? 0;
        $total = $this->db->fetch(
            "SELECT COUNT(*) as c FROM tasks
             WHERE (title LIKE '%Opening:%' OR title LIKE '%Closing:%')
               AND updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        )['c'] ?? 0;
        return [
            'completed' => (int)$completed,
            'total' => (int)$total,
            'rate' => $total > 0 ? round(($completed / $total) * 100) : 100,
        ];
    }

    private function renderView(string $template, array $vars = []): string
    {
        extract($vars);
        ob_start();
        include __DIR__ . '/../views/playbooks/' . $template . '.php';
        return ob_get_clean();
    }
}
