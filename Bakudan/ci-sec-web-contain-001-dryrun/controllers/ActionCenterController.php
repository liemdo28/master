<?php
/**
 * Phase 11 — Module 8: Action Center
 * 
 * CEO sees ONLY what needs action. No charts.
 * /action-center
 */
require_once __DIR__ . '/../models/Task.php';
require_once __DIR__ . '/../models/Bill.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/DeadlineExtension.php';

class ActionCenterController
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

        // NEED APPROVAL
        $pendingApprovals = $this->getPendingApprovals();

        // NEED REVIEW
        $needsReview = $this->getNeedsReview();

        // NEED ESCALATION
        $needsEscalation = $this->getNeedsEscalation();

        // NEED ATTENTION (overdue + urgent)
        $needsAttention = $this->getNeedsAttention();

        $totalActions = count($pendingApprovals) + count($needsReview)
                      + count($needsEscalation) + count($needsAttention);

        $content = $this->renderView(compact(
            'today', 'pendingApprovals', 'needsReview',
            'needsEscalation', 'needsAttention', 'totalActions'
        ));

        $pageTitle = 'Action Center';
        $currentPage = 'action-center';
        $extraCss = ['operations.css'];
        require __DIR__ . '/../views/layouts/main.php';
    }

    private function getPendingApprovals(): array
    {
        $items = [];

        // Deadline extensions pending
        $extRows = $this->db->fetchAll(
            "SELECT de.*, t.title as task_title, u.name as requester_name
             FROM deadline_extensions de
             JOIN tasks t ON de.task_id = t.id
             JOIN users u ON de.requested_by = u.id
             WHERE de.status = 'pending'
             ORDER BY de.requested_at ASC
             LIMIT 10"
        );
        foreach ($extRows as $r) {
            $items[] = [
                'type' => 'extension',
                'title' => 'Deadline Extension: ' . $r['task_title'],
                'description' => 'Requested by ' . $r['requester_name'],
                'detail' => 'Current: ' . $r['current_due_date'] . ' → Requested: ' . $r['requested_due_date'],
                'id' => $r['id'],
                'url' => '/admin/extensions',
                'priority' => 'medium',
                'created_at' => $r['requested_at'],
            ];
        }

        // Payroll bills pending
        $billRows = $this->db->fetchAll(
            "SELECT b.*, s.name as store_name
             FROM bills b
             LEFT JOIN stores s ON b.store_id = s.id
             WHERE b.category = 'payroll'
               AND b.status = 'pending'
             ORDER BY b.due_date ASC
             LIMIT 10"
        );
        foreach ($billRows as $r) {
            $items[] = [
                'type' => 'payroll',
                'title' => 'Payroll Approval: ' . e($r['vendor'] ?? 'Payroll'),
                'description' => e($r['store_name'] ?? ''),
                'detail' => '$' . number_format($r['amount'], 2) . ' · Due: ' . $r['due_date'],
                'id' => $r['id'],
                'url' => '/bills/' . $r['id'],
                'priority' => 'high',
                'created_at' => $r['created_at'] ?? '',
            ];
        }

        // Releases pending approval
        if ($this->db->tableExists('releases')) {
            $hasCreatedBy = $this->db->columnExists('releases', 'created_by');
            $hasOwnerId   = $this->db->columnExists('releases', 'owner_id');
            $createdByCol = $hasCreatedBy ? 'r.created_by' : ($hasOwnerId ? 'r.owner_id' : 'NULL');
            $relRows = $this->db->fetchAll(
                "SELECT r.*, u.name as created_by_name
                 FROM releases r
                 LEFT JOIN users u ON {$createdByCol} = u.id
                 WHERE r.status = 'review'
                 ORDER BY r.created_at DESC
                 LIMIT 5"
            );
            foreach ($relRows as $r) {
                $items[] = [
                    'type' => 'release',
                    'title' => 'Release Review: ' . e($r['name'] ?? $r['title'] ?? 'Release'),
                    'description' => 'By ' . e($r['created_by_name'] ?? ''),
                    'detail' => ucfirst($r['status'] ?? ''),
                    'id' => $r['id'],
                    'url' => '/releases/' . $r['id'],
                    'priority' => 'medium',
                    'created_at' => $r['created_at'] ?? '',
                ];
            }
        }

        return $items;
    }

    private function getNeedsReview(): array
    {
        $items = [];

        // Tasks in review status
        $rows = $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, u.name as assignee_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.status = 'review' AND t.is_completed = 0
             ORDER BY t.updated_at DESC
             LIMIT 10"
        );
        foreach ($rows as $r) {
            $items[] = [
                'type' => 'task_review',
                'title' => e($r['title']),
                'description' => e($r['project_name'] ?? ''),
                'detail' => 'Assigned to ' . e($r['assignee_name'] ?? 'Unassigned'),
                'id' => $r['id'],
                'url' => '/tasks/' . $r['id'],
                'priority' => $r['priority'] ?? 'medium',
                'created_at' => $r['updated_at'] ?? $r['created_at'],
            ];
        }

        return $items;
    }

    private function getNeedsEscalation(): array
    {
        $items = [];

        // Tasks overdue > 5 days
        $today = DateService::today();
        $rows = $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, s.name as store_name, u.name as assignee_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores s ON p.store_id = s.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.is_completed = 0
               AND t.status NOT IN ('completed','done','cancelled')
               AND t.due_date < DATE_SUB(CURDATE(), INTERVAL 5 DAY)
             ORDER BY t.due_date ASC
             LIMIT 10"
        );
        foreach ($rows as $r) {
            $days = (int)((strtotime($today) - strtotime($r['due_date'])) / 86400);
            $items[] = [
                'type' => 'escalation',
                'title' => e($r['title']),
                'description' => e($r['store_name'] ?? '') . ' · ' . e($r['assignee_name'] ?? 'Unassigned'),
                'detail' => 'Overdue ' . $days . ' days',
                'id' => $r['id'],
                'url' => '/tasks/' . $r['id'],
                'priority' => 'urgent',
                'created_at' => $r['created_at'],
            ];
        }

        return $items;
    }

    private function getNeedsAttention(): array
    {
        $items = [];

        // High/urgent priority tasks due today or overdue
        $rows = $this->db->fetchAll(
            "SELECT t.*, p.name as project_name, s.name as store_name, u.name as assignee_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores s ON p.store_id = s.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.is_completed = 0
               AND t.status NOT IN ('completed','done','cancelled')
               AND t.priority IN ('urgent','high')
               AND t.due_date <= CURDATE()
             ORDER BY t.due_date ASC
             LIMIT 15"
        );
        $today = DateService::today();
        foreach ($rows as $r) {
            $isOverdue = !empty($r['due_date']) && $r['due_date'] < $today;
            $items[] = [
                'type' => 'attention',
                'title' => e($r['title']),
                'description' => e($r['store_name'] ?? '') . ' · ' . e($r['assignee_name'] ?? 'Unassigned'),
                'detail' => $isOverdue ? 'OVERDUE' : 'Due today',
                'id' => $r['id'],
                'url' => '/tasks/' . $r['id'],
                'priority' => $r['priority'],
                'created_at' => $r['created_at'],
                'is_overdue' => $isOverdue,
            ];
        }

        return $items;
    }

    private function renderView(array $vars): string
    {
        extract($vars);
        ob_start();
        include __DIR__ . '/../views/action-center/index.php';
        return ob_get_clean();
    }
}
