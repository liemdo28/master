<?php
/**
 * Phase 11 — Module 12: Bakudan Control Tower
 * 
 * Single screen CEO view — real-time company health in 30 seconds.
 * /control-tower
 */
require_once __DIR__ . '/../models/Store.php';
require_once __DIR__ . '/../models/Task.php';
require_once __DIR__ . '/../models/Bill.php';
require_once __DIR__ . '/../models/User.php';

class ControlTowerController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    public function index(): void
    {
        if (!canManage()) {
            header('Location: /dashboard');
            exit;
        }

        $today = DateService::today();

        // Track adoption
        $currentUser = currentUser();
        UsageTracker::log('control_tower_view', [
            'role' => $currentUser['role'] ?? null,
            'user_id' => $currentUser['id'] ?? null,
        ]);

        // ── OVERALL HEALTH ─────────────────────────────────────────────
        $overallHealth = $this->getOverallHealth();

        // ── STORES ─────────────────────────────────────────────────────
        $stores = $this->getStoreHealth();

        // ── EMPLOYEES ─────────────────────────────────────────────────
        $employees = $this->getEmployeeStatus();

        // ── PAYROLL ───────────────────────────────────────────────────
        $payroll = $this->getPayrollStatus();

        // ── RELEASES ──────────────────────────────────────────────────
        $releases = $this->getReleaseStatus();

        // ── AUDITS ────────────────────────────────────────────────────
        $audits = $this->getAuditStatus();

        // ── INCIDENTS ─────────────────────────────────────────────────
        $incidents = $this->getIncidentStatus();

        // ── TRAINING ──────────────────────────────────────────────────
        $training = $this->getTrainingStatus();

        $content = $this->renderView(compact(
            'today', 'overallHealth', 'stores', 'employees',
            'payroll', 'releases', 'audits', 'incidents', 'training'
        ));

        $pageTitle = 'Control Tower';
        $currentPage = 'control-tower';
        $extraCss = ['operations.css'];
        require __DIR__ . '/../views/layouts/main.php';
    }

    private function getOverallHealth(): array
    {
        $scores = [];

        // Task health
        $taskRow = $this->db->fetch(
            "SELECT
                COUNT(*) as total,
                SUM(CASE WHEN is_completed=0 AND due_date < CURDATE() THEN 1 ELSE 0 END) as overdue
             FROM tasks WHERE status != 'cancelled'"
        );
        $taskHealth = $taskRow['total'] > 0
            ? max(0, 100 - round(($taskRow['overdue'] / max(1, $taskRow['total'])) * 100))
            : 100;
        $scores[] = $taskHealth;

        // Store health
        $stores = $this->db->fetchAll(
            "SELECT s.id FROM stores s WHERE s.is_active = 1"
        );
        foreach ($stores as $s) {
            $r = $this->db->fetch(
                "SELECT COUNT(*) as total,
                        SUM(CASE WHEN t.due_date < CURDATE() AND t.is_completed=0 THEN 1 ELSE 0 END) as overdue
                 FROM tasks t JOIN projects p ON t.project_id = p.id
                 WHERE p.store_id = ? AND t.status != 'cancelled'",
                [$s['id']]
            );
            $scores[] = $r['total'] > 0
                ? max(0, 100 - round(($r['overdue'] / max(1, $r['total'])) * 100))
                : 100;
        }

        // Payroll health
        $payrollOverdue = (int)$this->db->fetch(
            "SELECT COUNT(*) as c FROM bills WHERE category='payroll' AND status='overdue'"
        )['c'];
        $payrollHealth = max(0, 100 - ($payrollOverdue * 20));
        $scores[] = $payrollHealth;

        $avgScore = count($scores) > 0 ? array_sum($scores) / count($scores) : 100;

        return [
            'score' => round($avgScore),
            'status' => $avgScore >= 80 ? 'healthy' : ($avgScore >= 50 ? 'warning' : 'critical'),
            'message' => $avgScore >= 80 ? 'All systems operational'
                : ($avgScore >= 50 ? 'Some areas need attention' : 'Critical issues detected'),
        ];
    }

    private function getStoreHealth(): array
    {
        $rows = $this->db->fetchAll(
            "SELECT s.id, s.name, s.color,
                    COUNT(t.id) as total,
                    SUM(CASE WHEN t.due_date < CURDATE() AND t.is_completed=0 THEN 1 ELSE 0 END) as overdue,
                    SUM(CASE WHEN t.due_date = CURDATE() AND t.is_completed=0 THEN 1 ELSE 0 END) as today,
                    SUM(CASE WHEN t.priority IN ('urgent','high') AND t.is_completed=0 THEN 1 ELSE 0 END) as incidents
             FROM stores s
             LEFT JOIN projects p ON p.store_id = s.id
             LEFT JOIN tasks t ON t.project_id = p.id AND t.status != 'cancelled'
             WHERE s.is_active = 1
             GROUP BY s.id
             ORDER BY overdue DESC"
        );

        foreach ($rows as &$r) {
            $r['health'] = $r['total'] > 0
                ? max(0, round(100 - ($r['overdue'] / $r['total']) * 100))
                : 100;
            $r['status'] = $r['health'] >= 80 ? 'healthy' : ($r['health'] >= 50 ? 'warning' : 'critical');
        }
        return $rows;
    }

    private function getEmployeeStatus(): array
    {
        $rows = $this->db->fetchAll(
            "SELECT u.id, u.name, u.avatar, u.role,
                    COUNT(t.id) as total_tasks,
                    SUM(CASE WHEN t.due_date < CURDATE() AND t.is_completed=0 THEN 1 ELSE 0 END) as overdue,
                    SUM(CASE WHEN t.is_completed=1 THEN 1 ELSE 0 END) as completed
             FROM users u
             LEFT JOIN tasks t ON t.assignee_id = u.id AND t.status != 'cancelled'
             WHERE u.is_active = 1
             GROUP BY u.id
             ORDER BY overdue DESC
             LIMIT 15"
        );
        foreach ($rows as &$r) {
            $r['score'] = $r['total_tasks'] > 0
                ? round(($r['completed'] / $r['total_tasks']) * 100)
                : 100;
            $r['exec_score'] = $r['total_tasks'] > 0
                ? max(0, round($r['score'] - ($r['overdue'] * 5)))
                : 100;
        }
        return $rows;
    }

    private function getPayrollStatus(): array
    {
        $pending = (int)$this->db->fetch(
            "SELECT COUNT(*) as c FROM bills WHERE category='payroll' AND status='pending'"
        )['c'];
        $overdue = (int)$this->db->fetch(
            "SELECT COUNT(*) as c FROM bills WHERE category='payroll' AND status='overdue'"
        )['c'];
        $total = $pending + $overdue;
        return [
            'total' => $total,
            'pending' => $pending,
            'overdue' => $overdue,
            'status' => $overdue > 0 ? 'critical' : ($pending > 0 ? 'warning' : 'healthy'),
        ];
    }

    private function getReleaseStatus(): array
    {
        if (!$this->db->tableExists('releases')) {
            return ['total' => 0, 'draft' => 0, 'testing' => 0, 'done' => 0, 'status' => 'healthy'];
        }
        $r = $this->db->fetch(
            "SELECT
                COUNT(*) as total,
                SUM(status='draft') as draft,
                SUM(status='testing') as testing,
                SUM(status='review') as review
             FROM releases WHERE status NOT IN ('deployed','cancelled')"
        );
        return [
            'total' => (int)$r['total'],
            'draft' => (int)$r['draft'],
            'testing' => (int)$r['testing'],
            'review' => (int)$r['review'],
            'status' => ((int)$r['review'] > 0) ? 'warning' : 'healthy',
        ];
    }

    private function getAuditStatus(): array
    {
        $pending = (int)$this->db->fetch(
            "SELECT COUNT(*) as c FROM tasks
             WHERE (title LIKE '%audit%' OR title LIKE '%inspection%')
               AND is_completed=0 AND status != 'cancelled'"
        )['c'];
        return [
            'pending' => $pending,
            'status' => $pending > 3 ? 'warning' : 'healthy',
        ];
    }

    private function getIncidentStatus(): array
    {
        $today = (int)$this->db->fetch(
            "SELECT COUNT(*) as c FROM tasks
             WHERE priority IN ('urgent','high') AND is_completed=0
               AND created_at >= CURDATE()"
        )['c'];
        $week = (int)$this->db->fetch(
            "SELECT COUNT(*) as c FROM tasks
             WHERE priority IN ('urgent','high') AND is_completed=0
               AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        )['c'];
        return [
            'today' => $today,
            'week' => $week,
            'status' => $today > 2 ? 'critical' : ($today > 0 ? 'warning' : 'healthy'),
        ];
    }

    private function getTrainingStatus(): array
    {
        $pending = (int)$this->db->fetch(
            "SELECT COUNT(*) as c FROM tasks
             WHERE (title LIKE '%training%' OR title LIKE '%onboarding%')
               AND is_completed=0 AND status != 'cancelled'"
        )['c'];
        return [
            'pending' => $pending,
            'status' => 'neutral',
        ];
    }

    private function renderView(array $vars): string
    {
        extract($vars);
        ob_start();
        include __DIR__ . '/../views/control-tower/index.php';
        return ob_get_clean();
    }
}
